import type { AgAiConversationItem, AgAiEvent, AgAiOutputItem, AgLlmAdapter, AgLlmRequest, AgLlmResponse } from 'ag-studio';
import { API_BASE_URL } from '../../config';
import { getCsrfToken } from '../../api/client';

/**
 * Studio Agent Framework adapter. It sends each model turn to OUR backend (/api/v1/dashboard-llm), which holds the NVIDIA key
 * and forwards it. The browser never sees the key. Studio runs its own dashboard tools (add_widget, execute_query, ...) in the
 * page; this adapter only translates between Studio's conversation items and chat messages.
 */
interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]; tool_call_id?: string }
interface Reply { message: { content: string; tool_calls: { id: string; name: string; arguments: string }[] } }

function toMessages(request: AgLlmRequest): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (request.instructions) out.push({ role: 'system', content: request.instructions });
  for (const item of request.input as AgAiConversationItem[]) {
    if (item.type === 'message') {
      const text = (item.content as { type: string; text?: string; refusal?: string }[]).map(c => c.text ?? c.refusal ?? '').join('');
      out.push({ role: item.kind === 'output' ? 'assistant' : item.role === 'system' ? 'system' : 'user', content: text });
    } else if (item.type === 'function_call') {
      const call = { id: item.callId, type: 'function' as const, function: { name: item.name, arguments: item.arguments || '{}' } };
      const last = out[out.length - 1];
      if (last && last.role === 'assistant' && last.tool_calls) last.tool_calls.push(call); else out.push({ role: 'assistant', content: '', tool_calls: [call] });
    } else if (item.type === 'function_call_output') {
      out.push({ role: 'tool', content: item.output, tool_call_id: item.callId });
    }   // reasoning items are not sent back
  }
  return out;
}

export interface ViewReply { note: string; suggestions?: string[] }
let viewHandler: ((q: string) => Promise<ViewReply>) | null = null;
let helpText = '';
/** The dashboard registers how a plain-words request becomes a view (same pipeline as its Ask box). */
export function setViewHandler(handler: ((q: string) => Promise<ViewReply>) | null, help = '') { viewHandler = handler; helpText = help; }

function textHandler(id: string, compute: () => Promise<string>) {
  const complete = compute().then((text): AgLlmResponse => ({
    id, createdAt: Date.now(), status: 'completed',
    output: [{ id: `${id}_m`, kind: 'output', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'text', text, annotations: [] }] }],
  }), (): AgLlmResponse => ({ id, createdAt: Date.now(), output: [], status: 'failed', error: { code: 'VIEW_ERROR', message: 'The assistant could not answer right now. Nothing was changed.' } }));
  async function* events(): AsyncGenerator<AgAiEvent> {
    const r = await complete;
    for (const item of r.output) if (item.type === 'message') {
      yield { type: 'TEXT_MESSAGE_START', messageId: item.id, role: 'assistant' };
      yield { type: 'TEXT_MESSAGE_CONTENT', messageId: item.id, delta: item.content.map(c => ('text' in c ? c.text : c.refusal)).join('') };
      yield { type: 'TEXT_MESSAGE_END', messageId: item.id };
    }
  }
  return { stream: { [Symbol.asyncIterator]: () => events() }, complete };
}

/** True when the tool calls just before this turn failed. The small model tends to claim success anyway, so the page answers instead. */
function lastToolsFailed(request: AgLlmRequest): boolean {
  const items = request.input as AgAiConversationItem[];
  let sawResult = false;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type === 'function_call_output') {
      sawResult = true;
      let parsed: { success?: boolean } | null = null;
      try { parsed = JSON.parse(it.output); } catch { /* plain text result */ }
      // Studio's tool results are JSON with a success flag. Matching words such as "rejected" is wrong: the schema itself has a field with that name.
      if (it.status !== 'completed' || parsed?.success === false || (!parsed && /^\s*(error|expected)/i.test(it.output))) return true;
    } else if (it.type === 'function_call') { continue; } else { break; }
  }
  return sawResult && false;
}
const HONEST = 'I could not change the chart: Studio rejected the configuration, so nothing was changed. For a quick view such as "last 2 days", use the Ask box above this dashboard.';

export const llmAdapter: AgLlmAdapter = {
  executeTurn(request, options) {
    // A plain-words request from the user is answered by our own pipeline: the model picks a view from a fixed menu and our code fills
    // Studio's data mapping. The small model cannot fill that mapping itself, so it is not asked to.
    const items = request.input as AgAiConversationItem[];
    const last = items[items.length - 1];
    if (viewHandler && last && last.type === 'message' && last.kind === 'input' && last.role === 'user') {
      const question = (last.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join(' ').trim();
      const handler = viewHandler; const help = helpText;
      return textHandler(`turn_${Date.now()}_view`, async () => {
        if (/\b(what|which)\b.*\b(data|views?|show|charts?|ask|have|available)\b|^\s*help\b|\bwhat can you\b/i.test(question)) return help;
        const r = await handler(question);
        return r.note + (r.suggestions?.length ? '\n' + r.suggestions.map((x) => '• ' + x).join('\n') : '');
      });
    }
    if (lastToolsFailed(request)) {
      const id = `turn_${Date.now()}_honest`;
      const message: AgAiOutputItem = { id: `${id}_m`, kind: 'output', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'text', text: HONEST, annotations: [] }] };
      async function* say(): AsyncGenerator<AgAiEvent> {
        yield { type: 'TEXT_MESSAGE_START', messageId: message.id, role: 'assistant' };
        yield { type: 'TEXT_MESSAGE_CONTENT', messageId: message.id, delta: HONEST };
        yield { type: 'TEXT_MESSAGE_END', messageId: message.id };
      }
      return { stream: { [Symbol.asyncIterator]: () => say() }, complete: Promise.resolve({ id, createdAt: Date.now(), output: [message], status: 'completed' }) };
    }
    const body = {
      messages: toMessages(request),
      tools: (request.tools ?? []).filter(t => (t.kind ?? 'client') === 'client').map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: typeof request.toolChoice === 'object' ? { type: 'function', function: { name: request.toolChoice.name } } : request.toolChoice,
    };
    if (!body.tools.length) { delete (body as { tools?: unknown }).tools; delete (body as { tool_choice?: unknown }).tool_choice; }
    const id = `turn_${Date.now()}`;
    const reply: Promise<Reply> = (async () => {
      const csrf = await getCsrfToken();
      const res = await fetch(`${API_BASE_URL}/dashboard-llm`, {
        method: 'POST', credentials: 'include', signal: options?.signal,
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('The dashboard assistant could not answer right now.');
      return (await res.json()) as Reply;
    })();
    const complete: Promise<AgLlmResponse> = reply.then((r): AgLlmResponse => {
      const output: AgAiOutputItem[] = [];
      if (r.message.content) output.push({ id: `${id}_m`, kind: 'output', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'text', text: r.message.content, annotations: [] }] });
      r.message.tool_calls.forEach((c, i) => output.push({ id: `${id}_c${i}`, kind: 'output', type: 'function_call', callId: c.id || `${id}_call${i}`, name: c.name, arguments: c.arguments || '{}', status: 'completed' }));
      return { id, createdAt: Date.now(), output, status: 'completed' };
    }, (e: unknown): AgLlmResponse => ({ id, createdAt: Date.now(), output: [], status: 'failed', error: { code: 'LLM_ERROR', message: e instanceof Error ? e.message : 'failed' } }));
    async function* events(): AsyncGenerator<AgAiEvent> {
      const response = await complete;
      for (const item of response.output) {
        if (item.type === 'message') {
          yield { type: 'TEXT_MESSAGE_START', messageId: item.id, role: 'assistant' };
          yield { type: 'TEXT_MESSAGE_CONTENT', messageId: item.id, delta: item.content.map(c => ('text' in c ? c.text : c.refusal)).join('') };
          yield { type: 'TEXT_MESSAGE_END', messageId: item.id };
        } else if (item.type === 'function_call') {
          yield { type: 'TOOL_CALL_START', toolCallId: item.callId, toolCallName: item.name };
          yield { type: 'TOOL_CALL_ARGS', toolCallId: item.callId, delta: item.arguments };
          yield { type: 'TOOL_CALL_END', toolCallId: item.callId };
        }
      }
    }
    return { stream: { [Symbol.asyncIterator]: () => events() }, complete };
  },
};

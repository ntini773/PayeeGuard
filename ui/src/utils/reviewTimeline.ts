import type { AiReviewEvent } from '../api/client';

export interface ReviewStep {
  id: number;
  title: string;
  detail?: string;
  tool?: string;
  state: 'done' | 'running' | 'waiting' | 'blocked' | 'error';
}

const TOOL_TEXT: Record<string, string> = {
  get_case_status: 'Reading the case status',
  get_seller_claims: "Reading the seller's messages",
  get_missing_evidence: 'Checking what evidence is missing',
  get_recent_payouts: 'Asking PayPal about recent payouts',
  get_account_audit: 'Checking account activity',
};

/** Presentation only. Tool completion requires an actual tool_result event. */
export function reviewSteps(events: AiReviewEvent[], running: boolean): ReviewStep[] {
  const steps: ReviewStep[] = [];
  for (const event of events) {
    const tool = event.label.replace(/^Calling /, '');
    if (event.kind === 'tool_result') {
      // Match the latest unfinished invocation; repeated tool calls stay distinct.
      const pending = [...steps].reverse().find(step => step.tool === tool && step.state === 'waiting');
      if (pending) {
        pending.state = 'done';
        pending.detail = event.detail;
      } else {
        steps.push({ id: event.seq, title: TOOL_TEXT[tool] ?? tool, detail: event.detail, tool, state: 'done' });
      }
      continue;
    }
    const previous = steps[steps.length - 1];
    // A model phase has progressed when a subsequent event arrives; never use
    // this rule for tool calls, whose completion must be explicitly reported.
    if (previous && !previous.tool && previous.state === 'waiting' && event.kind !== 'error') previous.state = 'done';
    steps.push({
      id: event.seq,
      title: event.kind === 'tool' ? TOOL_TEXT[tool] ?? event.label : event.label,
      detail: event.detail,
      ...(event.kind === 'tool' ? { tool } : {}),
      state: event.kind === 'error' ? 'error' : event.kind === 'denied' ? 'blocked'
        : event.kind === 'start' || event.kind === 'final' ? 'done' : 'waiting',
    });
  }
  if (running) {
    const last = steps[steps.length - 1];
    if (last?.state === 'waiting') last.state = 'running';
    else steps.push({ id: -1, title: 'Waiting for the next update', state: 'running' });
  }
  return steps;
}

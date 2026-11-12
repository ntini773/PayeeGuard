import { describe, expect, it } from 'vitest';
import { reviewSteps } from '../utils/reviewTimeline';
import type { AiReviewEvent } from '../api/client';
const e = (seq: number, kind: string, label: string, detail?: string): AiReviewEvent => ({ seq, at: seq, kind, label, detail });

describe('Review progress uses backend events', () => {
  it('updates the tool node in place only when its result arrives', () => {
    const call = e(1, 'tool', 'Calling get_case_status');
    expect(reviewSteps([call], true)[0].state).toBe('running');
    const steps = reviewSteps([call, e(2, 'tool_result', 'get_case_status', 'HOLD'), e(3, 'model', 'AI is thinking')], true);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ id: 1, state: 'done', detail: 'HOLD' });
    expect(steps[1].state).toBe('running');
  });
  it('never paints a failed or unanswered tool call as complete', () => {
    const steps = reviewSteps([e(1, 'tool', 'Calling get_recent_payouts'), e(2, 'error', 'Review failed')], false);
    expect(steps.map(s => s.state)).toEqual(['waiting', 'error']);
  });
  it('keeps repeat invocations separate and tool denial visibly blocked', () => {
    const steps = reviewSteps([e(1, 'tool', 'Calling get_case_status'), e(2, 'tool_result', 'get_case_status'), e(3, 'tool', 'Calling get_case_status'), e(4, 'denied', 'No write access')], false);
    expect(steps.map(s => s.state)).toEqual(['done', 'waiting', 'blocked']);
  });
  it('shows waiting animation before the first update and stops on completion', () => {
    expect(reviewSteps([], true)[0].state).toBe('running');
    const steps = reviewSteps([e(1, 'model', 'AI is thinking'), e(2, 'final', 'Assessment saved')], false);
    expect(steps.map(s => s.state)).toEqual(['done', 'done']);
    expect(reviewSteps([], false)).toEqual([]);
  });
});

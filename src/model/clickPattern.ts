import type { TaskState } from './types';
export const CLICK_DELAY = 320;
export const CLICK_STATES = {
  left: 'done',
  leftDouble: 'inProgress',
  right: 'blank',
  rightDouble: 'delayed',
} as const;
const pendingPatterns = new Set<StateClickPattern>();
export function flushPendingStateChanges() {
  for (const pattern of [...pendingPatterns]) pattern.flush();
}
export class StateClickPattern {
  private pending: 0 | 2 | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private change: (state: TaskState) => void) {}
  click(button: 0 | 2) {
    if (this.pending === button) {
      this.dispose();
      this.change(
        button === 0 ? CLICK_STATES.leftDouble : CLICK_STATES.rightDouble,
      );
      return;
    }
    if (this.pending !== null) {
      const previous = this.pending;
      this.dispose();
      this.change(previous === 0 ? CLICK_STATES.left : CLICK_STATES.right);
    }
    this.pending = button;
    pendingPatterns.add(this);
    this.timer = setTimeout(() => this.flush(), CLICK_DELAY);
  }
  flush() {
    if (this.pending === null) return;
    const button = this.pending;
    this.dispose();
    this.change(button === 0 ? CLICK_STATES.left : CLICK_STATES.right);
  }
  dispose() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
    pendingPatterns.delete(this);
  }
}

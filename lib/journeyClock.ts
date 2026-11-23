// The caller supplies monotonic milliseconds, visibility and focus.
export const idleLimitMs = 60_000;
export class JourneyClock {
  private cursor: number;
  private lastInteraction: number;
  private remainder = 0;
  constructor(now: number, private foreground: boolean) {
    this.cursor = this.lastInteraction = now;
  }
  private advance(now: number) {
    const end = Math.min(now, this.lastInteraction + idleLimitMs);
    if (this.foreground) this.remainder += Math.max(0, end - this.cursor);
    this.cursor = now;
  }
  take(now: number): number {
    this.advance(now);
    const seconds = Math.floor(this.remainder / 1000);
    this.remainder -= seconds * 1000;
    return seconds;
  }
  interact(now: number) {
    // Advance past the idle gap before restarting the activity window.
    this.advance(now);
    this.lastInteraction = now;
  }
  focus(now: number, foreground: boolean) {
    this.cursor = now;
    if (foreground && !this.foreground) this.lastInteraction = now;
    this.foreground = foreground;
  }
  resetFraction() { this.remainder = 0; }
}

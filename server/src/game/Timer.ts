import type { PieceColor, TimerState } from './types.js';

export type TimeControl = 'bullet' | 'blitz-3' | 'blitz-5' | 'rapid-7' | 'standard' | 'custom';

export interface TimeControlSettings {
  initialTime: number;  // ms
  increment: number;    // ms per move
}

export const TIME_CONTROLS: Record<Exclude<TimeControl, 'custom'>, TimeControlSettings> = {
  bullet: { initialTime: 60 * 1000, increment: 0 },              // 1+0
  'blitz-3': { initialTime: 3 * 60 * 1000, increment: 0 },       // 3+0
  'blitz-5': { initialTime: 5 * 60 * 1000, increment: 0 },       // 5+0
  'rapid-7': { initialTime: 7 * 60 * 1000, increment: 0 },       // 7+0
  standard: { initialTime: 7 * 60 * 1000, increment: 5 * 1000 }, // 7+5 (default)
};

export class GameTimer {
  private whiteTime: number;
  private blackTime: number;
  private increment: number;
  private activeColor: PieceColor | null = null;
  private lastTick: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private onTimeout: ((color: PieceColor) => void) | null = null;
  private onTick: ((state: TimerState) => void) | null = null;

  constructor(timeControl: TimeControl = 'standard', customSettings?: TimeControlSettings) {
    if (timeControl === 'custom' && customSettings) {
      this.whiteTime = customSettings.initialTime;
      this.blackTime = customSettings.initialTime;
      this.increment = customSettings.increment;
    } else {
      const settings = TIME_CONTROLS[timeControl as Exclude<TimeControl, 'custom'>] || TIME_CONTROLS.standard;
      this.whiteTime = settings.initialTime;
      this.blackTime = settings.initialTime;
      this.increment = settings.increment;
    }
  }

  setCallbacks(
    onTimeout: (color: PieceColor) => void,
    onTick: (state: TimerState) => void
  ): void {
    this.onTimeout = onTimeout;
    this.onTick = onTick;
  }

  start(color: PieceColor): void {
    this.activeColor = color;
    this.lastTick = Date.now();

    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Tick every 100ms for smooth updates
    this.intervalId = setInterval(() => this.tick(), 100);
  }

  private tick(): void {
    if (!this.activeColor) return;

    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;

    if (this.activeColor === 'white') {
      this.whiteTime -= elapsed;
      if (this.whiteTime <= 0) {
        this.whiteTime = 0;
        this.stop();
        this.onTimeout?.('white');
        return;
      }
    } else {
      this.blackTime -= elapsed;
      if (this.blackTime <= 0) {
        this.blackTime = 0;
        this.stop();
        this.onTimeout?.('black');
        return;
      }
    }

    this.onTick?.(this.getTime());
  }

  switchTurn(): void {
    if (!this.activeColor) return;

    // Update time one last time
    const now = Date.now();
    const elapsed = now - this.lastTick;

    if (this.activeColor === 'white') {
      this.whiteTime -= elapsed;
      this.whiteTime += this.increment; // Add increment
      this.activeColor = 'black';
    } else {
      this.blackTime -= elapsed;
      this.blackTime += this.increment; // Add increment
      this.activeColor = 'white';
    }

    this.lastTick = now;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeColor = null;
  }

  pause(): void {
    if (this.intervalId) {
      // Update time before pausing
      if (this.activeColor) {
        const elapsed = Date.now() - this.lastTick;
        if (this.activeColor === 'white') {
          this.whiteTime -= elapsed;
        } else {
          this.blackTime -= elapsed;
        }
      }
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume(): void {
    if (this.activeColor && !this.intervalId) {
      this.lastTick = Date.now();
      this.intervalId = setInterval(() => this.tick(), 100);
    }
  }

  getTime(): TimerState {
    // Return current time including elapsed time since last tick
    let white = this.whiteTime;
    let black = this.blackTime;

    if (this.activeColor && this.lastTick) {
      const elapsed = Date.now() - this.lastTick;
      if (this.activeColor === 'white') {
        white -= elapsed;
      } else {
        black -= elapsed;
      }
    }

    return {
      white: Math.max(0, white),
      black: Math.max(0, black),
    };
  }

  getActiveColor(): PieceColor | null {
    return this.activeColor;
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

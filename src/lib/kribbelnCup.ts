export const CUP_PREPARE_MS = 260;
export const CUP_READY_MS = 80;

export interface CupVector { x: number; y: number; z: number }
export interface CupMotionSample {
  time: number;
  acceleration?: CupVector;
  includingGravity?: CupVector;
  rotation?: { beta: number; gamma: number };
}

const length = (v: CupVector) => Math.hypot(v.x, v.y, v.z);
const dot = (a: CupVector, b: CupVector) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (v: CupVector): CupVector => { const size = length(v) || 1; return { x: v.x / size, y: v.y / size, z: v.z / size }; };

/** Three changes of direction arm the cup; a subsequent calm tilt casts once. */
export class CupMotionGesture {
  private peaks: number[] = [];
  private direction?: CupVector;
  private gravity?: CupVector;
  private baseline?: CupVector;
  private armedAt?: number;
  private fired = false;
  private lastShake = -Infinity;

  reset() { this.peaks = []; this.direction = this.gravity = this.baseline = undefined; this.armedAt = undefined; this.fired = false; this.lastShake = -Infinity; }
  arm(time: number) { this.armedAt = time; this.baseline = undefined; this.fired = false; }

  feed(sample: CupMotionSample): "shake" | "throw" | undefined {
    if (this.fired || !Number.isFinite(sample.time)) return;
    let linear = sample.acceleration;
    if (sample.includingGravity) {
      this.gravity ??= { ...sample.includingGravity };
      linear ??= { x: sample.includingGravity.x - this.gravity.x, y: sample.includingGravity.y - this.gravity.y, z: sample.includingGravity.z - this.gravity.z };
      this.gravity = { x: this.gravity.x * .85 + sample.includingGravity.x * .15, y: this.gravity.y * .85 + sample.includingGravity.y * .15, z: this.gravity.z * .85 + sample.includingGravity.z * .15 };
    }
    const strength = linear ? length(linear) : 0;
    if (this.armedAt !== undefined) {
      if (strength < 6 && sample.includingGravity) {
        const gravity = sample.acceleration
          ? { x: sample.includingGravity.x - sample.acceleration.x, y: sample.includingGravity.y - sample.acceleration.y, z: sample.includingGravity.z - sample.acceleration.z }
          : sample.includingGravity;
        if (length(gravity) > 6) {
          this.baseline ??= unit(gravity);
          if (sample.time - this.armedAt > 300 && dot(this.baseline, unit(gravity)) < Math.cos(40 * Math.PI / 180)) {
            this.fired = true; return "throw";
          }
        }
      }
      const turning = Math.max(Math.abs(sample.rotation?.beta ?? 0), Math.abs(sample.rotation?.gamma ?? 0));
      if (strength < 8 && turning > 155 && sample.time - this.armedAt > 300) { this.fired = true; return "throw"; }
      if (strength > 11 && sample.time - this.lastShake > 220) { this.lastShake = sample.time; return "shake"; }
      return;
    }
    if (!linear || strength < 11) return;
    this.peaks = this.peaks.filter(time => sample.time - time < 1200);
    if (!this.peaks.length) this.direction = undefined;
    const direction = unit(linear);
    if (sample.time - (this.peaks.at(-1) ?? -Infinity) < 110 || (this.direction && dot(direction, this.direction) > .35)) return;
    this.peaks.push(sample.time); this.direction = direction;
    if (this.peaks.length >= 3) { this.arm(sample.time); this.lastShake = sample.time; return "shake"; }
  }
}

export function isCupSwipe(dx: number, dy: number, milliseconds: number) {
  return dy >= 52 && dy > Math.abs(dx) * .8 && milliseconds > 0 && milliseconds < 1100 && dy / milliseconds > .12;
}

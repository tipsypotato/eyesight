/** Adapted from Dental Scope src/engine/animator.ts (MIT; see THIRD_PARTY_NOTICES.md). */
type Animation = { t: number; duration: number; step: (progress: number) => void };
export class Animator {
  private animations = new Map<string, Animation>();
  reducedMotion = false;
  run(key: string, duration: number, step: Animation['step']) {
    this.cancel(key);
    if (this.reducedMotion || duration <= 0) { step(1); return; }
    this.animations.set(key, { t: 0, duration, step });
  }
  cancel(key: string) { this.animations.delete(key); }
  get active() { return this.animations.size > 0; }
  tick(dt: number) {
    for (const [key, animation] of this.animations) {
      animation.t = Math.min(1, animation.t + dt / animation.duration);
      const t = animation.t;
      animation.step(t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
      if (t >= 1) this.animations.delete(key);
    }
  }
}

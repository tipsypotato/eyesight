import { describe, expect, it } from 'vitest';
import { Animator } from './animator';

describe('camera animation lifecycle', () => {
  it('replaces a running movement and ends without a permanent render loop', () => {
    const animator = new Animator();
    let oldProgress = 0;
    let newProgress = 0;
    animator.run('camera', 1, k => { oldProgress = k; });
    animator.tick(0.5);
    expect(oldProgress).toBe(0.5);
    animator.run('camera', 1, k => { newProgress = k; });
    animator.tick(1);
    expect(oldProgress).toBe(0.5);
    expect(newProgress).toBe(1);
    expect(animator.active).toBe(false);
  });

  it('uses an immediate final pose with reduced motion and cancels old movement', () => {
    const animator = new Animator();
    let progress = 0;
    animator.run('camera', 1, () => { progress = -1; });
    animator.reducedMotion = true;
    animator.run('camera', 1, k => { progress = k; });
    animator.tick(1);
    expect(progress).toBe(1);
    expect(animator.active).toBe(false);
  });
});

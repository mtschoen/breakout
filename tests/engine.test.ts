import { describe, expect, it, vi } from 'vitest';
import {
  circleIntersectsRectangle,
  computePaddleBounceVelocity,
  rectanglesOverlap,
  reflectVelocity,
} from '../src/engine/collision';
import { InputState, type InputEventTarget } from '../src/engine/input';
import { MAXIMUM_DELTA_SECONDS, startLoop, type FrameScheduler } from '../src/engine/loop';
import { createRandom } from '../src/engine/random';
import type { RectangleBounds } from '../src/game/types';

class MockEventTarget implements InputEventTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    let typeListeners = this.listeners.get(type);
    if (!typeListeners) {
      typeListeners = new Set<EventListener>();
      this.listeners.set(type, typeListeners);
    }
    typeListeners.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.delete(listener);
    }
  }

  dispatchEvent(type: string, event: Event): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class MockFrameScheduler implements FrameScheduler {
  private nextFrameIdentifier = 1;
  private readonly pendingCallbacks = new Map<number, (timestampMilliseconds: number) => void>();

  requestFrame(callback: (timestampMilliseconds: number) => void): number {
    const frameIdentifier = this.nextFrameIdentifier;
    this.nextFrameIdentifier += 1;
    this.pendingCallbacks.set(frameIdentifier, callback);
    return frameIdentifier;
  }

  cancelFrame(frameIdentifier: number): void {
    this.pendingCallbacks.delete(frameIdentifier);
  }

  flushFrame(timestampMilliseconds: number): void {
    const callbacksToRun = Array.from(this.pendingCallbacks.values());
    this.pendingCallbacks.clear();
    for (const callback of callbacksToRun) {
      callback(timestampMilliseconds);
    }
  }

  get pendingCount(): number {
    return this.pendingCallbacks.size;
  }
}

function createMockKeyboardEvent(options: {
  code?: string;
  key?: string;
  repeat?: boolean;
}): Event {
  let defaultPrevented = false;
  return {
    code: options.code ?? '',
    key: options.key ?? '',
    repeat: options.repeat ?? false,
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented(): boolean {
      return defaultPrevented;
    },
  } as unknown as Event;
}

describe('Mulberry32 PRNG (random.ts)', () => {
  it('exposes initial seed property', () => {
    const random = createRandom(1337);
    expect(random.seed).toBe(1337);
  });

  it('produces deterministic output with identical seeds', () => {
    const firstGenerator = createRandom(42);
    const secondGenerator = createRandom(42);

    const firstSequence = Array.from({ length: 20 }, () => firstGenerator.next());
    const secondSequence = Array.from({ length: 20 }, () => secondGenerator.next());

    expect(firstSequence).toEqual(secondSequence);
  });

  it('produces different sequences with different seeds', () => {
    const firstGenerator = createRandom(1);
    const secondGenerator = createRandom(2);

    const firstSequence = Array.from({ length: 20 }, () => firstGenerator.next());
    const secondSequence = Array.from({ length: 20 }, () => secondGenerator.next());

    expect(firstSequence).not.toEqual(secondSequence);
  });

  it('generates float numbers in range [0, 1)', () => {
    const random = createRandom(9999);
    for (let iterationIndex = 0; iterationIndex < 1000; iterationIndex += 1) {
      const generatedFloat = random.next();
      expect(generatedFloat).toBeGreaterThanOrEqual(0);
      expect(generatedFloat).toBeLessThan(1);
    }
  });

  it('generates floats within custom range', () => {
    const random = createRandom(500);
    for (let iterationIndex = 0; iterationIndex < 200; iterationIndex += 1) {
      const value = random.range(10.5, 20.5);
      expect(value).toBeGreaterThanOrEqual(10.5);
      expect(value).toBeLessThanOrEqual(20.5);
    }
  });

  it('returns minimum when range minimum equals maximum', () => {
    const random = createRandom(123);
    expect(random.range(7, 7)).toBe(7);
  });

  it('throws RangeError when range maximum is less than minimum', () => {
    const random = createRandom(123);
    expect(() => random.range(10, 5)).toThrow(RangeError);
  });

  it('generates integers inclusive of bounds', () => {
    const random = createRandom(777);
    const observedIntegers = new Set<number>();

    for (let iterationIndex = 0; iterationIndex < 500; iterationIndex += 1) {
      const value = random.integer(3, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      observedIntegers.add(value);
    }

    expect(observedIntegers.has(3)).toBe(true);
    expect(observedIntegers.has(4)).toBe(true);
    expect(observedIntegers.has(5)).toBe(true);
    expect(observedIntegers.has(6)).toBe(true);
  });

  it('returns boundary value when integer minimum equals maximum', () => {
    const random = createRandom(123);
    expect(random.integer(42, 42)).toBe(42);
  });

  it('throws RangeError for invalid integer inputs', () => {
    const random = createRandom(123);
    expect(() => random.integer(10, 2)).toThrow(RangeError);
    expect(() => random.integer(1.5, 4)).toThrow(RangeError);
    expect(() => random.integer(1, 4.2)).toThrow(RangeError);
  });

  it('evaluates chances accurately for extremes', () => {
    const random = createRandom(123);
    expect(random.chance(0)).toBe(false);
    expect(random.chance(1)).toBe(true);
  });

  it('throws RangeError for out of bound probabilities', () => {
    const random = createRandom(123);
    expect(() => random.chance(-0.1)).toThrow(RangeError);
    expect(() => random.chance(1.1)).toThrow(RangeError);
    expect(() => random.chance(Number.NaN)).toThrow(RangeError);
  });

  it('picks elements from an array uniformly', () => {
    const random = createRandom(888);
    const options = ['alpha', 'bravo', 'charlie'];
    const chosenCounts = new Map<string, number>();

    for (let iterationIndex = 0; iterationIndex < 300; iterationIndex += 1) {
      const picked = random.pick(options);
      chosenCounts.set(picked, (chosenCounts.get(picked) ?? 0) + 1);
    }

    expect(chosenCounts.get('alpha')).toBeGreaterThan(0);
    expect(chosenCounts.get('bravo')).toBeGreaterThan(0);
    expect(chosenCounts.get('charlie')).toBeGreaterThan(0);
  });

  it('picks the single element of a single-element array', () => {
    const random = createRandom(123);
    expect(random.pick(['solitary'])).toBe('solitary');
  });

  it('throws RangeError when picking from an empty array', () => {
    const random = createRandom(123);
    expect(() => random.pick([])).toThrow(RangeError);
  });
});

describe('Collision and bounce math (collision.ts)', () => {
  const rectangle: RectangleBounds = {
    x: 100,
    y: 100,
    width: 80,
    height: 40,
  };

  it('detects a miss when circle is far away', () => {
    const hitResult = circleIntersectsRectangle(50, 50, 10, rectangle);
    expect(hitResult.hit).toBe(false);
    expect(hitResult.normalX).toBe(0);
    expect(hitResult.normalY).toBe(0);
    expect(hitResult.penetration).toBe(0);
    expect(hitResult.contactX).toBe(100);
    expect(hitResult.contactY).toBe(100);
  });

  it('detects an external hit against left edge', () => {
    const hitResult = circleIntersectsRectangle(95, 120, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBeCloseTo(-1);
    expect(hitResult.normalY).toBeCloseTo(0);
    expect(hitResult.penetration).toBeCloseTo(5);
    expect(hitResult.contactX).toBe(100);
    expect(hitResult.contactY).toBe(120);
  });

  it('detects an external hit against right edge', () => {
    const hitResult = circleIntersectsRectangle(185, 120, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBeCloseTo(1);
    expect(hitResult.normalY).toBeCloseTo(0);
    expect(hitResult.penetration).toBeCloseTo(5);
    expect(hitResult.contactX).toBe(180);
    expect(hitResult.contactY).toBe(120);
  });

  it('detects an external hit against top edge', () => {
    const hitResult = circleIntersectsRectangle(140, 95, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBeCloseTo(0);
    expect(hitResult.normalY).toBeCloseTo(-1);
    expect(hitResult.penetration).toBeCloseTo(5);
    expect(hitResult.contactX).toBe(140);
    expect(hitResult.contactY).toBe(100);
  });

  it('detects an external hit against bottom edge', () => {
    const hitResult = circleIntersectsRectangle(140, 145, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBeCloseTo(0);
    expect(hitResult.normalY).toBeCloseTo(1);
    expect(hitResult.penetration).toBeCloseTo(5);
    expect(hitResult.contactX).toBe(140);
    expect(hitResult.contactY).toBe(140);
  });

  it('detects an external hit at diagonal corner', () => {
    const hitResult = circleIntersectsRectangle(96, 96, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.contactX).toBe(100);
    expect(hitResult.contactY).toBe(100);
    expect(hitResult.normalX).toBeLessThan(0);
    expect(hitResult.normalY).toBeLessThan(0);
    const normalMagnitude = Math.sqrt(
      hitResult.normalX * hitResult.normalX + hitResult.normalY * hitResult.normalY,
    );
    expect(normalMagnitude).toBeCloseTo(1);
  });

  it('resolves hit when circle center is inside near left edge', () => {
    const hitResult = circleIntersectsRectangle(105, 120, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBe(-1);
    expect(hitResult.normalY).toBe(0);
    expect(hitResult.penetration).toBe(15);
    expect(hitResult.contactX).toBe(100);
    expect(hitResult.contactY).toBe(120);
  });

  it('resolves hit when circle center is inside near right edge', () => {
    const hitResult = circleIntersectsRectangle(175, 120, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBe(1);
    expect(hitResult.normalY).toBe(0);
    expect(hitResult.penetration).toBe(15);
    expect(hitResult.contactX).toBe(180);
    expect(hitResult.contactY).toBe(120);
  });

  it('resolves hit when circle center is inside near top edge', () => {
    const hitResult = circleIntersectsRectangle(140, 105, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBe(0);
    expect(hitResult.normalY).toBe(-1);
    expect(hitResult.penetration).toBe(15);
    expect(hitResult.contactX).toBe(140);
    expect(hitResult.contactY).toBe(100);
  });

  it('resolves hit when circle center is inside near bottom edge', () => {
    const hitResult = circleIntersectsRectangle(140, 135, 10, rectangle);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.normalX).toBe(0);
    expect(hitResult.normalY).toBe(1);
    expect(hitResult.penetration).toBe(15);
    expect(hitResult.contactX).toBe(140);
    expect(hitResult.contactY).toBe(140);
  });

  it('evaluates rectangle overlaps correctly', () => {
    const firstRectangle: RectangleBounds = {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    };
    const overlappingRectangle: RectangleBounds = {
      x: 25,
      y: 25,
      width: 50,
      height: 50,
    };
    const separatedRectangle: RectangleBounds = {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    };
    const edgeTouchingRectangle: RectangleBounds = {
      x: 50,
      y: 0,
      width: 50,
      height: 50,
    };

    expect(rectanglesOverlap(firstRectangle, overlappingRectangle)).toBe(true);
    expect(rectanglesOverlap(firstRectangle, separatedRectangle)).toBe(false);
    expect(rectanglesOverlap(firstRectangle, edgeTouchingRectangle)).toBe(false);
  });

  it('reflects velocity across normal when moving toward surface', () => {
    const bounced = reflectVelocity(100, 100, 0, -1);
    expect(bounced.x).toBe(100);
    expect(bounced.y).toBe(-100);
  });

  it('leaves velocity unchanged when moving away from surface', () => {
    const unchanged = reflectVelocity(100, -100, 0, -1);
    expect(unchanged.x).toBe(100);
    expect(unchanged.y).toBe(-100);
  });

  it('computes paddle bounce velocity for center hit', () => {
    const speed = 400;
    const velocity = computePaddleBounceVelocity(140, 100, 80, 0, speed);
    expect(velocity.x).toBeCloseTo(0);
    expect(velocity.y).toBeCloseTo(-speed);
  });

  it('computes paddle bounce velocity for right edge hit', () => {
    const speed = 400;
    const velocity = computePaddleBounceVelocity(180, 100, 80, 0, speed);
    const expectedAngle = (62 * Math.PI) / 180;
    expect(velocity.x).toBeCloseTo(Math.sin(expectedAngle) * speed);
    expect(velocity.y).toBeCloseTo(-Math.cos(expectedAngle) * speed);
  });

  it('applies paddle velocity english adjustment to bounce', () => {
    const speed = 400;
    const centerHitNeutral = computePaddleBounceVelocity(140, 100, 80, 0, speed);
    const centerHitMovingRight = computePaddleBounceVelocity(140, 100, 80, 480, speed);
    expect(centerHitMovingRight.x).toBeGreaterThan(centerHitNeutral.x);
  });

  it('clamps english adjustment to safe bounds', () => {
    const speed = 300;
    const extremeSpeedRight = computePaddleBounceVelocity(140, 100, 80, 100000, speed);
    const expectedAdjustmentAngle = 0.18 * ((62 * Math.PI) / 180);
    expect(extremeSpeedRight.x).toBeCloseTo(Math.sin(expectedAdjustmentAngle) * speed);
  });
});

describe('Clamped game loop (loop.ts)', () => {
  it('exposes maximum delta seconds constant', () => {
    expect(MAXIMUM_DELTA_SECONDS).toBe(1 / 30);
  });

  it('drives update and render through scheduler with clamped delta', () => {
    const scheduler = new MockFrameScheduler();
    const updateDeltas: number[] = [];
    const renderDeltas: number[] = [];

    const stopLoop = startLoop(
      (deltaSeconds) => {
        updateDeltas.push(deltaSeconds);
      },
      (deltaSeconds) => {
        renderDeltas.push(deltaSeconds);
      },
      scheduler,
    );

    expect(scheduler.pendingCount).toBe(1);

    // Initial frame establishes baseline timestamp with zero delta
    scheduler.flushFrame(1000);
    expect(updateDeltas).toEqual([0]);
    expect(renderDeltas).toEqual([0]);
    expect(scheduler.pendingCount).toBe(1);

    // Second frame advances by 16ms
    scheduler.flushFrame(1016);
    expect(updateDeltas.length).toBe(2);
    expect(updateDeltas[1]).toBeCloseTo(0.016);
    expect(renderDeltas.length).toBe(2);
    expect(renderDeltas[1]).toBeCloseTo(0.016);

    // Third frame experiences large 2000ms pause (clamped to MAXIMUM_DELTA_SECONDS)
    scheduler.flushFrame(3016);
    expect(updateDeltas.length).toBe(3);
    expect(updateDeltas[2]).toBeCloseTo(MAXIMUM_DELTA_SECONDS);
    expect(renderDeltas.length).toBe(3);
    expect(renderDeltas[2]).toBeCloseTo(MAXIMUM_DELTA_SECONDS);

    stopLoop();
    expect(scheduler.pendingCount).toBe(0);

    // Flushing after stop should not invoke callbacks
    scheduler.flushFrame(4000);
    expect(updateDeltas.length).toBe(3);
  });

  it('clamps negative elapsed time to zero when clock moves backward', () => {
    const scheduler = new MockFrameScheduler();
    const updateDeltas: number[] = [];

    const stopLoop = startLoop(
      (deltaSeconds) => {
        updateDeltas.push(deltaSeconds);
      },
      () => {},
      scheduler,
    );

    scheduler.flushFrame(2000);
    scheduler.flushFrame(1900); // Clock moved backwards

    expect(updateDeltas[0]).toBe(0);
    expect(updateDeltas[1]).toBe(0);

    stopLoop();
  });

  it('halts immediately when stop is invoked inside render callback', () => {
    const scheduler = new MockFrameScheduler();
    let secondUpdateInvoked = false;
    let stopLoopReference: (() => void) | null = null;

    stopLoopReference = startLoop(
      () => {
        if (stopLoopReference && secondUpdateInvoked) {
          // should not reach here on next frame
        }
      },
      () => {
        if (stopLoopReference) {
          stopLoopReference();
        }
      },
      scheduler,
    );

    scheduler.flushFrame(1000);
    expect(scheduler.pendingCount).toBe(0);
    secondUpdateInvoked = true;
    scheduler.flushFrame(1016);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('halts immediately when stop is invoked inside update callback', () => {
    const scheduler = new MockFrameScheduler();
    let renderInvoked = false;
    let stopLoopReference: (() => void) | null = null;

    stopLoopReference = startLoop(
      () => {
        if (stopLoopReference) {
          stopLoopReference();
        }
      },
      () => {
        renderInvoked = true;
      },
      scheduler,
    );

    scheduler.flushFrame(1000);
    expect(renderInvoked).toBe(false);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('can start and stop with default frame scheduler using timer fallback', () => {
    let updateInvoked = false;
    const stopLoop = startLoop(
      () => {
        updateInvoked = true;
      },
      () => {},
    );
    expect(typeof stopLoop).toBe('function');
    stopLoop();
    // Subsequent stop invocation is idempotent
    expect(() => stopLoop()).not.toThrow();
    expect(updateInvoked).toBe(false);
  });

  it('triggers update when timeout fires in fallback scheduler', () => {
    vi.useFakeTimers();
    try {
      let updateInvoked = false;
      const stopLoop = startLoop(
        () => {
          updateInvoked = true;
        },
        () => {},
      );
      vi.advanceTimersByTime(20);
      expect(updateInvoked).toBe(true);
      stopLoop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns early when frame callback runs after loop has stopped', () => {
    let capturedCallback: ((timestampMilliseconds: number) => void) | null = null;
    const scheduler: FrameScheduler = {
      requestFrame(callback) {
        capturedCallback = callback;
        return 1;
      },
      cancelFrame() {},
    };
    let updateInvoked = false;
    const stopLoop = startLoop(
      () => {
        updateInvoked = true;
      },
      () => {},
      scheduler,
    );
    stopLoop();
    if (capturedCallback) {
      (capturedCallback as (timestampMilliseconds: number) => void)(1000);
    }
    expect(updateInvoked).toBe(false);
  });

  it('uses browser requestAnimationFrame when available in environment', () => {
    let requestedCallback: ((timestampMilliseconds: number) => void) | null = null;
    let cancelledIdentifier: number | null = null;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      requestedCallback = callback as (timestampMilliseconds: number) => void;
      return 42;
    };
    globalThis.cancelAnimationFrame = (identifier: number): void => {
      cancelledIdentifier = identifier;
    };

    try {
      const stopLoop = startLoop(
        () => {},
        () => {},
      );
      expect(typeof requestedCallback).toBe('function');
      stopLoop();
      expect(cancelledIdentifier).toBe(42);
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});

describe('Input state module (input.ts)', () => {
  it('initializes with neutral state and unattached status', () => {
    const input = new InputState();
    expect(input.attached).toBe(false);
    expect(input.axisX).toBe(0);
    expect(input.launchHeld).toBe(false);
    expect(input.consumeLaunchPressed()).toBe(false);
    expect(input.consumePausePressed()).toBe(false);
    expect(input.pointerPlayfieldX).toBeNull();
  });

  it('attaches and detaches event listeners on mock target', () => {
    const target = new MockEventTarget();
    const input = new InputState();

    input.attach(target);
    expect(input.attached).toBe(true);
    expect(target.listenerCount('keydown')).toBe(1);
    expect(target.listenerCount('keyup')).toBe(1);
    expect(target.listenerCount('blur')).toBe(1);

    // Re-attaching detaches previous target first
    const secondaryTarget = new MockEventTarget();
    input.attach(secondaryTarget);
    expect(target.listenerCount('keydown')).toBe(0);
    expect(secondaryTarget.listenerCount('keydown')).toBe(1);

    input.detach();
    expect(input.attached).toBe(false);
    expect(secondaryTarget.listenerCount('keydown')).toBe(0);

    // Redundant detach is safe
    expect(() => input.detach()).not.toThrow();
  });

  it('handles attach with undefined target gracefully when window is undefined', () => {
    const input = new InputState();
    input.attach(undefined);
    expect(input.attached).toBe(false);
  });

  it('tracks horizontal axis via keyboard events', () => {
    const target = new MockEventTarget();
    const input = new InputState();
    input.attach(target);

    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'ArrowLeft' }));
    expect(input.axisX).toBe(-1);

    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'ArrowRight' }));
    expect(input.axisX).toBe(0);

    target.dispatchEvent('keyup', createMockKeyboardEvent({ code: 'ArrowLeft' }));
    expect(input.axisX).toBe(1);

    target.dispatchEvent('keyup', createMockKeyboardEvent({ code: 'ArrowRight' }));
    expect(input.axisX).toBe(0);
  });

  it('supports KeyA and KeyD controls', () => {
    const target = new MockEventTarget();
    const input = new InputState();
    input.attach(target);

    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'KeyA' }));
    expect(input.axisX).toBe(-1);

    target.dispatchEvent('keyup', createMockKeyboardEvent({ code: 'KeyA' }));
    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'KeyD' }));
    expect(input.axisX).toBe(1);
  });

  it('supports event.key fallbacks when event.code is not present', () => {
    const target = new MockEventTarget();
    const input = new InputState();
    input.attach(target);

    // Left key fallback 'a'
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'a' }));
    expect(input.axisX).toBe(-1);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'a' }));
    expect(input.axisX).toBe(0);

    // Right key fallback 'd'
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'd' }));
    expect(input.axisX).toBe(1);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'd' }));
    expect(input.axisX).toBe(0);

    // Launch key fallback ' '
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: ' ' }));
    expect(input.launchHeld).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(true);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: ' ' }));

    // Launch key fallback 'Spacebar'
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'Spacebar' }));
    expect(input.launchHeld).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(true);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'Spacebar' }));

    // Launch key fallback 'w'
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'w' }));
    expect(input.launchHeld).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(true);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'w' }));

    // Pause key fallback 'p'
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'p' }));
    expect(input.consumePausePressed()).toBe(true);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'p' }));

    // Fallbacks with uppercase letters
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'A' }));
    expect(input.axisX).toBe(-1);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'A' }));

    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'D' }));
    expect(input.axisX).toBe(1);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'D' }));

    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'W' }));
    expect(input.launchHeld).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(true);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'W' }));

    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'P' }));
    expect(input.consumePausePressed()).toBe(true);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'P' }));

    // Direct key names fallback to key
    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'ArrowLeft' }));
    expect(input.axisX).toBe(-1);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'ArrowLeft' }));

    target.dispatchEvent('keydown', createMockKeyboardEvent({ key: 'Escape' }));
    expect(input.consumePausePressed()).toBe(true);
    target.dispatchEvent('keyup', createMockKeyboardEvent({ key: 'Escape' }));

    // Irrelevant key without code or key
    target.dispatchEvent('keydown', {} as Event);
    target.dispatchEvent('keyup', {} as Event);
  });

  it('tracks launch and pause edges without key repetition triggers', () => {
    const target = new MockEventTarget();
    const input = new InputState();
    input.attach(target);

    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'Space' }));
    expect(input.launchHeld).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(true);
    // Consumed edge returns false on subsequent call
    expect(input.consumeLaunchPressed()).toBe(false);

    // Repeated event does not trigger new press edge
    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'Space', repeat: true }));
    expect(input.consumeLaunchPressed()).toBe(false);

    // Pause button edge
    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'Escape' }));
    expect(input.consumePausePressed()).toBe(true);
    expect(input.consumePausePressed()).toBe(false);
  });

  it('clears held keys upon target blur', () => {
    const target = new MockEventTarget();
    const input = new InputState();
    input.attach(target);

    target.dispatchEvent('keydown', createMockKeyboardEvent({ code: 'ArrowLeft' }));
    expect(input.axisX).toBe(-1);

    target.dispatchEvent('blur', new Event('blur'));
    expect(input.axisX).toBe(0);
  });

  it('supports touch controls', () => {
    const input = new InputState();

    input.touchButtonDown('left');
    expect(input.axisX).toBe(-1);
    input.touchButtonUp('left');
    expect(input.axisX).toBe(0);

    input.touchButtonDown('right');
    expect(input.axisX).toBe(1);
    input.touchButtonUp('right');
    expect(input.axisX).toBe(0);

    input.touchButtonDown('launch');
    expect(input.launchHeld).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(false);

    // Re-pressing down while held does not duplicate edge
    input.touchButtonDown('launch');
    expect(input.consumeLaunchPressed()).toBe(false);

    input.touchButtonUp('launch');
    expect(input.launchHeld).toBe(false);
  });

  it('supports pointer coordinates and pointer launch', () => {
    const input = new InputState();

    input.setPointerPlayfieldX(240);
    expect(input.pointerPlayfieldX).toBe(240);

    input.triggerPointerLaunch();
    expect(input.consumeLaunchPressed()).toBe(true);
    expect(input.consumeLaunchPressed()).toBe(false);

    input.setPointerPlayfieldX(null);
    expect(input.pointerPlayfieldX).toBeNull();
  });

  it('clears pressed edges when clearPressedEdges is called', () => {
    const input = new InputState();

    input.triggerPointerLaunch();
    input.touchButtonDown('launch');
    input.clearPressedEdges();

    expect(input.consumeLaunchPressed()).toBe(false);
    expect(input.consumePausePressed()).toBe(false);
  });
});

export type UpdateFunction = (deltaSeconds: number) => void;
export type RenderFunction = (deltaSeconds: number) => void;
export type StopLoopFunction = () => void;

export interface FrameScheduler {
  requestFrame(callback: (timestampMilliseconds: number) => void): number;
  cancelFrame(frameIdentifier: number): void;
}

export const MAXIMUM_DELTA_SECONDS = 1 / 30;

const defaultFrameScheduler: FrameScheduler = {
  requestFrame(callback: (timestampMilliseconds: number) => void): number {
    if (typeof requestAnimationFrame !== 'undefined') {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => {
      callback(Date.now());
    }, 16) as unknown as number;
  },
  cancelFrame(frameIdentifier: number): void {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(frameIdentifier);
      return;
    }
    clearTimeout(frameIdentifier);
  },
};

export function startLoop(
  update: UpdateFunction,
  render: RenderFunction,
  frameScheduler?: FrameScheduler,
): StopLoopFunction {
  const scheduler = frameScheduler ?? defaultFrameScheduler;
  let isRunning = true;
  let previousTimestampMilliseconds: number | null = null;
  let currentFrameIdentifier: number | null = null;

  function onFrame(timestampMilliseconds: number): void {
    if (!isRunning) {
      return;
    }

    const elapsedMilliseconds =
      previousTimestampMilliseconds === null
        ? 0
        : timestampMilliseconds - previousTimestampMilliseconds;
    previousTimestampMilliseconds = timestampMilliseconds;

    const rawDeltaSeconds = elapsedMilliseconds / 1000;
    const deltaSeconds = Math.min(MAXIMUM_DELTA_SECONDS, Math.max(0, rawDeltaSeconds));

    update(deltaSeconds);
    if (!isRunning) {
      return;
    }

    render(deltaSeconds);
    if (!isRunning) {
      return;
    }

    currentFrameIdentifier = scheduler.requestFrame(onFrame);
  }

  currentFrameIdentifier = scheduler.requestFrame(onFrame);

  return function stopLoop(): void {
    if (!isRunning) {
      return;
    }
    isRunning = false;
    if (currentFrameIdentifier !== null) {
      scheduler.cancelFrame(currentFrameIdentifier);
      currentFrameIdentifier = null;
    }
  };
}

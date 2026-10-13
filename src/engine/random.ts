export interface SeededRandom {
  next(): number;
  range(minimum: number, maximum: number): number;
  integer(minimum: number, maximum: number): number;
  chance(probability: number): boolean;
  pick<T>(array: readonly T[]): T;
  readonly seed: number;
}

export function createRandom(seed: number): SeededRandom {
  let internalState = seed | 0;

  function next(): number {
    internalState = (internalState + 0x6d2b79f5) | 0;
    let intermediateValue = Math.imul(internalState ^ (internalState >>> 15), 1 | internalState);
    intermediateValue =
      (intermediateValue +
        Math.imul(intermediateValue ^ (intermediateValue >>> 7), 61 | intermediateValue)) ^
      intermediateValue;
    return ((intermediateValue ^ (intermediateValue >>> 14)) >>> 0) / 4294967296;
  }

  function range(minimum: number, maximum: number): number {
    if (maximum < minimum) {
      throw new RangeError('Maximum cannot be less than minimum.');
    }
    return minimum + next() * (maximum - minimum);
  }

  function integer(minimum: number, maximum: number): number {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum)) {
      throw new RangeError('Minimum and maximum must be integers.');
    }
    if (maximum < minimum) {
      throw new RangeError('Maximum cannot be less than minimum.');
    }
    const integerCount = maximum - minimum + 1;
    const offset = Math.floor(next() * integerCount);
    return Math.min(maximum, minimum + offset);
  }

  function chance(probability: number): boolean {
    if (probability < 0 || probability > 1 || Number.isNaN(probability)) {
      throw new RangeError('Probability must be between 0 and 1 inclusive.');
    }
    return next() < probability;
  }

  function pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new RangeError('Cannot pick an element from an empty array.');
    }
    const selectedIndex = integer(0, array.length - 1);
    return array[selectedIndex];
  }

  return {
    next,
    range,
    integer,
    chance,
    pick,
    seed,
  };
}

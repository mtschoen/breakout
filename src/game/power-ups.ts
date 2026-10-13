import type { PowerUpCapsule, PowerUpKind } from './types';

export interface PowerUpSpecification {
  kind: PowerUpKind;
  label: string;
  displayName: string;
  color: string;
  durationSeconds: number;
  weight: number;
}

export const ALL_POWER_UP_KINDS: readonly PowerUpKind[] = [
  'multiball',
  'wide',
  'laser',
  'pierce',
  'magnet',
  'barrier',
];

export const POWER_UP_SPECIFICATIONS: Readonly<Record<PowerUpKind, PowerUpSpecification>> =
  Object.freeze({
    multiball: {
      kind: 'multiball',
      label: 'M',
      displayName: 'Multi-Ball',
      color: '#38bdf8',
      durationSeconds: 0,
      weight: 25,
    },
    wide: {
      kind: 'wide',
      label: 'W',
      displayName: 'Wide Paddle',
      color: '#34d399',
      durationSeconds: 12,
      weight: 20,
    },
    laser: {
      kind: 'laser',
      label: 'L',
      displayName: 'Twin Laser',
      color: '#f87171',
      durationSeconds: 10,
      weight: 15,
    },
    pierce: {
      kind: 'pierce',
      label: 'F',
      displayName: 'Fireball Pierce',
      color: '#fb923c',
      durationSeconds: 8,
      weight: 15,
    },
    magnet: {
      kind: 'magnet',
      label: 'C',
      displayName: 'Magnet Catch',
      color: '#c084fc',
      durationSeconds: 12,
      weight: 15,
    },
    barrier: {
      kind: 'barrier',
      label: 'S',
      displayName: 'Safety Barrier',
      color: '#facc15',
      durationSeconds: 0,
      weight: 10,
    },
  });

export const POWER_UP_CAPSULE_WIDTH = 30;
export const POWER_UP_CAPSULE_HEIGHT = 16;
export const POWER_UP_CAPSULE_VELOCITY_Y = 135;

export function getPowerUpSpecification(kind: PowerUpKind): PowerUpSpecification {
  return POWER_UP_SPECIFICATIONS[kind];
}

export function pickWeightedPowerUpKind(randomValueZeroToOne: number): PowerUpKind {
  const normalizedRandom = Math.max(0, Math.min(1, randomValueZeroToOne));
  const totalWeight = ALL_POWER_UP_KINDS.reduce(
    (accumulatedTotal, kind) => accumulatedTotal + POWER_UP_SPECIFICATIONS[kind].weight,
    0,
  );
  const targetThreshold = normalizedRandom * totalWeight;

  let accumulatedWeight = 0;
  for (const kind of ALL_POWER_UP_KINDS) {
    accumulatedWeight += POWER_UP_SPECIFICATIONS[kind].weight;
    if (targetThreshold < accumulatedWeight) {
      return kind;
    }
  }

  return ALL_POWER_UP_KINDS[ALL_POWER_UP_KINDS.length - 1];
}

export function createPowerUpCapsule(
  identifier: number,
  centerX: number,
  centerY: number,
  kind: PowerUpKind,
): PowerUpCapsule {
  const specification = getPowerUpSpecification(kind);
  return {
    identifier,
    x: centerX - POWER_UP_CAPSULE_WIDTH / 2,
    y: centerY - POWER_UP_CAPSULE_HEIGHT / 2,
    width: POWER_UP_CAPSULE_WIDTH,
    height: POWER_UP_CAPSULE_HEIGHT,
    velocityY: POWER_UP_CAPSULE_VELOCITY_Y,
    kind,
    color: specification.color,
    label: specification.label,
    alive: true,
  };
}

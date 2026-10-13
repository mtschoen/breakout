import { describe, expect, it } from 'vitest';
import {
  ALL_POWER_UP_KINDS,
  POWER_UP_CAPSULE_HEIGHT,
  POWER_UP_CAPSULE_VELOCITY_Y,
  POWER_UP_CAPSULE_WIDTH,
  POWER_UP_SPECIFICATIONS,
  createPowerUpCapsule,
  getPowerUpSpecification,
  pickWeightedPowerUpKind,
} from '../src/game/power-ups';
import {
  ROW_NEON_PALETTE,
  STAGE_COUNT,
  STAGE_TEMPLATES,
  buildStageDefinition,
  countDestructibleBricks,
  instantiateStageBricks,
} from '../src/game/levels';
import {
  BRICK_COLUMNS,
  BRICK_GAP_X,
  BRICK_GAP_Y,
  BRICK_GRID_OFFSET_X,
  BRICK_GRID_OFFSET_Y,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  type BrickEntity,
} from '../src/game/types';

describe('Power-Up System', () => {
  it('defines all six expected power-up kinds', () => {
    expect(ALL_POWER_UP_KINDS).toEqual([
      'multiball',
      'wide',
      'laser',
      'pierce',
      'magnet',
      'barrier',
    ]);
  });

  it('provides complete and valid specifications for all kinds', () => {
    for (const kind of ALL_POWER_UP_KINDS) {
      const specification = getPowerUpSpecification(kind);
      expect(specification.kind).toBe(kind);
      expect(specification.label.length).toBe(1);
      expect(specification.displayName.length).toBeGreaterThan(0);
      expect(specification.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(specification.weight).toBeGreaterThan(0);
      expect(specification.durationSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches required badges, names, colors, and durations', () => {
    expect(POWER_UP_SPECIFICATIONS.multiball).toMatchObject({
      label: 'M',
      displayName: 'Multi-Ball',
      color: '#38bdf8',
      durationSeconds: 0,
    });
    expect(POWER_UP_SPECIFICATIONS.wide).toMatchObject({
      label: 'W',
      displayName: 'Wide Paddle',
      color: '#34d399',
      durationSeconds: 12,
    });
    expect(POWER_UP_SPECIFICATIONS.laser).toMatchObject({
      label: 'L',
      displayName: 'Twin Laser',
      color: '#f87171',
      durationSeconds: 10,
    });
    expect(POWER_UP_SPECIFICATIONS.pierce).toMatchObject({
      label: 'F',
      displayName: 'Fireball Pierce',
      color: '#fb923c',
      durationSeconds: 8,
    });
    expect(POWER_UP_SPECIFICATIONS.magnet).toMatchObject({
      label: 'C',
      displayName: 'Magnet Catch',
      color: '#c084fc',
      durationSeconds: 12,
    });
    expect(POWER_UP_SPECIFICATIONS.barrier).toMatchObject({
      label: 'S',
      displayName: 'Safety Barrier',
      color: '#facc15',
      durationSeconds: 0,
    });
  });

  it('deterministically selects power-up kinds based on cumulative weights', () => {
    expect(pickWeightedPowerUpKind(0.0)).toBe('multiball');
    expect(pickWeightedPowerUpKind(0.24)).toBe('multiball');
    expect(pickWeightedPowerUpKind(0.25)).toBe('wide');
    expect(pickWeightedPowerUpKind(0.44)).toBe('wide');
    expect(pickWeightedPowerUpKind(0.45)).toBe('laser');
    expect(pickWeightedPowerUpKind(0.59)).toBe('laser');
    expect(pickWeightedPowerUpKind(0.6)).toBe('pierce');
    expect(pickWeightedPowerUpKind(0.74)).toBe('pierce');
    expect(pickWeightedPowerUpKind(0.75)).toBe('magnet');
    expect(pickWeightedPowerUpKind(0.89)).toBe('magnet');
    expect(pickWeightedPowerUpKind(0.9)).toBe('barrier');
    expect(pickWeightedPowerUpKind(0.999)).toBe('barrier');
  });

  it('clamps out-of-range random inputs gracefully', () => {
    expect(pickWeightedPowerUpKind(-0.5)).toBe('multiball');
    expect(pickWeightedPowerUpKind(1.0)).toBe('barrier');
    expect(pickWeightedPowerUpKind(1.5)).toBe('barrier');
  });

  it('creates power-up capsules centered at given coordinates', () => {
    const centerX = 200;
    const centerY = 350;
    const capsule = createPowerUpCapsule(42, centerX, centerY, 'laser');

    expect(capsule.identifier).toBe(42);
    expect(capsule.kind).toBe('laser');
    expect(capsule.width).toBe(POWER_UP_CAPSULE_WIDTH);
    expect(capsule.height).toBe(POWER_UP_CAPSULE_HEIGHT);
    expect(capsule.x).toBe(centerX - POWER_UP_CAPSULE_WIDTH / 2);
    expect(capsule.y).toBe(centerY - POWER_UP_CAPSULE_HEIGHT / 2);
    expect(capsule.velocityY).toBe(POWER_UP_CAPSULE_VELOCITY_Y);
    expect(capsule.color).toBe('#f87171');
    expect(capsule.label).toBe('L');
    expect(capsule.alive).toBe(true);
  });
});

describe('Level Formations and Stage System', () => {
  it('exposes exactly ten distinct stage templates', () => {
    expect(STAGE_COUNT).toBe(10);
    expect(STAGE_TEMPLATES.length).toBe(10);
  });

  it('contains valid and unique brick positions for all 10 stages', () => {
    const stageNames = [
      'Neon Horizon',
      'Twin Citadels',
      'Shatter V-Wing',
      'Fortress Gate',
      'Prism Core Alpha',
      'Chain Reactor',
      'Crystal Labyrinth',
      'Solar Eclipse',
      'Hyperdrive Gauntlet',
      'Shatterwave Omega',
    ];

    for (let stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
      const definition = buildStageDefinition(stageNumber);
      expect(definition.stageNumber).toBe(stageNumber);
      expect(definition.name).toBe(stageNames[stageNumber - 1]);
      expect(definition.subtitle.length).toBeGreaterThan(0);
      expect(definition.ballSpeedMultiplier).toBeGreaterThanOrEqual(1.0);
      expect(definition.powerUpDropChance).toBeGreaterThan(0);
      expect(definition.bricks.length).toBeGreaterThan(0);

      const coordinateSet = new Set<string>();
      for (const blueprint of definition.bricks) {
        expect(blueprint.row).toBeGreaterThanOrEqual(0);
        expect(blueprint.column).toBeGreaterThanOrEqual(0);
        expect(blueprint.column).toBeLessThan(BRICK_COLUMNS);
        expect(blueprint.hitPoints).toBeGreaterThan(0);
        expect(blueprint.points).toBeGreaterThanOrEqual(0);

        const coordinateKey = `${blueprint.row},${blueprint.column}`;
        expect(coordinateSet.has(coordinateKey)).toBe(false);
        coordinateSet.add(coordinateKey);
      }
    }
  });

  it('verifies signature formation elements in specific stages', () => {
    // Stage 1: Neon Horizon has exactly two central splitters
    const stageOne = buildStageDefinition(1);
    const stageOneSplitters = stageOne.bricks.filter((blueprint) => blueprint.kind === 'splitter');
    expect(stageOneSplitters.length).toBe(2);
    expect(stageOneSplitters.map((blueprint) => blueprint.column)).toEqual([4, 5]);

    // Stage 2: Twin Citadels has armored towers and explosive channel
    const stageTwo = buildStageDefinition(2);
    const stageTwoArmored = stageTwo.bricks.filter((blueprint) => blueprint.kind === 'armored');
    const stageTwoExplosive = stageTwo.bricks.filter((blueprint) => blueprint.kind === 'explosive');
    expect(stageTwoArmored.length).toBeGreaterThan(10);
    expect(stageTwoExplosive.length).toBe(4);

    // Stage 3: Shatter V-Wing has explosive apex and wing splitters
    const stageThree = buildStageDefinition(3);
    const stageThreeApex = stageThree.bricks.filter(
      (blueprint) => blueprint.row === 0 && blueprint.kind === 'explosive',
    );
    expect(stageThreeApex.length).toBe(2);
    const stageThreeSplitters = stageThree.bricks.filter(
      (blueprint) => blueprint.kind === 'splitter',
    );
    expect(stageThreeSplitters.length).toBe(2);

    // Stage 4: Fortress Gate has indestructible bumpers leaving entrance open
    const stageFour = buildStageDefinition(4);
    const stageFourBumpers = stageFour.bricks.filter(
      (blueprint) => blueprint.kind === 'indestructible',
    );
    expect(stageFourBumpers.length).toBe(8);
    const stageFourGateRow = stageFour.bricks.filter((blueprint) => blueprint.row === 5);
    const gateColumns = stageFourGateRow.map((blueprint) => blueprint.column);
    expect(gateColumns).not.toContain(4);
    expect(gateColumns).not.toContain(5);

    // Stage 5: Prism Core Alpha has central core cluster and flanking splitters
    const stageFive = buildStageDefinition(5);
    const stageFiveCores = stageFive.bricks.filter((blueprint) => blueprint.kind === 'core');
    expect(stageFiveCores.length).toBe(4);
    const stageFiveSplitters = stageFive.bricks.filter(
      (blueprint) => blueprint.kind === 'splitter',
    );
    expect(stageFiveSplitters.length).toBe(4);

    // Stage 6: Chain Reactor has abundant interconnected explosives
    const stageSix = buildStageDefinition(6);
    const stageSixExplosives = stageSix.bricks.filter(
      (blueprint) => blueprint.kind === 'explosive',
    );
    expect(stageSixExplosives.length).toBeGreaterThanOrEqual(10);

    // Stage 9: Hyperdrive Gauntlet has 3-HP armor and indestructible tips
    const stageNine = buildStageDefinition(9);
    const stageNineArmored = stageNine.bricks.filter((blueprint) => blueprint.kind === 'armored');
    expect(stageNineArmored.every((blueprint) => blueprint.hitPoints === 3)).toBe(true);

    // Stage 10: Shatterwave Omega has dual cores, explosive relays, and armored bastions
    const stageTen = buildStageDefinition(10);
    const stageTenCores = stageTen.bricks.filter((blueprint) => blueprint.kind === 'core');
    expect(stageTenCores.length).toBe(8);
    const stageTenExplosives = stageTen.bricks.filter(
      (blueprint) => blueprint.kind === 'explosive',
    );
    expect(stageTenExplosives.length).toBe(6);
  });

  it('scales ball speed multiplier and hit points during endless loop', () => {
    const stageOne = buildStageDefinition(1);
    expect(stageOne.ballSpeedMultiplier).toBe(1.0);

    const stageEleven = buildStageDefinition(11);
    expect(stageEleven.name).toBe('Neon Horizon');
    expect(stageEleven.stageNumber).toBe(11);
    expect(stageEleven.ballSpeedMultiplier).toBeCloseTo(1.55, 4);

    const stageTwenty = buildStageDefinition(20);
    expect(stageTwenty.name).toBe('Shatterwave Omega');
    expect(stageTwenty.stageNumber).toBe(20);
    expect(stageTwenty.ballSpeedMultiplier).toBeCloseTo(1.65, 4);

    // Loop index for stage 20 is Math.floor(19 / 10) = 1
    // Base core hit points in stage 10 is 4 -> 4 + 1 = 5
    // Base armored hit points in stage 10 is 3 -> 3 + 1 = 4
    const stageTwentyCores = stageTwenty.bricks.filter((blueprint) => blueprint.kind === 'core');
    expect(stageTwentyCores.every((blueprint) => blueprint.hitPoints === 5)).toBe(true);
    const stageTwentyArmored = stageTwenty.bricks.filter(
      (blueprint) => blueprint.kind === 'armored',
    );
    expect(stageTwentyArmored.every((blueprint) => blueprint.hitPoints === 4)).toBe(true);
  });

  it('normalizes stage number input cleanly', () => {
    const stageZero = buildStageDefinition(0);
    expect(stageZero.stageNumber).toBe(1);

    const stageNegative = buildStageDefinition(-4);
    expect(stageNegative.stageNumber).toBe(1);

    const stageFloat = buildStageDefinition(2.8);
    expect(stageFloat.stageNumber).toBe(2);
    expect(stageFloat.name).toBe('Twin Citadels');
  });

  it('instantiates brick entities with exact pixel coordinates', () => {
    const definition = buildStageDefinition(1);
    const entities = instantiateStageBricks(definition);

    expect(entities.length).toBe(definition.bricks.length);

    for (let index = 0; index < entities.length; index += 1) {
      const entity = entities[index];
      const blueprint = definition.bricks[index];

      expect(entity.identifier).toBe(index + 1);
      expect(entity.row).toBe(blueprint.row);
      expect(entity.column).toBe(blueprint.column);
      expect(entity.x).toBe(BRICK_GRID_OFFSET_X + blueprint.column * (BRICK_WIDTH + BRICK_GAP_X));
      expect(entity.y).toBe(BRICK_GRID_OFFSET_Y + blueprint.row * (BRICK_HEIGHT + BRICK_GAP_Y));
      expect(entity.width).toBe(BRICK_WIDTH);
      expect(entity.height).toBe(BRICK_HEIGHT);
      expect(entity.kind).toBe(blueprint.kind);
      expect(entity.hitPoints).toBe(blueprint.hitPoints);
      expect(entity.maximumHitPoints).toBe(blueprint.hitPoints);
      expect(entity.color).toBe(blueprint.color);
      expect(entity.points).toBe(blueprint.points);
      expect(entity.flashTimerSeconds).toBe(0);
      expect(entity.alive).toBe(true);
    }
  });

  it('correctly counts destructible bricks ignoring indestructible and dead ones', () => {
    const dummyBricks: BrickEntity[] = [
      {
        identifier: 1,
        row: 0,
        column: 0,
        x: 0,
        y: 0,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        kind: 'standard',
        hitPoints: 1,
        maximumHitPoints: 1,
        color: '#fff',
        points: 100,
        flashTimerSeconds: 0,
        alive: true,
      },
      {
        identifier: 2,
        row: 0,
        column: 1,
        x: 0,
        y: 0,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        kind: 'armored',
        hitPoints: 2,
        maximumHitPoints: 2,
        color: '#fff',
        points: 200,
        flashTimerSeconds: 0,
        alive: true,
      },
      {
        identifier: 3,
        row: 0,
        column: 2,
        x: 0,
        y: 0,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        kind: 'indestructible',
        hitPoints: 1,
        maximumHitPoints: 1,
        color: '#fff',
        points: 0,
        flashTimerSeconds: 0,
        alive: true,
      },
      {
        identifier: 4,
        row: 0,
        column: 3,
        x: 0,
        y: 0,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        kind: 'standard',
        hitPoints: 0,
        maximumHitPoints: 1,
        color: '#fff',
        points: 100,
        flashTimerSeconds: 0,
        alive: false,
      },
    ];

    expect(countDestructibleBricks(dummyBricks)).toBe(2);
  });

  it('returns valid palette entries in ROW_NEON_PALETTE', () => {
    expect(ROW_NEON_PALETTE.length).toBe(8);
    for (const color of ROW_NEON_PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

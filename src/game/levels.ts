import {
  BRICK_COLUMNS,
  BRICK_GAP_X,
  BRICK_GAP_Y,
  BRICK_GRID_OFFSET_X,
  BRICK_GRID_OFFSET_Y,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  type BrickBlueprint,
  type BrickEntity,
  type BrickKind,
  type StageDefinition,
} from './types';

export const ROW_NEON_PALETTE: readonly string[] = [
  '#38bdf8',
  '#22d3ee',
  '#34d399',
  '#a3e635',
  '#facc15',
  '#fb923c',
  '#f472b6',
  '#c084fc',
];

export const STAGE_COUNT = 10;

interface GlyphSpecification {
  kind: BrickKind;
  hitPoints: number;
  points: number;
  color?: string;
}

const GLYPH_SPECIFICATIONS: Readonly<Record<string, GlyphSpecification>> = {
  S: { kind: 'standard', hitPoints: 1, points: 100 },
  A: { kind: 'armored', hitPoints: 2, points: 200, color: '#94a3b8' },
  H: { kind: 'armored', hitPoints: 3, points: 300, color: '#94a3b8' },
  E: { kind: 'explosive', hitPoints: 1, points: 150, color: '#ef4444' },
  P: { kind: 'splitter', hitPoints: 1, points: 200, color: '#c084fc' },
  I: { kind: 'indestructible', hitPoints: 1, points: 0, color: '#eab308' },
  C: { kind: 'core', hitPoints: 4, points: 500, color: '#f43f5e' },
};

function parseGridRows(rows: readonly string[]): BrickBlueprint[] {
  const blueprints: BrickBlueprint[] = [];
  for (let row = 0; row < rows.length; row += 1) {
    const line = rows[row];
    const maximumColumns = Math.min(BRICK_COLUMNS, line.length);
    for (let column = 0; column < maximumColumns; column += 1) {
      const glyph = line[column];
      const specification = GLYPH_SPECIFICATIONS[glyph];
      if (!specification) {
        continue;
      }
      const color = specification.color ?? ROW_NEON_PALETTE[row % ROW_NEON_PALETTE.length];
      blueprints.push({
        row,
        column,
        kind: specification.kind,
        hitPoints: specification.hitPoints,
        color,
        points: specification.points,
      });
    }
  }
  return blueprints;
}

export interface StageTemplate {
  name: string;
  subtitle: string;
  powerUpDropChance: number;
  bricks: readonly BrickBlueprint[];
}

export const STAGE_TEMPLATES: readonly Readonly<StageTemplate>[] = Object.freeze([
  {
    name: 'Neon Horizon',
    subtitle: 'First Light Across the Grid',
    powerUpDropChance: 0.22,
    bricks: parseGridRows([
      'SSSSSSSSSS',
      'SSSSSSSSSS',
      'SSSSPPSSSS',
      'SSSSSSSSSS',
      'SSSSSSSSSS',
      'SSSSSSSSSS',
    ]),
  },
  {
    name: 'Twin Citadels',
    subtitle: 'Breach the Twin Bastions',
    powerUpDropChance: 0.24,
    bricks: parseGridRows([
      '..........',
      'AAASSSSAAA',
      'AS.EE..ASA',
      'AS.SS..ASA',
      'AS.EE..ASA',
      'AS.SS..ASA',
      'AAA.SS.AAA',
    ]),
  },
  {
    name: 'Shatter V-Wing',
    subtitle: 'Split the Delta Vanguard',
    powerUpDropChance: 0.25,
    bricks: parseGridRows(['....EE....', '...SAAS...', '..ASSSSA..', '.SS....SS.', 'PS......SP']),
  },
  {
    name: 'Fortress Gate',
    subtitle: 'Penetrate the Gilded Bulwark',
    powerUpDropChance: 0.25,
    bricks: parseGridRows([
      '..........',
      '..AAAAAA..',
      '..AESSEA..',
      '..ASEESA..',
      '...ASSA...',
      'IIII..IIII',
    ]),
  },
  {
    name: 'Prism Core Alpha',
    subtitle: 'Overcharge the Central Matrix',
    powerUpDropChance: 0.28,
    bricks: parseGridRows([
      '..........',
      '..SSSSSS..',
      '...AAAA...',
      'P..ACCA..P',
      'P..ACCA..P',
      '...AAAA...',
      '..SSSSSS..',
    ]),
  },
  {
    name: 'Chain Reactor',
    subtitle: 'Ignite Cascading Detonations',
    powerUpDropChance: 0.25,
    bricks: parseGridRows([
      '..........',
      '.SESSESES.',
      '.SSESSSES.',
      '.SESESSES.',
      '.SSESESSS.',
      '.SESESESS.',
    ]),
  },
  {
    name: 'Crystal Labyrinth',
    subtitle: 'Navigate the Refractive Maze',
    powerUpDropChance: 0.26,
    bricks: parseGridRows([
      '..........',
      'SSASSASSAP',
      'SSASP.SSAS',
      'PS.SSASSAS',
      'SSASSASP.S',
      'SSASSASSAS',
    ]),
  },
  {
    name: 'Solar Eclipse',
    subtitle: 'Corona of the Midnight Sun',
    powerUpDropChance: 0.26,
    bricks: parseGridRows([
      '....SS....',
      '...SSSS...',
      '..AS..SA..',
      'SAS.EE.SAS',
      'SAS.EE.SAS',
      '..AS..SA..',
      '...SSSS...',
      '....SS....',
    ]),
  },
  {
    name: 'Hyperdrive Gauntlet',
    subtitle: 'Accelerate Past Maximum Warp',
    powerUpDropChance: 0.28,
    bricks: parseGridRows([
      '....II....',
      '...HSSH...',
      '..HSPPSH..',
      '.ISHSSHSI.',
      '..HSPPSH..',
      '...HSSH...',
      '....II....',
    ]),
  },
  {
    name: 'Shatterwave Omega',
    subtitle: 'The Final Resonance',
    powerUpDropChance: 0.3,
    bricks: parseGridRows([
      '.S.S..S.S.',
      '..PP..PP..',
      'HH..EE..HH',
      'HHCCEECCHH',
      'HHCCEECCHH',
      'HH......HH',
      '..SSSSSS..',
    ]),
  },
]);

export function buildStageDefinition(stageNumber: number): StageDefinition {
  const normalizedStageNumber = Math.max(1, Math.floor(stageNumber));
  const templateIndex = (normalizedStageNumber - 1) % STAGE_COUNT;
  const loopIndex = Math.floor((normalizedStageNumber - 1) / STAGE_COUNT);
  const template = STAGE_TEMPLATES[templateIndex];

  const ballSpeedMultiplier = 1 + Math.min(0.65, (normalizedStageNumber - 1) * 0.055);

  const bricks: BrickBlueprint[] = template.bricks.map((blueprint) => {
    const isScalingKind = blueprint.kind === 'armored' || blueprint.kind === 'core';
    const hitPoints = isScalingKind ? blueprint.hitPoints + loopIndex : blueprint.hitPoints;

    return {
      row: blueprint.row,
      column: blueprint.column,
      kind: blueprint.kind,
      hitPoints,
      color: blueprint.color,
      points: blueprint.points,
    };
  });

  return {
    stageNumber: normalizedStageNumber,
    name: template.name,
    subtitle: template.subtitle,
    ballSpeedMultiplier,
    powerUpDropChance: template.powerUpDropChance,
    bricks,
  };
}

export function instantiateStageBricks(definition: StageDefinition): BrickEntity[] {
  return definition.bricks.map((blueprint, index) => {
    const x = BRICK_GRID_OFFSET_X + blueprint.column * (BRICK_WIDTH + BRICK_GAP_X);
    const y = BRICK_GRID_OFFSET_Y + blueprint.row * (BRICK_HEIGHT + BRICK_GAP_Y);

    return {
      identifier: index + 1,
      row: blueprint.row,
      column: blueprint.column,
      x,
      y,
      width: BRICK_WIDTH,
      height: BRICK_HEIGHT,
      kind: blueprint.kind,
      hitPoints: blueprint.hitPoints,
      maximumHitPoints: blueprint.hitPoints,
      color: blueprint.color,
      points: blueprint.points,
      flashTimerSeconds: 0,
      alive: true,
    };
  });
}

export function countDestructibleBricks(bricks: readonly Readonly<BrickEntity>[]): number {
  return bricks.filter((brick) => brick.alive && brick.kind !== 'indestructible').length;
}

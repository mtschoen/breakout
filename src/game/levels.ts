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

const DEFAULT_BRICK_COLORS: Readonly<Record<BrickKind, string>> = {
  standard: '#38bdf8',
  armored: '#94a3b8',
  explosive: '#ef4444',
  splitter: '#c084fc',
  indestructible: '#eab308',
  core: '#f43f5e',
};

const DEFAULT_BRICK_POINTS: Readonly<Record<BrickKind, number>> = {
  standard: 100,
  armored: 200,
  explosive: 150,
  splitter: 200,
  indestructible: 0,
  core: 500,
};

const DEFAULT_BRICK_HIT_POINTS: Readonly<Record<BrickKind, number>> = {
  standard: 1,
  armored: 2,
  explosive: 1,
  splitter: 1,
  indestructible: 1,
  core: 4,
};

interface BrickBlueprintDraft {
  row: number;
  column: number;
  kind: BrickKind;
  hitPoints?: number;
  color?: string;
  points?: number;
}

function createBlueprint(draft: BrickBlueprintDraft): BrickBlueprint {
  const kind = draft.kind;
  const color =
    draft.color ??
    (kind === 'standard'
      ? ROW_NEON_PALETTE[draft.row % ROW_NEON_PALETTE.length]
      : DEFAULT_BRICK_COLORS[kind]);

  return {
    row: draft.row,
    column: draft.column,
    kind,
    hitPoints: draft.hitPoints ?? DEFAULT_BRICK_HIT_POINTS[kind],
    color,
    points: draft.points ?? DEFAULT_BRICK_POINTS[kind],
  };
}

export interface StageTemplate {
  name: string;
  subtitle: string;
  powerUpDropChance: number;
  bricks: readonly BrickBlueprint[];
}

function buildStageOneNeonHorizon(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < BRICK_COLUMNS; column += 1) {
      if (row === 2 && (column === 4 || column === 5)) {
        drafts.push({
          row,
          column,
          kind: 'splitter',
        });
      } else {
        drafts.push({
          row,
          column,
          kind: 'standard',
        });
      }
    }
  }

  return {
    name: 'Neon Horizon',
    subtitle: 'First Light Across the Grid',
    powerUpDropChance: 0.22,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageTwoTwinCitadels(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Left citadel tower (columns 0, 1, 2, rows 1 through 6)
  for (let row = 1; row <= 6; row += 1) {
    for (let column = 0; column <= 2; column += 1) {
      const isArmored = column === 0 || column === 2 || row === 1 || row === 6;
      drafts.push({
        row,
        column,
        kind: isArmored ? 'armored' : 'standard',
      });
    }
  }

  // Right citadel tower (columns 7, 8, 9, rows 1 through 6)
  for (let row = 1; row <= 6; row += 1) {
    for (let column = 7; column <= 9; column += 1) {
      const isArmored = column === 7 || column === 9 || row === 1 || row === 6;
      drafts.push({
        row,
        column,
        kind: isArmored ? 'armored' : 'standard',
      });
    }
  }

  // Center explosive nova channel (columns 4 and 5, rows 1 through 6)
  for (let row = 1; row <= 6; row += 1) {
    for (let column = 4; column <= 5; column += 1) {
      const isExplosive = row === 2 || row === 4;
      drafts.push({
        row,
        column,
        kind: isExplosive ? 'explosive' : 'standard',
      });
    }
  }

  // Connecting skyways at row 1
  drafts.push({ row: 1, column: 3, kind: 'standard' });
  drafts.push({ row: 1, column: 6, kind: 'standard' });

  return {
    name: 'Twin Citadels',
    subtitle: 'Breach the Twin Bastions',
    powerUpDropChance: 0.24,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageThreeShatterVWing(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Apex (row 0, columns 4 and 5: explosive)
  drafts.push({ row: 0, column: 4, kind: 'explosive' });
  drafts.push({ row: 0, column: 5, kind: 'explosive' });

  // Chevron layers spreading outward
  drafts.push({ row: 1, column: 3, kind: 'standard' });
  drafts.push({ row: 1, column: 4, kind: 'armored' });
  drafts.push({ row: 1, column: 5, kind: 'armored' });
  drafts.push({ row: 1, column: 6, kind: 'standard' });

  drafts.push({ row: 2, column: 2, kind: 'armored' });
  drafts.push({ row: 2, column: 3, kind: 'standard' });
  drafts.push({ row: 2, column: 4, kind: 'standard' });
  drafts.push({ row: 2, column: 5, kind: 'standard' });
  drafts.push({ row: 2, column: 6, kind: 'standard' });
  drafts.push({ row: 2, column: 7, kind: 'armored' });

  drafts.push({ row: 3, column: 1, kind: 'standard' });
  drafts.push({ row: 3, column: 2, kind: 'standard' });
  drafts.push({ row: 3, column: 7, kind: 'standard' });
  drafts.push({ row: 3, column: 8, kind: 'standard' });

  // Wing tips with prism splitters
  drafts.push({ row: 4, column: 0, kind: 'splitter' });
  drafts.push({ row: 4, column: 1, kind: 'standard' });
  drafts.push({ row: 4, column: 8, kind: 'standard' });
  drafts.push({ row: 4, column: 9, kind: 'splitter' });

  return {
    name: 'Shatter V-Wing',
    subtitle: 'Split the Delta Vanguard',
    powerUpDropChance: 0.25,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageFourFortressGate(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Interior chamber roof (row 1, columns 2 through 7)
  for (let column = 2; column <= 7; column += 1) {
    drafts.push({ row: 1, column, kind: 'armored' });
  }

  // Interior chamber row 2
  drafts.push({ row: 2, column: 2, kind: 'armored' });
  drafts.push({ row: 2, column: 3, kind: 'explosive' });
  drafts.push({ row: 2, column: 4, kind: 'standard' });
  drafts.push({ row: 2, column: 5, kind: 'standard' });
  drafts.push({ row: 2, column: 6, kind: 'explosive' });
  drafts.push({ row: 2, column: 7, kind: 'armored' });

  // Interior chamber row 3
  drafts.push({ row: 3, column: 2, kind: 'armored' });
  drafts.push({ row: 3, column: 3, kind: 'standard' });
  drafts.push({ row: 3, column: 4, kind: 'explosive' });
  drafts.push({ row: 3, column: 5, kind: 'explosive' });
  drafts.push({ row: 3, column: 6, kind: 'standard' });
  drafts.push({ row: 3, column: 7, kind: 'armored' });

  // Interior chamber row 4
  drafts.push({ row: 4, column: 3, kind: 'armored' });
  drafts.push({ row: 4, column: 4, kind: 'standard' });
  drafts.push({ row: 4, column: 5, kind: 'standard' });
  drafts.push({ row: 4, column: 6, kind: 'armored' });

  // Indestructible gold gate bumpers (row 5, leaving columns 4 and 5 open)
  for (let column = 0; column <= 3; column += 1) {
    drafts.push({ row: 5, column, kind: 'indestructible' });
  }
  for (let column = 6; column <= 9; column += 1) {
    drafts.push({ row: 5, column, kind: 'indestructible' });
  }

  return {
    name: 'Fortress Gate',
    subtitle: 'Penetrate the Gilded Bulwark',
    powerUpDropChance: 0.25,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageFivePrismCoreAlpha(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Top and bottom auxiliary wings
  for (let column = 2; column <= 7; column += 1) {
    drafts.push({ row: 1, column, kind: 'standard' });
    drafts.push({ row: 6, column, kind: 'standard' });
  }

  // Armored shield upper and lower walls
  for (let column = 3; column <= 6; column += 1) {
    drafts.push({ row: 2, column, kind: 'armored' });
    drafts.push({ row: 5, column, kind: 'armored' });
  }

  // Armored shield side walls
  drafts.push({ row: 3, column: 3, kind: 'armored' });
  drafts.push({ row: 4, column: 3, kind: 'armored' });
  drafts.push({ row: 3, column: 6, kind: 'armored' });
  drafts.push({ row: 4, column: 6, kind: 'armored' });

  // Central boss core bricks (2x2 cluster)
  drafts.push({ row: 3, column: 4, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 3, column: 5, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 4, column: 4, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 4, column: 5, kind: 'core', hitPoints: 4, points: 500 });

  // Splitter conduits on the outer flanks
  drafts.push({ row: 3, column: 0, kind: 'splitter' });
  drafts.push({ row: 4, column: 0, kind: 'splitter' });
  drafts.push({ row: 3, column: 9, kind: 'splitter' });
  drafts.push({ row: 4, column: 9, kind: 'splitter' });

  return {
    name: 'Prism Core Alpha',
    subtitle: 'Overcharge the Central Matrix',
    powerUpDropChance: 0.28,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageSixChainReactor(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // 5 rows x 8 columns interconnected lattice (rows 1-5, columns 1-8)
  const explosivePositions = new Set([
    '1,2',
    '1,5',
    '1,7',
    '2,3',
    '2,6',
    '3,2',
    '3,4',
    '3,7',
    '4,3',
    '4,5',
    '5,2',
    '5,4',
    '5,6',
    '5,7',
  ]);

  for (let row = 1; row <= 5; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      const positionKey = `${row},${column}`;
      drafts.push({
        row,
        column,
        kind: explosivePositions.has(positionKey) ? 'explosive' : 'standard',
      });
    }
  }

  return {
    name: 'Chain Reactor',
    subtitle: 'Ignite Cascading Detonations',
    powerUpDropChance: 0.25,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageSevenCrystalLabyrinth(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Armored corridor walls with openings
  for (let row = 1; row <= 5; row += 1) {
    if (row !== 3) {
      drafts.push({ row, column: 2, kind: 'armored' });
    }
    if (row !== 2) {
      drafts.push({ row, column: 5, kind: 'armored' });
    }
    if (row !== 4) {
      drafts.push({ row, column: 8, kind: 'armored' });
    }
  }

  // Corridors and splitters
  for (let row = 1; row <= 5; row += 1) {
    // Left corridor (columns 0 and 1)
    drafts.push({
      row,
      column: 0,
      kind: row === 3 ? 'splitter' : 'standard',
    });
    drafts.push({ row, column: 1, kind: 'standard' });

    // Center-left corridor (columns 3 and 4)
    drafts.push({ row, column: 3, kind: 'standard' });
    drafts.push({
      row,
      column: 4,
      kind: row === 2 ? 'splitter' : 'standard',
    });

    // Center-right corridor (columns 6 and 7)
    drafts.push({ row, column: 6, kind: 'standard' });
    drafts.push({
      row,
      column: 7,
      kind: row === 4 ? 'splitter' : 'standard',
    });

    // Right corridor (column 9)
    drafts.push({
      row,
      column: 9,
      kind: row === 1 ? 'splitter' : 'standard',
    });
  }

  return {
    name: 'Crystal Labyrinth',
    subtitle: 'Navigate the Refractive Maze',
    powerUpDropChance: 0.26,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageEightSolarEclipse(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Center explosive sun
  drafts.push({ row: 3, column: 4, kind: 'explosive' });
  drafts.push({ row: 3, column: 5, kind: 'explosive' });
  drafts.push({ row: 4, column: 4, kind: 'explosive' });
  drafts.push({ row: 4, column: 5, kind: 'explosive' });

  // Corona ring
  drafts.push({ row: 1, column: 3, kind: 'standard' });
  drafts.push({ row: 1, column: 4, kind: 'standard' });
  drafts.push({ row: 1, column: 5, kind: 'standard' });
  drafts.push({ row: 1, column: 6, kind: 'standard' });

  drafts.push({ row: 2, column: 2, kind: 'armored' });
  drafts.push({ row: 2, column: 3, kind: 'standard' });
  drafts.push({ row: 2, column: 6, kind: 'standard' });
  drafts.push({ row: 2, column: 7, kind: 'armored' });

  drafts.push({ row: 3, column: 1, kind: 'armored' });
  drafts.push({ row: 3, column: 2, kind: 'standard' });
  drafts.push({ row: 3, column: 7, kind: 'standard' });
  drafts.push({ row: 3, column: 8, kind: 'armored' });

  drafts.push({ row: 4, column: 1, kind: 'armored' });
  drafts.push({ row: 4, column: 2, kind: 'standard' });
  drafts.push({ row: 4, column: 7, kind: 'standard' });
  drafts.push({ row: 4, column: 8, kind: 'armored' });

  drafts.push({ row: 5, column: 2, kind: 'armored' });
  drafts.push({ row: 5, column: 3, kind: 'standard' });
  drafts.push({ row: 5, column: 6, kind: 'standard' });
  drafts.push({ row: 5, column: 7, kind: 'armored' });

  drafts.push({ row: 6, column: 3, kind: 'standard' });
  drafts.push({ row: 6, column: 4, kind: 'standard' });
  drafts.push({ row: 6, column: 5, kind: 'standard' });
  drafts.push({ row: 6, column: 6, kind: 'standard' });

  // Outer solar flare extremities
  drafts.push({ row: 0, column: 4, kind: 'standard' });
  drafts.push({ row: 0, column: 5, kind: 'standard' });
  drafts.push({ row: 7, column: 4, kind: 'standard' });
  drafts.push({ row: 7, column: 5, kind: 'standard' });
  drafts.push({ row: 3, column: 0, kind: 'standard' });
  drafts.push({ row: 4, column: 0, kind: 'standard' });
  drafts.push({ row: 3, column: 9, kind: 'standard' });
  drafts.push({ row: 4, column: 9, kind: 'standard' });

  return {
    name: 'Solar Eclipse',
    subtitle: 'Corona of the Midnight Sun',
    powerUpDropChance: 0.26,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageNineHyperdriveGauntlet(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Top diamond bumper apex
  drafts.push({ row: 0, column: 4, kind: 'indestructible' });
  drafts.push({ row: 0, column: 5, kind: 'indestructible' });

  // Upper diagonal ring with 3-HP armor
  drafts.push({ row: 1, column: 3, kind: 'armored', hitPoints: 3, points: 300 });
  drafts.push({ row: 1, column: 4, kind: 'standard' });
  drafts.push({ row: 1, column: 5, kind: 'standard' });
  drafts.push({ row: 1, column: 6, kind: 'armored', hitPoints: 3, points: 300 });

  drafts.push({ row: 2, column: 2, kind: 'armored', hitPoints: 3, points: 300 });
  drafts.push({ row: 2, column: 3, kind: 'standard' });
  drafts.push({ row: 2, column: 4, kind: 'splitter' });
  drafts.push({ row: 2, column: 5, kind: 'splitter' });
  drafts.push({ row: 2, column: 6, kind: 'standard' });
  drafts.push({ row: 2, column: 7, kind: 'armored', hitPoints: 3, points: 300 });

  // Center equator with outer bumpers and 3-HP armor
  drafts.push({ row: 3, column: 1, kind: 'indestructible' });
  drafts.push({ row: 3, column: 2, kind: 'standard' });
  drafts.push({ row: 3, column: 3, kind: 'armored', hitPoints: 3, points: 300 });
  drafts.push({ row: 3, column: 4, kind: 'standard' });
  drafts.push({ row: 3, column: 5, kind: 'standard' });
  drafts.push({ row: 3, column: 6, kind: 'armored', hitPoints: 3, points: 300 });
  drafts.push({ row: 3, column: 7, kind: 'standard' });
  drafts.push({ row: 3, column: 8, kind: 'indestructible' });

  // Lower diagonal ring with 3-HP armor
  drafts.push({ row: 4, column: 2, kind: 'armored', hitPoints: 3, points: 300 });
  drafts.push({ row: 4, column: 3, kind: 'standard' });
  drafts.push({ row: 4, column: 4, kind: 'splitter' });
  drafts.push({ row: 4, column: 5, kind: 'splitter' });
  drafts.push({ row: 4, column: 6, kind: 'standard' });
  drafts.push({ row: 4, column: 7, kind: 'armored', hitPoints: 3, points: 300 });

  drafts.push({ row: 5, column: 3, kind: 'armored', hitPoints: 3, points: 300 });
  drafts.push({ row: 5, column: 4, kind: 'standard' });
  drafts.push({ row: 5, column: 5, kind: 'standard' });
  drafts.push({ row: 5, column: 6, kind: 'armored', hitPoints: 3, points: 300 });

  // Bottom diamond bumper tip
  drafts.push({ row: 6, column: 4, kind: 'indestructible' });
  drafts.push({ row: 6, column: 5, kind: 'indestructible' });

  return {
    name: 'Hyperdrive Gauntlet',
    subtitle: 'Accelerate Past Maximum Warp',
    powerUpDropChance: 0.28,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

function buildStageTenShatterwaveOmega(): StageTemplate {
  const drafts: BrickBlueprintDraft[] = [];

  // Crown battlements
  drafts.push({ row: 0, column: 1, kind: 'standard', color: '#38bdf8' });
  drafts.push({ row: 0, column: 3, kind: 'standard', color: '#38bdf8' });
  drafts.push({ row: 0, column: 6, kind: 'standard', color: '#38bdf8' });
  drafts.push({ row: 0, column: 8, kind: 'standard', color: '#38bdf8' });

  // Prism splitter row
  drafts.push({ row: 1, column: 2, kind: 'splitter' });
  drafts.push({ row: 1, column: 3, kind: 'splitter' });
  drafts.push({ row: 1, column: 6, kind: 'splitter' });
  drafts.push({ row: 1, column: 7, kind: 'splitter' });

  // Flanking armored bastions (columns 0-1 and 8-9)
  for (let row = 2; row <= 5; row += 1) {
    drafts.push({ row, column: 0, kind: 'armored', hitPoints: 3, points: 300 });
    drafts.push({ row, column: 1, kind: 'armored', hitPoints: 3, points: 300 });
    drafts.push({ row, column: 8, kind: 'armored', hitPoints: 3, points: 300 });
    drafts.push({ row, column: 9, kind: 'armored', hitPoints: 3, points: 300 });
  }

  // Explosive relays connecting the cores
  drafts.push({ row: 2, column: 4, kind: 'explosive' });
  drafts.push({ row: 2, column: 5, kind: 'explosive' });
  drafts.push({ row: 3, column: 4, kind: 'explosive' });
  drafts.push({ row: 3, column: 5, kind: 'explosive' });
  drafts.push({ row: 4, column: 4, kind: 'explosive' });
  drafts.push({ row: 4, column: 5, kind: 'explosive' });

  // Dual Prism Cores (left core at columns 2-3, right core at columns 6-7)
  drafts.push({ row: 3, column: 2, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 3, column: 3, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 4, column: 2, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 4, column: 3, kind: 'core', hitPoints: 4, points: 500 });

  drafts.push({ row: 3, column: 6, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 3, column: 7, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 4, column: 6, kind: 'core', hitPoints: 4, points: 500 });
  drafts.push({ row: 4, column: 7, kind: 'core', hitPoints: 4, points: 500 });

  // Base defensive shield
  for (let column = 2; column <= 7; column += 1) {
    drafts.push({ row: 6, column, kind: 'standard' });
  }

  return {
    name: 'Shatterwave Omega',
    subtitle: 'The Final Resonance',
    powerUpDropChance: 0.3,
    bricks: drafts.map((draft) => createBlueprint(draft)),
  };
}

export const STAGE_TEMPLATES: readonly Readonly<StageTemplate>[] = Object.freeze([
  buildStageOneNeonHorizon(),
  buildStageTwoTwinCitadels(),
  buildStageThreeShatterVWing(),
  buildStageFourFortressGate(),
  buildStageFivePrismCoreAlpha(),
  buildStageSixChainReactor(),
  buildStageSevenCrystalLabyrinth(),
  buildStageEightSolarEclipse(),
  buildStageNineHyperdriveGauntlet(),
  buildStageTenShatterwaveOmega(),
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

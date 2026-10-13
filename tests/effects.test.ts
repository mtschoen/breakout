import { describe, expect, it } from 'vitest';
import { FloatingTextPool } from '../src/effects/floating-text';
import { ParticlePool } from '../src/effects/particles';
import { ScreenShake } from '../src/effects/screen-shake';
import { Starfield, SYNTHWAVE_STAR_COLORS } from '../src/effects/starfield';
import { PLAY_FIELD_HEIGHT, PLAY_FIELD_WIDTH } from '../src/game/types';

describe('ScreenShake', () => {
  it('initializes with default options and zero trauma', () => {
    const shake = new ScreenShake();
    expect(shake.maximumOffsetPixels).toBe(6);
    expect(shake.decayPerSecond).toBe(2.4);
    expect(shake.reducedMotion).toBe(false);
    expect(shake.trauma).toBe(0);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });

  it('accepts custom constructor options', () => {
    const shake = new ScreenShake({
      maximumOffsetPixels: 24,
      decayPerSecond: 3.2,
      reducedMotion: true,
    });
    expect(shake.maximumOffsetPixels).toBe(24);
    expect(shake.decayPerSecond).toBe(3.2);
    expect(shake.reducedMotion).toBe(true);
  });

  it('adds trauma with diminishing returns and clamps between 0 and 1', () => {
    const shake = new ScreenShake();
    shake.addTrauma(0.4);
    expect(shake.trauma).toBeCloseTo(0.4);

    // Overlapping impulse adds sub-linearly instead of jumping straight to 1.0
    shake.addTrauma(0.4);
    expect(shake.trauma).toBeGreaterThan(0.4);
    expect(shake.trauma).toBeLessThan(0.6);

    shake.addTrauma(1.5);
    expect(shake.trauma).toBe(1.0);

    // Negative or zero trauma addition is ignored
    shake.addTrauma(-0.2);
    expect(shake.trauma).toBe(1.0);
    shake.addTrauma(0);
    expect(shake.trauma).toBe(1.0);
  });

  it('computes non-zero offsets with injected deterministic random', () => {
    // When random returns 1.0, (random() * 2 - 1) = 1.0
    const shake = new ScreenShake({
      maximumOffsetPixels: 10,
      random: () => 1.0,
    });
    shake.addTrauma(0.5);
    // trauma = 0.5, intensity = 0.25, offset = 10 * 0.25 = 2.5
    expect(shake.offsetX).toBeCloseTo(2.5);
    expect(shake.offsetY).toBeCloseTo(2.5);

    // When random returns 0.0, (random() * 2 - 1) = -1.0
    const negativeShake = new ScreenShake({
      maximumOffsetPixels: 10,
      random: () => 0.0,
    });
    negativeShake.addTrauma(0.5);
    expect(negativeShake.offsetX).toBeCloseTo(-2.5);
    expect(negativeShake.offsetY).toBeCloseTo(-2.5);
  });

  it('decays trauma and zeroes offsets when fully decayed', () => {
    const shake = new ScreenShake({
      decayPerSecond: 2.0,
      random: () => 1.0,
    });
    shake.addTrauma(0.5);
    expect(shake.trauma).toBe(0.5);

    // Decay by 0.1 seconds -> trauma decreases by 0.2
    shake.update(0.1);
    expect(shake.trauma).toBeCloseTo(0.3);

    // Decay past zero
    shake.update(0.5);
    expect(shake.trauma).toBe(0);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);

    // Further updates at zero do not crash or produce negative trauma
    shake.update(0.1);
    expect(shake.trauma).toBe(0);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });

  it('ignores non-positive deltaSeconds in update', () => {
    const shake = new ScreenShake({ random: () => 1.0 });
    shake.addTrauma(0.5);
    const initialTrauma = shake.trauma;

    shake.update(0);
    expect(shake.trauma).toBe(initialTrauma);

    shake.update(-0.1);
    expect(shake.trauma).toBe(initialTrauma);
  });

  it('suppresses offsets when reduced motion is enabled', () => {
    const shake = new ScreenShake({
      reducedMotion: true,
      random: () => 1.0,
    });
    shake.addTrauma(1.0);
    expect(shake.trauma).toBe(1.0);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);

    shake.update(0.1);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });

  it('immediately zeroes offsets when setReducedMotion or reducedMotion setter is called', () => {
    const shake = new ScreenShake({ random: () => 1.0 });
    shake.addTrauma(0.8);
    expect(shake.offsetX).toBeGreaterThan(0);

    shake.setReducedMotion(true);
    expect(shake.reducedMotion).toBe(true);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);

    shake.reducedMotion = false;
    expect(shake.reducedMotion).toBe(false);
    expect(shake.offsetX).toBeGreaterThan(0);

    shake.reducedMotion = true;
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });

  it('clears trauma and offsets immediately', () => {
    const shake = new ScreenShake({ random: () => 1.0 });
    shake.addTrauma(0.9);
    expect(shake.trauma).toBe(0.9);
    expect(shake.offsetX).toBeGreaterThan(0);

    shake.clear();
    expect(shake.trauma).toBe(0);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });

  it('handles setting reducedMotion to false when trauma is zero', () => {
    const shake = new ScreenShake({ reducedMotion: true });
    shake.reducedMotion = false;
    expect(shake.reducedMotion).toBe(false);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });

  it('scales offsets with intensityMultiplier and zeroes when multiplier is zero', () => {
    const shake = new ScreenShake({
      maximumOffsetPixels: 10,
      intensityMultiplier: 2,
      random: () => 1.0,
    });
    expect(shake.intensityMultiplier).toBe(2);
    shake.addTrauma(0.5);
    expect(shake.offsetX).toBeCloseTo(5);

    shake.intensityMultiplier = 0.5;
    expect(shake.intensityMultiplier).toBe(0.5);
    expect(shake.offsetX).toBeCloseTo(1.25);

    shake.intensityMultiplier = 0;
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });
});

describe('ParticlePool', () => {
  it('initializes with default capacity and zero alive count', () => {
    const pool = new ParticlePool();
    expect(pool.capacity).toBe(320);
    expect(pool.aliveCount).toBe(0);
    expect(pool.toRenderViews()).toHaveLength(0);
  });

  it('initializes with custom capacity', () => {
    const pool = new ParticlePool(16);
    expect(pool.capacity).toBe(16);
    expect(pool.aliveCount).toBe(0);
  });

  it('spawns a single particle with correct initial values and defaults', () => {
    const pool = new ParticlePool(10);
    const success = pool.spawn({
      x: 100,
      y: 200,
      velocityX: 50,
      velocityY: -30,
      lifeSeconds: 0.5,
      size: 4,
    });

    expect(success).toBe(true);
    expect(pool.aliveCount).toBe(1);

    const views = pool.toRenderViews();
    expect(views).toHaveLength(1);
    expect(views[0].x).toBe(100);
    expect(views[0].y).toBe(200);
    expect(views[0].velocityX).toBe(50);
    expect(views[0].velocityY).toBe(-30);
    expect(views[0].lifeSeconds).toBe(0.5);
    expect(views[0].remainingLifeSeconds).toBe(0.5);
    expect(views[0].size).toBe(4);
    expect(views[0].color).toBe('#ffffff');
    expect(views[0].alpha).toBe(1);
    expect(views[0].gravity).toBe(0);
    expect(views[0].drag).toBe(0);
  });

  it('rejects invalid particle spawn parameters', () => {
    const pool = new ParticlePool(10);

    expect(
      pool.spawn({
        x: 0,
        y: 0,
        velocityX: 0,
        velocityY: 0,
        lifeSeconds: 0,
        size: 4,
      }),
    ).toBe(false);

    expect(
      pool.spawn({
        x: 0,
        y: 0,
        velocityX: 0,
        velocityY: 0,
        lifeSeconds: 1,
        size: 0,
      }),
    ).toBe(false);

    expect(pool.aliveCount).toBe(0);
  });

  it('enforces capacity limit when spawning individual particles', () => {
    const pool = new ParticlePool(2);
    expect(
      pool.spawn({
        x: 10,
        y: 10,
        velocityX: 0,
        velocityY: 0,
        lifeSeconds: 1,
        size: 2,
      }),
    ).toBe(true);
    expect(
      pool.spawn({
        x: 20,
        y: 20,
        velocityX: 0,
        velocityY: 0,
        lifeSeconds: 1,
        size: 2,
      }),
    ).toBe(true);
    expect(
      pool.spawn({
        x: 30,
        y: 30,
        velocityX: 0,
        velocityY: 0,
        lifeSeconds: 1,
        size: 2,
      }),
    ).toBe(false);

    expect(pool.aliveCount).toBe(2);
  });

  it('burst spawns multiple particles with directional parameters', () => {
    const pool = new ParticlePool(50);
    const spawnedCount = pool.burst(240, 320, {
      count: 12,
      speed: 120,
      lifeSeconds: 0.8,
      size: 5,
      color: '#f472b6',
      gravity: 150,
      drag: 0.5,
      directionRadians: 0,
      spreadRadians: Math.PI / 2,
    });

    expect(spawnedCount).toBe(12);
    expect(pool.aliveCount).toBe(12);

    const views = pool.toRenderViews();
    expect(views).toHaveLength(12);
    for (const view of views) {
      expect(view.x).toBe(240);
      expect(view.y).toBe(320);
      expect(view.size).toBe(5);
      expect(view.color).toBe('#f472b6');
      expect(view.gravity).toBe(150);
      expect(view.drag).toBe(0.5);
      expect(view.lifeSeconds).toBe(0.8);
      expect(view.alpha).toBe(1);
    }
  });

  it('burst applies speedVariance, sizeVariance, lifeVariance, spreadRadius, and palette', () => {
    let callIndex = 0;
    const sequence = [0.1, 0.8, 0.3, 0.9, 0.2, 0.7, 0.4, 0.6];
    const pool = new ParticlePool(20, () => {
      const value = sequence[callIndex % sequence.length];
      callIndex += 1;
      return value;
    });

    const spawnedCount = pool.burst(100, 200, {
      count: 4,
      speed: 200,
      speedVariance: 0.5,
      lifeSeconds: 0.6,
      lifeVariance: 0.4,
      size: 4,
      sizeVariance: 0.5,
      spreadRadius: 12,
      palette: ['#22d3ee', '#f472b6'],
    });

    expect(spawnedCount).toBe(4);
    const views = pool.toRenderViews();
    expect(views).toHaveLength(4);
    for (const view of views) {
      expect(['#22d3ee', '#f472b6']).toContain(view.color);
      expect(view.size).toBeGreaterThanOrEqual(1.2);
      expect(view.lifeSeconds).toBeGreaterThanOrEqual(0.12);
    }
  });

  it('burst stops gracefully when pool capacity is reached', () => {
    const pool = new ParticlePool(4);
    const spawnedCount = pool.burst(50, 50, {
      count: 10,
      speed: 50,
    });

    expect(spawnedCount).toBe(4);
    expect(pool.aliveCount).toBe(4);
  });

  it('burst returns zero when count is non-positive', () => {
    const pool = new ParticlePool(10);
    expect(pool.burst(0, 0, { count: 0, speed: 50 })).toBe(0);
    expect(pool.burst(0, 0, { count: -5, speed: 50 })).toBe(0);
    expect(pool.aliveCount).toBe(0);
  });

  it('updates particle positions, gravity, drag, and alpha fading', () => {
    const pool = new ParticlePool(10);
    pool.spawn({
      x: 100,
      y: 100,
      velocityX: 100,
      velocityY: 50,
      lifeSeconds: 1.0,
      size: 2,
      gravity: 200,
      drag: 0.5,
    });

    // Advance 0.5 seconds
    pool.update(0.5);
    expect(pool.aliveCount).toBe(1);

    const views = pool.toRenderViews();
    const particle = views[0];
    expect(particle.remainingLifeSeconds).toBeCloseTo(0.5);
    expect(particle.alpha).toBeCloseTo(0.5);
    // Gravity should have accelerated velocityY
    expect(particle.velocityY).toBeGreaterThan(50);
    // Position should have changed
    expect(particle.x).toBeGreaterThan(100);
    expect(particle.y).toBeGreaterThan(100);
  });

  it('expires particles when remainingLifeSeconds reaches zero', () => {
    const pool = new ParticlePool(10);
    pool.spawn({
      x: 50,
      y: 50,
      velocityX: 10,
      velocityY: 10,
      lifeSeconds: 0.2,
      size: 3,
    });

    expect(pool.aliveCount).toBe(1);
    pool.update(0.1);
    expect(pool.aliveCount).toBe(1);

    // Cross the lifetime boundary
    pool.update(0.15);
    expect(pool.aliveCount).toBe(0);
    expect(pool.toRenderViews()).toHaveLength(0);
  });

  it('ignores non-positive deltaSeconds during update', () => {
    const pool = new ParticlePool(10);
    pool.spawn({
      x: 50,
      y: 50,
      velocityX: 10,
      velocityY: 10,
      lifeSeconds: 1.0,
      size: 3,
    });

    pool.update(0);
    expect(pool.toRenderViews()[0].remainingLifeSeconds).toBe(1.0);

    pool.update(-0.5);
    expect(pool.toRenderViews()[0].remainingLifeSeconds).toBe(1.0);
  });

  it('iterates over alive particles with forEachAlive', () => {
    const pool = new ParticlePool(10);
    pool.spawn({ x: 1, y: 1, velocityX: 0, velocityY: 0, lifeSeconds: 1, size: 1 });
    pool.spawn({ x: 2, y: 2, velocityX: 0, velocityY: 0, lifeSeconds: 1, size: 1 });

    const visitedXCoordinates: number[] = [];
    pool.forEachAlive((particle) => {
      visitedXCoordinates.push(particle.x);
    });

    expect(visitedXCoordinates).toEqual([1, 2]);
  });

  it('recycles expired particle slots for new spawns', () => {
    const pool = new ParticlePool(1);
    expect(
      pool.spawn({ x: 10, y: 10, velocityX: 0, velocityY: 0, lifeSeconds: 0.1, size: 2 }),
    ).toBe(true);
    expect(pool.aliveCount).toBe(1);

    pool.update(0.2);
    expect(pool.aliveCount).toBe(0);

    // Slot is now free and can be reused
    expect(
      pool.spawn({ x: 20, y: 20, velocityX: 0, velocityY: 0, lifeSeconds: 0.5, size: 2 }),
    ).toBe(true);
    expect(pool.aliveCount).toBe(1);
    expect(pool.toRenderViews()[0].x).toBe(20);
  });

  it('clears all particles immediately', () => {
    const pool = new ParticlePool(10);
    pool.spawn({ x: 1, y: 1, velocityX: 0, velocityY: 0, lifeSeconds: 1, size: 1 });
    pool.spawn({ x: 2, y: 2, velocityX: 0, velocityY: 0, lifeSeconds: 1, size: 1 });
    expect(pool.aliveCount).toBe(2);

    pool.clear();
    expect(pool.aliveCount).toBe(0);
    expect(pool.toRenderViews()).toHaveLength(0);
  });

  it('scales burst count and size with multipliers and respects reducedMotion', () => {
    const pool = new ParticlePool(30);
    pool.densityMultiplier = 2;
    pool.sizeMultiplier = 1.5;
    expect(pool.densityMultiplier).toBe(2);
    expect(pool.sizeMultiplier).toBe(1.5);

    const spawnedCount = pool.burst(50, 50, { count: 4, speed: 60, size: 4 });
    expect(spawnedCount).toBe(8);
    expect(pool.toRenderViews()[0].size).toBe(6);

    pool.reducedMotion = true;
    expect(pool.reducedMotion).toBe(true);
    expect(pool.aliveCount).toBe(0);
    expect(pool.burst(50, 50, { count: 4, speed: 60 })).toBe(0);
    expect(pool.spawn({ x: 10, y: 10, velocityX: 0, velocityY: 0, lifeSeconds: 1, size: 2 })).toBe(
      false,
    );

    pool.reducedMotion = false;
    pool.densityMultiplier = 0;
    expect(pool.burst(50, 50, { count: 4, speed: 60 })).toBe(0);
  });
});

describe('FloatingTextPool', () => {
  it('initializes with default capacity and zero alive count', () => {
    const textPool = new FloatingTextPool();
    expect(textPool.capacity).toBe(40);
    expect(textPool.aliveCount).toBe(0);
    expect(textPool.toRenderViews()).toHaveLength(0);
  });

  it('initializes with custom capacity', () => {
    const textPool = new FloatingTextPool(12);
    expect(textPool.capacity).toBe(12);
    expect(textPool.aliveCount).toBe(0);
  });

  it('spawns floating text with correct values and defaults', () => {
    const textPool = new FloatingTextPool(10);
    const success = textPool.spawn(120, 240, '+250');

    expect(success).toBe(true);
    expect(textPool.aliveCount).toBe(1);

    const views = textPool.toRenderViews();
    expect(views).toHaveLength(1);
    expect(views[0].x).toBe(120);
    expect(views[0].y).toBe(240);
    expect(views[0].text).toBe('+250');
    expect(views[0].color).toBe('#ffffff');
    expect(views[0].alpha).toBe(1);
    expect(views[0].lifeSeconds).toBe(0.8);
    expect(views[0].remainingLifeSeconds).toBe(0.8);
    expect(views[0].riseSpeed).toBe(42);
  });

  it('spawns floating text with custom options and color', () => {
    const textPool = new FloatingTextPool(10);
    const success = textPool.spawn(100, 150, 'PARRY!', '#67e8f9', {
      lifeSeconds: 1.2,
      riseSpeed: 60,
    });

    expect(success).toBe(true);
    const views = textPool.toRenderViews();
    expect(views[0].text).toBe('PARRY!');
    expect(views[0].color).toBe('#67e8f9');
    expect(views[0].lifeSeconds).toBe(1.2);
    expect(views[0].remainingLifeSeconds).toBe(1.2);
    expect(views[0].riseSpeed).toBe(60);
  });

  it('rejects empty text and non-positive lifetime', () => {
    const textPool = new FloatingTextPool(10);

    expect(textPool.spawn(50, 50, '')).toBe(false);
    expect(textPool.spawn(50, 50, '   ')).toBe(false);
    expect(textPool.spawn(50, 50, 'VALID', '#ffffff', { lifeSeconds: 0 })).toBe(false);
    expect(textPool.spawn(50, 50, 'VALID', '#ffffff', { lifeSeconds: -1 })).toBe(false);
    expect(textPool.aliveCount).toBe(0);
  });

  it('enforces capacity limit on spawn', () => {
    const textPool = new FloatingTextPool(2);
    expect(textPool.spawn(10, 10, 'ONE')).toBe(true);
    expect(textPool.spawn(20, 20, 'TWO')).toBe(true);
    expect(textPool.spawn(30, 30, 'THREE')).toBe(false);
    expect(textPool.aliveCount).toBe(2);
  });

  it('updates text position upward and fades alpha', () => {
    const textPool = new FloatingTextPool(10);
    textPool.spawn(100, 200, 'CHAIN x3', '#fde047', {
      lifeSeconds: 1.0,
      riseSpeed: 40,
    });

    textPool.update(0.5);
    expect(textPool.aliveCount).toBe(1);

    const views = textPool.toRenderViews();
    expect(views[0].remainingLifeSeconds).toBeCloseTo(0.5);
    expect(views[0].alpha).toBeCloseTo(0.5);
    // Rising upward means decreasing y coordinate
    expect(views[0].y).toBeCloseTo(200 - 40 * 0.5);
  });

  it('expires text when lifetime runs out', () => {
    const textPool = new FloatingTextPool(10);
    textPool.spawn(100, 200, 'EXPIRE', '#ffffff', { lifeSeconds: 0.4 });

    textPool.update(0.2);
    expect(textPool.aliveCount).toBe(1);

    textPool.update(0.3);
    expect(textPool.aliveCount).toBe(0);
    expect(textPool.toRenderViews()).toHaveLength(0);
  });

  it('ignores non-positive deltaSeconds in update', () => {
    const textPool = new FloatingTextPool(10);
    textPool.spawn(100, 200, 'TEXT', '#ffffff', { lifeSeconds: 1.0 });

    textPool.update(0);
    expect(textPool.toRenderViews()[0].remainingLifeSeconds).toBe(1.0);

    textPool.update(-0.5);
    expect(textPool.toRenderViews()[0].remainingLifeSeconds).toBe(1.0);
  });

  it('iterates over alive text with forEachAlive', () => {
    const textPool = new FloatingTextPool(10);
    textPool.spawn(10, 10, 'A');
    textPool.spawn(20, 20, 'B');

    const collectedText: string[] = [];
    textPool.forEachAlive((entry) => {
      collectedText.push(entry.text);
    });

    expect(collectedText).toEqual(['A', 'B']);
  });

  it('recycles expired slots for new text entries', () => {
    const textPool = new FloatingTextPool(1);
    expect(textPool.spawn(10, 10, 'FIRST', '#ffffff', { lifeSeconds: 0.1 })).toBe(true);

    textPool.update(0.2);
    expect(textPool.aliveCount).toBe(0);

    expect(textPool.spawn(20, 20, 'SECOND')).toBe(true);
    expect(textPool.aliveCount).toBe(1);
    expect(textPool.toRenderViews()[0].text).toBe('SECOND');
  });

  it('clears all entries immediately', () => {
    const textPool = new FloatingTextPool(10);
    textPool.spawn(10, 10, 'ONE');
    textPool.spawn(20, 20, 'TWO');
    expect(textPool.aliveCount).toBe(2);

    textPool.clear();
    expect(textPool.aliveCount).toBe(0);
    expect(textPool.toRenderViews()).toHaveLength(0);
  });
});

describe('Starfield', () => {
  it('initializes with default count and playfield dimensions', () => {
    const starfield = new Starfield();
    expect(starfield.count).toBe(60);
    expect(starfield.width).toBe(PLAY_FIELD_WIDTH);
    expect(starfield.height).toBe(PLAY_FIELD_HEIGHT);

    const stars = starfield.getStars();
    expect(stars).toHaveLength(60);
  });

  it('initializes with custom options', () => {
    const starfield = new Starfield({
      count: 24,
      width: 320,
      height: 480,
    });
    expect(starfield.count).toBe(24);
    expect(starfield.width).toBe(320);
    expect(starfield.height).toBe(480);
    expect(starfield.getStars()).toHaveLength(24);
  });

  it('is completely deterministic for identical configurations', () => {
    const firstStarfield = new Starfield({ count: 30 });
    const secondStarfield = new Starfield({ count: 30 });

    const firstStars = firstStarfield.getStars();
    const secondStars = secondStarfield.getStars();

    expect(firstStars).toEqual(secondStars);
  });

  it('assigns valid bounds, sizes, alphas, and synthwave colors to all stars', () => {
    const starfield = new Starfield({ count: 40 });
    const stars = starfield.getStars();

    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(PLAY_FIELD_WIDTH);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(PLAY_FIELD_HEIGHT);

      expect(star.size).toBeGreaterThan(0);
      expect(star.alpha).toBeGreaterThan(0);
      expect(star.alpha).toBeLessThanOrEqual(1.0);

      expect(SYNTHWAVE_STAR_COLORS).toContain(star.color);
    }
  });

  it('drifts stars downward during update and wraps past height back to zero', () => {
    const starfield = new Starfield({ count: 20, height: 600 });
    const initialStars = starfield.getStars().map((star) => ({ x: star.x, y: star.y }));

    starfield.update(1.0);
    const updatedStars = starfield.getStars();

    for (let index = 0; index < updatedStars.length; index++) {
      const star = updatedStars[index];
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(600);
      // Position x does not change
      expect(star.x).toBe(initialStars[index].x);
    }
  });

  it('wraps stars accurately when drifting past height boundary', () => {
    const starfield = new Starfield({ count: 10, height: 100 });
    // Advance simulation time by a large duration so every star wraps multiple times
    starfield.update(50.0);
    const stars = starfield.getStars();

    for (const star of stars) {
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(100);
    }
  });

  it('scales drift speed proportionally with speedMultiplier', () => {
    const baseStarfield = new Starfield({ count: 10 });
    const boostedStarfield = new Starfield({ count: 10 });

    const initialY = baseStarfield.getStars()[0].y;

    baseStarfield.update(0.1, 1.0);
    boostedStarfield.update(0.1, 3.0);

    const baseDrift = baseStarfield.getStars()[0].y - initialY;
    const boostedDrift = boostedStarfield.getStars()[0].y - initialY;

    expect(boostedDrift).toBeCloseTo(baseDrift * 3.0);
  });

  it('wraps stars when drifting in reverse with negative speedMultiplier', () => {
    const starfield = new Starfield({ count: 10, height: 100 });
    starfield.update(5.0, -1.0);
    const stars = starfield.getStars();

    for (const star of stars) {
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(100);
    }
  });

  it('ignores non-positive deltaSeconds in update', () => {
    const starfield = new Starfield({ count: 10 });
    const initialY = starfield.getStars()[0].y;

    starfield.update(0);
    expect(starfield.getStars()[0].y).toBe(initialY);

    starfield.update(-1.0);
    expect(starfield.getStars()[0].y).toBe(initialY);
  });
});

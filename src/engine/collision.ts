import type { RectangleBounds, Vector2D } from '../game/types';

export interface CircleRectangleHit {
  hit: boolean;
  normalX: number;
  normalY: number;
  penetration: number;
  contactX: number;
  contactY: number;
}

export function circleIntersectsRectangle(
  circleX: number,
  circleY: number,
  radius: number,
  rectangle: RectangleBounds,
): CircleRectangleHit {
  const closestX = Math.max(rectangle.x, Math.min(rectangle.x + rectangle.width, circleX));
  const closestY = Math.max(rectangle.y, Math.min(rectangle.y + rectangle.height, circleY));

  const differenceX = circleX - closestX;
  const differenceY = circleY - closestY;
  const distanceSquared = differenceX * differenceX + differenceY * differenceY;

  if (distanceSquared > radius * radius) {
    return {
      hit: false,
      normalX: 0,
      normalY: 0,
      penetration: 0,
      contactX: closestX,
      contactY: closestY,
    };
  }

  if (distanceSquared > 0) {
    const distance = Math.sqrt(distanceSquared);
    return {
      hit: true,
      normalX: differenceX / distance,
      normalY: differenceY / distance,
      penetration: radius - distance,
      contactX: closestX,
      contactY: closestY,
    };
  }

  const distanceToLeft = circleX - rectangle.x;
  const distanceToRight = rectangle.x + rectangle.width - circleX;
  const distanceToTop = circleY - rectangle.y;
  const distanceToBottom = rectangle.y + rectangle.height - circleY;
  const minimumDistance = Math.min(
    distanceToLeft,
    distanceToRight,
    distanceToTop,
    distanceToBottom,
  );

  let normalX: number;
  let normalY: number;
  let contactX = circleX;
  let contactY = circleY;

  if (minimumDistance === distanceToLeft) {
    normalX = -1;
    normalY = 0;
    contactX = rectangle.x;
  } else if (minimumDistance === distanceToRight) {
    normalX = 1;
    normalY = 0;
    contactX = rectangle.x + rectangle.width;
  } else if (minimumDistance === distanceToTop) {
    normalX = 0;
    normalY = -1;
    contactY = rectangle.y;
  } else {
    normalX = 0;
    normalY = 1;
    contactY = rectangle.y + rectangle.height;
  }

  return {
    hit: true,
    normalX,
    normalY,
    penetration: radius + minimumDistance,
    contactX,
    contactY,
  };
}

export function rectanglesOverlap(first: RectangleBounds, second: RectangleBounds): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function reflectVelocity(
  velocityX: number,
  velocityY: number,
  normalX: number,
  normalY: number,
): Vector2D {
  const dotProduct = velocityX * normalX + velocityY * normalY;
  if (dotProduct < 0) {
    return {
      x: velocityX - 2 * dotProduct * normalX,
      y: velocityY - 2 * dotProduct * normalY,
    };
  }
  return {
    x: velocityX,
    y: velocityY,
  };
}

export function computePaddleBounceVelocity(
  ballX: number,
  paddleX: number,
  paddleWidth: number,
  paddleVelocityX: number,
  speedPixelsPerSecond: number,
  maximumBounceAngleRadians = (62 * Math.PI) / 180,
): Vector2D {
  const paddleHalfWidth = Math.max(1, paddleWidth / 2);
  const paddleCenterX = paddleX + paddleWidth / 2;
  const rawRelativeX = (ballX - paddleCenterX) / paddleHalfWidth;
  const relativeX = Math.max(-1, Math.min(1, rawRelativeX));

  const englishAdjustment = Math.max(-0.18, Math.min(0.18, paddleVelocityX / 2400));
  const finalNormalized = Math.max(-1, Math.min(1, relativeX + englishAdjustment));
  const bounceAngleRadians = finalNormalized * maximumBounceAngleRadians;

  return {
    x: Math.sin(bounceAngleRadians) * speedPixelsPerSecond,
    y: -Math.cos(bounceAngleRadians) * speedPixelsPerSecond,
  };
}

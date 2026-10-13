import {
  PLAY_FIELD_HEIGHT,
  PLAY_FIELD_WIDTH,
  type BallEntity,
  type BrickEntity,
  type LaserProjectile,
  type PaddleEntity,
  type PowerUpCapsule,
  type RenderFloatingTextView,
  type RenderParticleView,
  type RenderView,
  type ShockwaveRing,
  type StarView,
} from '../game/types';

export class Renderer {
  private readonly context: CanvasRenderingContext2D;

  public constructor(context: CanvasRenderingContext2D) {
    this.context = context;
  }

  public render(view: RenderView): void {
    const context = this.context;
    context.save();
    this.drawBackground(view);
    this.drawStars(view.stars);
    this.drawPerspectiveGrid(view.feverActive);

    context.save();
    context.translate(view.shakeOffsetX, view.shakeOffsetY);

    if (view.barrierActive) {
      this.drawBarrier();
    }

    for (const brick of view.bricks) {
      if (brick.alive) {
        this.drawBrick(brick);
      }
    }

    for (const ring of view.shockwaves) {
      this.drawShockwave(ring);
    }

    for (const capsule of view.capsules) {
      if (capsule.alive) {
        this.drawCapsule(capsule);
      }
    }

    for (const laser of view.lasers) {
      if (laser.alive) {
        this.drawLaser(laser);
      }
    }

    this.drawPaddle(view.paddle, view.feverActive);

    for (const ball of view.balls) {
      if (ball.alive) {
        this.drawBall(ball);
      }
    }

    for (const particle of view.particles) {
      this.drawParticle(particle);
    }

    for (const floatingText of view.floatingTexts) {
      this.drawFloatingText(floatingText);
    }

    context.restore();

    this.drawTopTelemetryBar(view);
    if (view.stageBannerTimerSeconds > 0) {
      this.drawStageBanner(view);
    }
    if (view.feverActive) {
      this.drawFeverBorder();
    }

    context.restore();
  }

  private drawBackground(view: RenderView): void {
    const context = this.context;
    const gradient = context.createLinearGradient(0, 0, 0, PLAY_FIELD_HEIGHT);
    if (view.feverActive) {
      gradient.addColorStop(0, '#1a0933');
      gradient.addColorStop(0.55, '#130d2e');
      gradient.addColorStop(1, '#290d36');
    } else {
      gradient.addColorStop(0, '#040712');
      gradient.addColorStop(0.6, '#091024');
      gradient.addColorStop(1, '#140c29');
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, PLAY_FIELD_WIDTH, PLAY_FIELD_HEIGHT);
  }

  private drawStars(stars: readonly Readonly<StarView>[]): void {
    const context = this.context;
    for (const star of stars) {
      context.save();
      context.globalAlpha = Math.min(1, Math.max(0, star.alpha));
      context.fillStyle = star.color;
      context.fillRect(star.x, star.y, star.size, star.size);
      context.restore();
    }
  }

  private drawPerspectiveGrid(feverActive: boolean): void {
    const context = this.context;
    const horizonY = PLAY_FIELD_HEIGHT - 160;
    context.save();
    context.strokeStyle = feverActive ? 'rgba(244, 114, 182, 0.22)' : 'rgba(56, 189, 248, 0.13)';
    context.lineWidth = 1;

    for (let row = 0; row <= 5; row += 1) {
      const progress = row / 5;
      const lineY = horizonY + progress * progress * 160;
      context.beginPath();
      context.moveTo(0, lineY);
      context.lineTo(PLAY_FIELD_WIDTH, lineY);
      context.stroke();
    }

    const vanishingPointX = PLAY_FIELD_WIDTH / 2;
    for (let column = -4; column <= 4; column += 1) {
      context.beginPath();
      context.moveTo(vanishingPointX + column * 24, horizonY);
      context.lineTo(vanishingPointX + column * 95, PLAY_FIELD_HEIGHT);
      context.stroke();
    }
    context.restore();
  }

  private drawBarrier(): void {
    const context = this.context;
    const barrierY = PLAY_FIELD_HEIGHT - 14;
    context.save();
    context.strokeStyle = '#facc15';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(8, barrierY);
    context.lineTo(PLAY_FIELD_WIDTH - 8, barrierY);
    context.stroke();

    context.strokeStyle = '#67e8f9';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(8, barrierY - 3);
    context.lineTo(PLAY_FIELD_WIDTH - 8, barrierY - 3);
    context.stroke();
    context.restore();
  }

  private drawBrick(brick: Readonly<BrickEntity>): void {
    const context = this.context;
    context.save();

    const isFlashing = brick.flashTimerSeconds > 0;
    context.fillStyle = isFlashing ? '#ffffff' : brick.color;
    context.fillRect(brick.x, brick.y, brick.width, brick.height);

    // Top-left specular highlight
    context.fillStyle = 'rgba(255, 255, 255, 0.34)';
    context.fillRect(brick.x, brick.y, brick.width, 3);
    context.fillRect(brick.x, brick.y, 3, brick.height);

    // Bottom-right shade bevel
    context.fillStyle = 'rgba(2, 6, 23, 0.45)';
    context.fillRect(brick.x, brick.y + brick.height - 3, brick.width, 3);
    context.fillRect(brick.x + brick.width - 3, brick.y, 3, brick.height);

    if (brick.kind === 'armored') {
      context.strokeStyle = '#e2e8f0';
      context.lineWidth = 1.5;
      context.strokeRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2);
      if (brick.hitPoints < brick.maximumHitPoints) {
        this.drawBrickCracks(brick);
      }
    } else if (brick.kind === 'explosive') {
      context.fillStyle = '#fef08a';
      context.beginPath();
      const centerX = brick.x + brick.width / 2;
      const centerY = brick.y + brick.height / 2;
      context.moveTo(centerX, centerY - 5);
      context.lineTo(centerX + 6, centerY);
      context.lineTo(centerX, centerY + 5);
      context.lineTo(centerX - 6, centerY);
      context.closePath();
      context.fill();
    } else if (brick.kind === 'splitter') {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1.5;
      const centerX = brick.x + brick.width / 2;
      const centerY = brick.y + brick.height / 2;
      context.beginPath();
      context.moveTo(centerX - 7, centerY + 4);
      context.lineTo(centerX, centerY - 5);
      context.lineTo(centerX + 7, centerY + 4);
      context.stroke();
    } else if (brick.kind === 'indestructible') {
      context.strokeStyle = '#fef08a';
      context.lineWidth = 2;
      context.strokeRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2);
    } else if (brick.kind === 'core') {
      context.strokeStyle = '#f472b6';
      context.lineWidth = 2;
      context.strokeRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(brick.x + brick.width / 2, brick.y + brick.height / 2, 4, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  private drawBrickCracks(brick: Readonly<BrickEntity>): void {
    const context = this.context;
    context.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(brick.x + 8, brick.y + 3);
    context.lineTo(brick.x + brick.width * 0.45, brick.y + brick.height * 0.55);
    context.lineTo(brick.x + brick.width * 0.72, brick.y + brick.height - 3);
    context.stroke();
  }

  private drawShockwave(ring: Readonly<ShockwaveRing>): void {
    const context = this.context;
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, ring.alpha));
    context.strokeStyle = ring.color;
    context.lineWidth = ring.lineWidth;
    context.beginPath();
    context.arc(ring.x, ring.y, Math.max(1, ring.currentRadius), 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  private drawCapsule(capsule: Readonly<PowerUpCapsule>): void {
    const context = this.context;
    context.save();
    const cornerRadius = 6;
    context.fillStyle = capsule.color;
    context.beginPath();
    context.roundRect(capsule.x, capsule.y, capsule.width, capsule.height, cornerRadius);
    context.fill();

    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.5;
    context.stroke();

    context.fillStyle = '#020617';
    context.font = '900 11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      capsule.label,
      capsule.x + capsule.width / 2,
      capsule.y + capsule.height / 2 + 0.5,
    );
    context.restore();
  }

  private drawLaser(laser: Readonly<LaserProjectile>): void {
    const context = this.context;
    context.save();
    context.fillStyle = laser.color;
    context.fillRect(
      laser.x - laser.width / 2,
      laser.y - laser.height / 2,
      laser.width,
      laser.height,
    );
    context.fillStyle = '#ffffff';
    context.fillRect(laser.x - 1, laser.y - laser.height / 2 + 1, 2, Math.max(2, laser.height - 2));
    context.restore();
  }

  private drawPaddle(paddle: Readonly<PaddleEntity>, feverActive: boolean): void {
    const context = this.context;
    const centerX = paddle.x + paddle.width / 2;
    const centerY = paddle.y + paddle.height / 2;
    const parryActive = paddle.parryCharged || paddle.parryWindowRemainingSeconds > 0;

    context.save();
    context.translate(centerX, centerY);
    context.scale(paddle.scaleX, paddle.scaleY);

    const halfWidth = paddle.width / 2;
    const halfHeight = paddle.height / 2;

    if (parryActive) {
      context.strokeStyle = '#facc15';
      context.lineWidth = 3;
      context.strokeRect(-halfWidth - 4, -halfHeight - 4, paddle.width + 8, paddle.height + 8);
    }

    context.fillStyle = parryActive ? '#fde047' : feverActive ? '#f472b6' : '#38bdf8';
    context.beginPath();
    context.roundRect(-halfWidth, -halfHeight, paddle.width, paddle.height, 6);
    context.fill();

    // Inner core strip
    context.fillStyle = '#e0f2fe';
    context.fillRect(-halfWidth + 8, -halfHeight + 3, Math.max(4, paddle.width - 16), 4);

    if (paddle.laserRemainingSeconds > 0) {
      context.fillStyle = '#f87171';
      context.fillRect(-halfWidth + 2, -halfHeight - 6, 5, 6);
      context.fillRect(halfWidth - 7, -halfHeight - 6, 5, 6);
    }

    if (paddle.magnetRemainingSeconds > 0) {
      context.strokeStyle = '#c084fc';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-halfWidth + 10, -halfHeight - 3);
      context.lineTo(halfWidth - 10, -halfHeight - 3);
      context.stroke();
    }

    context.restore();
  }

  private drawBall(ball: Readonly<BallEntity>): void {
    const context = this.context;
    context.save();

    if (ball.attachedToPaddle) {
      context.save();
      context.strokeStyle = 'rgba(103, 232, 249, 0.55)';
      context.lineWidth = 1.5;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(ball.x, ball.y);
      context.lineTo(
        ball.x + Math.sin(ball.launchAngleRadians) * 58,
        ball.y - Math.cos(ball.launchAngleRadians) * 58,
      );
      context.stroke();
      context.restore();
    }

    for (const point of ball.trail) {
      context.save();
      context.globalAlpha = Math.min(1, Math.max(0, point.alpha));
      context.fillStyle = point.color;
      context.beginPath();
      context.arc(point.x, point.y, Math.max(1, point.radius), 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    const ballColor =
      ball.pierceRemainingSeconds > 0 ? '#fb923c' : ball.parryBoostActive ? '#fde047' : '#f8fafc';

    context.fillStyle = ballColor;
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle =
      ball.pierceRemainingSeconds > 0 ? '#fef08a' : ball.parryBoostActive ? '#38bdf8' : '#67e8f9';
    context.lineWidth = 2;
    context.stroke();

    context.restore();
  }

  private drawParticle(particle: Readonly<RenderParticleView>): void {
    const context = this.context;
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, particle.alpha));
    context.fillStyle = particle.color;
    context.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size,
    );
    context.restore();
  }

  private drawFloatingText(floatingText: Readonly<RenderFloatingTextView>): void {
    const context = this.context;
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, floatingText.alpha));
    context.font = '800 13px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeStyle = '#020617';
    context.lineWidth = 3;
    context.strokeText(floatingText.text, floatingText.x, floatingText.y);
    context.fillStyle = floatingText.color;
    context.fillText(floatingText.text, floatingText.x, floatingText.y);
    context.restore();
  }

  private drawTopTelemetryBar(view: RenderView): void {
    const context = this.context;
    context.save();
    const barX = 12;
    const barY = 14;
    const barWidth = 160;
    const barHeight = 8;

    context.fillStyle = 'rgba(15, 23, 42, 0.85)';
    context.fillRect(barX, barY, barWidth, barHeight);
    context.strokeStyle = '#334155';
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barWidth, barHeight);

    const clampedFever = Math.min(1, Math.max(0, view.feverMeter));
    context.fillStyle = view.feverActive ? '#f472b6' : '#38bdf8';
    context.fillRect(barX + 1, barY + 1, (barWidth - 2) * clampedFever, barHeight - 2);

    context.font = '700 10px system-ui, sans-serif';
    context.fillStyle = view.feverActive ? '#fde047' : '#94a3b8';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillText(
      view.feverActive ? 'SHATTER FEVER x2!' : 'PRISM CHARGE',
      barX,
      barY + barHeight + 4,
    );

    if (view.combo > 1) {
      context.font = '800 12px system-ui, sans-serif';
      context.fillStyle = '#fde047';
      context.textAlign = 'right';
      context.fillText(`CHAIN x${view.combo}`, PLAY_FIELD_WIDTH - 12, barY);
    }

    context.restore();
  }

  private drawStageBanner(view: RenderView): void {
    const context = this.context;
    context.save();
    const alpha = Math.min(1, view.stageBannerTimerSeconds / 0.5);
    context.globalAlpha = alpha;
    context.fillStyle = 'rgba(2, 6, 23, 0.78)';
    context.fillRect(40, PLAY_FIELD_HEIGHT / 2 - 44, PLAY_FIELD_WIDTH - 80, 76);
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 2;
    context.strokeRect(40, PLAY_FIELD_HEIGHT / 2 - 44, PLAY_FIELD_WIDTH - 80, 76);

    context.fillStyle = '#f8fafc';
    context.font = '900 18px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      `STAGE ${view.stage}: ${view.stageName.toUpperCase()}`,
      PLAY_FIELD_WIDTH / 2,
      PLAY_FIELD_HEIGHT / 2 - 16,
    );

    context.fillStyle = '#67e8f9';
    context.font = '700 12px system-ui, sans-serif';
    context.fillText(view.stageSubtitle, PLAY_FIELD_WIDTH / 2, PLAY_FIELD_HEIGHT / 2 + 12);
    context.restore();
  }

  private drawFeverBorder(): void {
    const context = this.context;
    context.save();
    context.strokeStyle = '#f472b6';
    context.lineWidth = 4;
    context.strokeRect(2, 2, PLAY_FIELD_WIDTH - 4, PLAY_FIELD_HEIGHT - 4);
    context.restore();
  }
}

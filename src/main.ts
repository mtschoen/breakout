import './style.css';
import { AudioEngine } from './audio/audio-engine';
import { InputState, type TouchControl } from './engine/input';
import { startLoop } from './engine/loop';
import { Game } from './game/game';
import { PLAY_FIELD_HEIGHT, PLAY_FIELD_WIDTH } from './game/types';
import { Renderer } from './render/renderer';

const HIGH_SCORE_STORAGE_KEY = 'prism-breakout.high-score';

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  textContent = '',
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  if (textContent.length > 0) {
    element.textContent = textContent;
  }
  return element;
}

function buildHudItem(
  label: string,
  valueClassName = 'hud-value',
): { item: HTMLDivElement; value: HTMLSpanElement } {
  const item = createElement('div', 'hud-item');
  const labelElement = createElement('span', 'hud-label', label);
  const value = createElement('span', valueClassName, '-');
  item.append(labelElement, value);
  return { item, value };
}

export function readStoredHighScore(): number {
  try {
    const rawValue = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    if (rawValue === null) {
      return 0;
    }
    const parsedValue = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  } catch {
    return 0;
  }
}

export function writeStoredHighScore(highScore: number): void {
  try {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(Math.max(0, Math.floor(highScore))));
  } catch {
    // Storage may be unavailable in restricted browsing modes.
  }
}

export function boot(): { game: Game; audioEngine: AudioEngine } {
  if (typeof __BUILD_IDENTIFIER__ === 'string') {
    document.documentElement.dataset.buildId = __BUILD_IDENTIFIER__;
  }

  const application = document.querySelector<HTMLDivElement>('#app');
  if (application === null) {
    throw new Error('Missing #app element');
  }

  const audioEngine = new AudioEngine();
  const game = new Game({
    audio: audioEngine,
    initialHighScore: readStoredHighScore(),
    onHighScoreChange: writeStoredHighScore,
    reducedMotion: false,
  });
  const input = new InputState();

  const cabinet = createElement('main', 'cabinet');
  const header = createElement('header', 'cabinet-header');
  const title = createElement('h1', 'game-title');
  title.innerHTML = 'PRISM <span>BREAKOUT</span>';
  const subtitle = createElement('p', 'game-subtitle', 'Shatterwave');
  header.append(title, subtitle);

  const hudBar = createElement('section', 'hud-bar');
  hudBar.setAttribute('aria-label', 'Game status');
  const scoreHud = buildHudItem('Score');
  const highScoreHud = buildHudItem('Best');
  const livesHud = buildHudItem('Lives');
  const stageHud = buildHudItem('Stage');
  const powerUpHud = buildHudItem('Power-Up', 'hud-value powerup');
  hudBar.append(scoreHud.item, highScoreHud.item, livesHud.item, stageHud.item, powerUpHud.item);

  const stageFrame = createElement('div', 'stage-frame');
  const canvas = createElement('canvas', 'game-canvas');
  canvas.width = PLAY_FIELD_WIDTH;
  canvas.height = PLAY_FIELD_HEIGHT;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Prism Breakout playfield');
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas 2D context is not available');
  }
  const renderer = new Renderer(context);

  const startOverlay = createElement('div', 'overlay');
  const startTitle = createElement('h2', '', 'PRISM BREAKOUT');
  const startText = createElement(
    'p',
    '',
    'Shatter neon synthwave formations, chain harmonic combos into 2x Shatter Fever, and tap Space right before impact for a Prism Smash parry boost!',
  );
  const startButton = createElement('button', 'primary-button', 'Launch Run');
  startButton.type = 'button';
  startOverlay.append(startTitle, startText, startButton);

  const pauseOverlay = createElement('div', 'overlay');
  pauseOverlay.hidden = true;
  const pauseTitle = createElement('h2', '', 'Paused');
  const resumeButton = createElement('button', 'primary-button', 'Resume');
  resumeButton.type = 'button';
  pauseOverlay.append(pauseTitle, resumeButton);

  const gameOverOverlay = createElement('div', 'overlay');
  gameOverOverlay.hidden = true;
  const gameOverTitle = createElement('h2', '', 'Shattered');
  const finalScore = createElement('p', 'final-score', 'Score 0');
  const restartButton = createElement('button', 'primary-button', 'Play Again');
  restartButton.type = 'button';
  gameOverOverlay.append(gameOverTitle, finalScore, restartButton);

  stageFrame.append(canvas, startOverlay, pauseOverlay, gameOverOverlay);

  const controlsBar = createElement('div', 'controls-bar');
  const pauseButton = createElement('button', 'control-button', 'Pause');
  pauseButton.type = 'button';
  const muteButton = createElement('button', 'control-button', 'Mute');
  muteButton.type = 'button';
  const controlsRestartButton = createElement('button', 'control-button', 'Restart');
  controlsRestartButton.type = 'button';
  controlsBar.append(pauseButton, muteButton, controlsRestartButton);

  const helpText = createElement(
    'p',
    'help-text',
    'Move: Arrows / A-D / Mouse. Launch, Parry Smash & Lasers: Space / Click. Pause: P / Esc. Mute: M. Collect M, W, L, F, C, S capsules.',
  );

  const footer = createElement('footer', 'cabinet-footer');
  const creditText = createElement('span', 'credit-text', 'Created by Gemini 4 argon');
  const footerSeparator = createElement('span', 'footer-separator', '·');
  footerSeparator.setAttribute('aria-hidden', 'true');
  const sourceLink = createElement('a', 'source-link', 'GitHub ↗');
  sourceLink.href = 'https://github.com/mtschoen/breakout';
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  sourceLink.setAttribute('aria-label', 'View Prism Breakout on GitHub (opens in a new tab)');
  footer.append(creditText, footerSeparator, sourceLink);

  const touchDeck = createElement('div', 'touch-deck');
  touchDeck.setAttribute('role', 'group');
  touchDeck.setAttribute('aria-label', 'Touch controls');

  function buildTouchButton(
    control: TouchControl,
    ariaLabel: string,
    symbol: string,
    caption: string,
  ): HTMLButtonElement {
    const button = createElement('button', 'touch-button');
    button.type = 'button';
    button.dataset.touchControl = control;
    button.setAttribute('aria-label', ariaLabel);
    const letterElement = createElement('span', 'touch-button-letter', symbol);
    const captionElement = createElement('small', 'touch-button-caption', caption);
    button.append(letterElement, captionElement);
    return button;
  }

  const leftButton = buildTouchButton('left', 'Steer paddle left', '◄', 'LEFT');
  const rightButton = buildTouchButton('right', 'Steer paddle right', '►', 'RIGHT');
  const launchButton = buildTouchButton(
    'launch',
    'Launch ball, Parry Smash, or fire lasers',
    '▲',
    'LAUNCH / PARRY',
  );
  const touchButtons = [leftButton, rightButton, launchButton];
  touchDeck.append(leftButton, rightButton, launchButton);

  cabinet.append(header, hudBar, stageFrame, controlsBar, helpText, footer, touchDeck);
  application.replaceChildren(cabinet);

  const touchPointers = new Map<number, TouchControl>();
  const touchControls: TouchControl[] = ['left', 'right', 'launch'];

  function releaseTouchPointer(pointerIdentifier: number): void {
    const control = touchPointers.get(pointerIdentifier);
    if (control === undefined) {
      return;
    }
    touchPointers.delete(pointerIdentifier);
    input.touchButtonUp(control);
    if (![...touchPointers.values()].includes(control)) {
      for (const button of touchButtons) {
        if (button.dataset.touchControl === control) {
          button.classList.remove('is-held');
        }
      }
    }
  }

  function clearTouchButtons(): void {
    touchPointers.clear();
    for (const control of touchControls) {
      input.touchButtonUp(control);
    }
    for (const button of touchButtons) {
      button.classList.remove('is-held');
    }
  }

  for (const button of touchButtons) {
    const control = button.dataset.touchControl as TouchControl;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      audioEngine.handleUserGesture();
      if (event.button > 0 || touchPointers.has(event.pointerId)) {
        return;
      }
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional.
      }
      touchPointers.set(event.pointerId, control);
      input.touchButtonDown(control);
      button.classList.add('is-held');
    });
    button.addEventListener('pointerup', (event) => releaseTouchPointer(event.pointerId));
    button.addEventListener('pointercancel', (event) => releaseTouchPointer(event.pointerId));
    button.addEventListener('lostpointercapture', (event) => releaseTouchPointer(event.pointerId));
    button.addEventListener('click', (event) => {
      if (event.detail !== 0) {
        return;
      }
      input.touchButtonDown(control);
      input.touchButtonUp(control);
    });
  }

  function updateCanvasPointerPosition(clientX: number): void {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    const normalizedX = ((clientX - bounds.left) / bounds.width) * PLAY_FIELD_WIDTH;
    input.setPointerPlayfieldX(normalizedX);
  }

  window.addEventListener('pointermove', (event) => {
    if (!touchPointers.has(event.pointerId)) {
      updateCanvasPointerPosition(event.clientX);
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    updateCanvasPointerPosition(event.clientX);
  });
  canvas.addEventListener('pointerdown', (event) => {
    audioEngine.handleUserGesture();
    updateCanvasPointerPosition(event.clientX);
    if (event.button === 0) {
      input.triggerPointerLaunch();
    }
  });

  let displayedState = '';

  function refreshInterface(): void {
    const snapshot = game.getSnapshot();
    scoreHud.value.textContent = String(snapshot.score);
    highScoreHud.value.textContent = String(snapshot.highScore);
    livesHud.value.textContent = String(Math.max(0, snapshot.lives));
    stageHud.value.textContent = String(snapshot.stage);
    powerUpHud.value.textContent = snapshot.activePowerUpLabel;
    pauseButton.textContent = snapshot.state === 'paused' ? 'Resume' : 'Pause';
    muteButton.textContent = audioEngine.isMuted ? 'Unmute' : 'Mute';

    if (snapshot.state !== displayedState) {
      displayedState = snapshot.state;
      cabinet.classList.toggle('is-playing', snapshot.state === 'playing');
      touchDeck.classList.toggle('is-visible', snapshot.state === 'playing');
      if (snapshot.state !== 'playing') {
        clearTouchButtons();
      }
      startOverlay.hidden = snapshot.state !== 'ready';
      pauseOverlay.hidden = snapshot.state !== 'paused';
      gameOverOverlay.hidden = snapshot.state !== 'over';
      if (snapshot.state === 'over') {
        finalScore.textContent = `Score ${snapshot.score} - Stage ${snapshot.stage} (Best ${snapshot.highScore})`;
      }
      if (snapshot.state === 'ready') {
        startButton.focus();
      }
      if (snapshot.state === 'over') {
        restartButton.focus();
      }
    }
  }

  function startRun(): void {
    audioEngine.handleUserGesture();
    audioEngine.unlock();
    game.start();
    refreshInterface();
    canvas.focus();
  }

  startButton.addEventListener('click', startRun);
  restartButton.addEventListener('click', startRun);
  controlsRestartButton.addEventListener('click', startRun);
  resumeButton.addEventListener('click', () => {
    game.resume();
    refreshInterface();
  });
  pauseButton.addEventListener('click', () => {
    game.togglePause();
    refreshInterface();
  });
  muteButton.addEventListener('click', () => {
    audioEngine.toggleMuted();
    audioEngine.uiClick();
    refreshInterface();
  });

  window.addEventListener('keydown', (event) => {
    audioEngine.handleUserGesture();
    const snapshot = game.getSnapshot();
    if (event.code === 'Enter') {
      if (snapshot.state === 'ready' || snapshot.state === 'over') {
        event.preventDefault();
        startRun();
      } else if (snapshot.state === 'paused') {
        event.preventDefault();
        game.resume();
        refreshInterface();
      }
    }
    if (event.code === 'KeyM') {
      audioEngine.toggleMuted();
      refreshInterface();
    }
  });

  window.addEventListener('blur', () => {
    if (game.getSnapshot().state === 'playing') {
      game.pause();
      refreshInterface();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.getSnapshot().state === 'playing') {
      game.pause();
      refreshInterface();
    }
  });

  input.attach(window);
  startLoop(
    (deltaSeconds) => {
      game.update(deltaSeconds, input);
    },
    () => {
      const renderView = game.getRenderView();
      renderer.render(renderView);
      if (renderView.shakeOffsetX !== 0 || renderView.shakeOffsetY !== 0) {
        const bezelOffsetX = (renderView.shakeOffsetX * 0.45).toFixed(1);
        const bezelOffsetY = (renderView.shakeOffsetY * 0.45).toFixed(1);
        stageFrame.style.transform = `translate(${bezelOffsetX}px, ${bezelOffsetY}px)`;
      } else {
        stageFrame.style.transform = '';
      }
      refreshInterface();
    },
  );
  refreshInterface();
  return { game, audioEngine };
}

export function autoBoot(): void {
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          boot();
        },
        { once: true },
      );
    } else if (document.querySelector('#app') !== null) {
      boot();
    }
  }
}

autoBoot();

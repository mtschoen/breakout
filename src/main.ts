import './style.css';
import { AudioEngine } from './audio/audio-engine';
import { InputState, type TouchControl } from './engine/input';
import { startLoop } from './engine/loop';
import { Game } from './game/game';
import { PLAY_FIELD_HEIGHT, PLAY_FIELD_WIDTH, type JuiceSettings } from './game/types';
import { Renderer } from './render/renderer';

const HIGH_SCORE_STORAGE_KEY = 'prism-breakout.high-score';
const JUICE_SETTINGS_STORAGE_KEY = 'prism-breakout.juice-settings';

export const DEFAULT_JUICE_SETTINGS: Readonly<JuiceSettings> = {
  particleDensity: 1,
  particleSize: 1,
  screenShake: 1,
  reducedMotion: false,
};

type JuiceNumericKey = 'particleDensity' | 'particleSize' | 'screenShake';

const JUICE_SLIDER_DEFINITIONS: readonly { key: JuiceNumericKey; label: string }[] = [
  { key: 'particleDensity', label: 'Particle density' },
  { key: 'particleSize', label: 'Particle size' },
  { key: 'screenShake', label: 'Screen shake' },
];

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

function createButton(className: string, textContent = ''): HTMLButtonElement {
  const button = createElement('button', className, textContent);
  button.type = 'button';
  return button;
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

function clampMultiplier(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(3, Math.max(0, value));
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

export function readStoredJuiceSettings(): JuiceSettings {
  try {
    const rawValue = window.localStorage.getItem(JUICE_SETTINGS_STORAGE_KEY);
    if (rawValue === null) {
      return { ...DEFAULT_JUICE_SETTINGS };
    }
    const parsed = JSON.parse(rawValue) as Partial<JuiceSettings>;
    return {
      particleDensity: clampMultiplier(
        parsed.particleDensity,
        DEFAULT_JUICE_SETTINGS.particleDensity,
      ),
      particleSize: clampMultiplier(parsed.particleSize, DEFAULT_JUICE_SETTINGS.particleSize),
      screenShake: clampMultiplier(parsed.screenShake, DEFAULT_JUICE_SETTINGS.screenShake),
      reducedMotion:
        typeof parsed.reducedMotion === 'boolean'
          ? parsed.reducedMotion
          : DEFAULT_JUICE_SETTINGS.reducedMotion,
    };
  } catch {
    return { ...DEFAULT_JUICE_SETTINGS };
  }
}

export function writeStoredJuiceSettings(settings: JuiceSettings): void {
  try {
    window.localStorage.setItem(JUICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
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

  const juiceSettings = readStoredJuiceSettings();
  const audioEngine = new AudioEngine();
  const game = new Game({
    audio: audioEngine,
    initialHighScore: readStoredHighScore(),
    onHighScoreChange: writeStoredHighScore,
    reducedMotion: juiceSettings.reducedMotion,
  });
  game.setJuiceSettings(juiceSettings);
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
  const startButton = createButton('primary-button', 'Launch Run');
  startOverlay.append(startTitle, startText, startButton);

  const pauseOverlay = createElement('div', 'overlay');
  pauseOverlay.hidden = true;
  const pauseTitle = createElement('h2', '', 'Paused');
  const resumeButton = createButton('primary-button', 'Resume');
  pauseOverlay.append(pauseTitle, resumeButton);

  const gameOverOverlay = createElement('div', 'overlay');
  gameOverOverlay.hidden = true;
  const gameOverTitle = createElement('h2', '', 'Shattered');
  const finalScore = createElement('p', 'final-score', 'Score 0');
  const restartButton = createButton('primary-button', 'Play Again');
  gameOverOverlay.append(gameOverTitle, finalScore, restartButton);

  const settingsOverlay = createElement('div', 'overlay settings-overlay');
  settingsOverlay.hidden = true;
  const settingsPanel = createElement('div', 'settings-panel');
  const settingsEyebrow = createElement('span', 'settings-eyebrow', 'JUICE LAB');
  const settingsTitle = createElement('h2', '', 'Your Mix');
  const settingsHint = createElement(
    'p',
    'settings-hint',
    'Tune the sparks and screen shake. 100% is the default mix.',
  );
  const slidersContainer = createElement('div', 'settings-sliders');
  const sliderInputs = new Map<JuiceNumericKey, HTMLInputElement>();
  const sliderOutputs = new Map<JuiceNumericKey, HTMLSpanElement>();

  function syncJuiceControls(): void {
    for (const { key } of JUICE_SLIDER_DEFINITIONS) {
      const percent = Math.round(juiceSettings[key] * 100);
      const slider = sliderInputs.get(key)!;
      const output = sliderOutputs.get(key)!;
      slider.value = String(percent);
      slider.disabled = juiceSettings.reducedMotion;
      output.textContent = `${percent}%`;
    }
    reducedMotionButton.textContent = juiceSettings.reducedMotion
      ? 'Reduced Motion: On'
      : 'Reduced Motion: Off';
    settingsHint.textContent = juiceSettings.reducedMotion
      ? 'Reduced motion is on. Turn it off to preview sparks and screen shake.'
      : 'Tune the sparks and screen shake. 100% is the default mix.';
  }

  function applyAndSaveJuiceSettings(): void {
    game.setJuiceSettings(juiceSettings);
    writeStoredJuiceSettings(juiceSettings);
    syncJuiceControls();
  }

  for (const { key, label } of JUICE_SLIDER_DEFINITIONS) {
    const row = createElement('div', 'setting-group');
    const headerRow = createElement('div', 'setting-label-row');
    const labelElement = createElement('label', 'setting-label', label);
    const sliderIdentifier = `juice-${key}`;
    labelElement.setAttribute('for', sliderIdentifier);
    const outputElement = createElement('span', 'setting-value', '100%');
    headerRow.append(labelElement, outputElement);

    const slider = createElement('input', 'setting-range');
    slider.type = 'range';
    slider.id = sliderIdentifier;
    slider.min = '0';
    slider.max = '300';
    slider.step = '5';
    slider.value = String(Math.round(juiceSettings[key] * 100));
    slider.dataset.juiceKey = key;
    slider.addEventListener('input', () => {
      const parsedPercent = Number.parseFloat(slider.value);
      if (Number.isFinite(parsedPercent)) {
        juiceSettings[key] = clampMultiplier(parsedPercent / 100, DEFAULT_JUICE_SETTINGS[key]);
        applyAndSaveJuiceSettings();
      }
    });

    sliderInputs.set(key, slider);
    sliderOutputs.set(key, outputElement);
    row.append(headerRow, slider);
    slidersContainer.append(row);
  }

  const reducedMotionButton = createButton('control-button settings-toggle-button');
  reducedMotionButton.addEventListener('click', () => {
    audioEngine.uiClick();
    juiceSettings.reducedMotion = !juiceSettings.reducedMotion;
    applyAndSaveJuiceSettings();
  });

  const settingsActions = createElement('div', 'settings-actions');
  const previewJuiceButton = createButton('control-button', 'Test Mix');
  const resetJuiceButton = createButton('control-button', 'Reset 100%');
  const closeSettingsButton = createButton('primary-button', 'Done');
  settingsActions.append(previewJuiceButton, resetJuiceButton, closeSettingsButton);

  settingsPanel.append(
    settingsEyebrow,
    settingsTitle,
    slidersContainer,
    reducedMotionButton,
    settingsHint,
    settingsActions,
  );
  settingsOverlay.append(settingsPanel);
  syncJuiceControls();

  stageFrame.append(canvas, startOverlay, pauseOverlay, gameOverOverlay, settingsOverlay);

  const controlsBar = createElement('div', 'controls-bar');
  const pauseButton = createButton('control-button', 'Pause');
  const muteButton = createButton('control-button', 'Mute');
  const settingsButton = createButton('control-button', 'Settings');
  const controlsRestartButton = createButton('control-button', 'Restart');
  controlsBar.append(pauseButton, muteButton, settingsButton, controlsRestartButton);

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
    const button = createButton('touch-button');
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
  let settingsOpen = false;

  function refreshInterface(): void {
    const snapshot = game.getSnapshot();
    scoreHud.value.textContent = String(snapshot.score);
    highScoreHud.value.textContent = String(snapshot.highScore);
    livesHud.value.textContent = String(Math.max(0, snapshot.lives));
    stageHud.value.textContent = String(snapshot.stage);
    powerUpHud.value.textContent = snapshot.activePowerUpLabel;
    pauseButton.textContent = snapshot.state === 'paused' ? 'Resume' : 'Pause';
    muteButton.textContent = audioEngine.isMuted ? 'Unmute' : 'Mute';

    const compositeState = `${snapshot.state}:${settingsOpen ? 'settings' : 'normal'}`;
    if (compositeState !== displayedState) {
      displayedState = compositeState;
      const isPlayingActive = snapshot.state === 'playing' && !settingsOpen;
      cabinet.classList.toggle('is-playing', isPlayingActive);
      touchDeck.classList.toggle('is-visible', isPlayingActive);
      if (!isPlayingActive) {
        clearTouchButtons();
      }
      settingsOverlay.hidden = !settingsOpen;
      startOverlay.hidden = settingsOpen || snapshot.state !== 'ready';
      pauseOverlay.hidden = settingsOpen || snapshot.state !== 'paused';
      gameOverOverlay.hidden = settingsOpen || snapshot.state !== 'over';
      if (snapshot.state === 'over') {
        finalScore.textContent = `Score ${snapshot.score} - Stage ${snapshot.stage} (Best ${snapshot.highScore})`;
      }
      if (!settingsOpen && snapshot.state === 'ready') {
        startButton.focus();
      }
      if (!settingsOpen && snapshot.state === 'over') {
        restartButton.focus();
      }
    }
  }

  function startRun(): void {
    settingsOpen = false;
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
    settingsOpen = false;
    game.resume();
    refreshInterface();
  });
  pauseButton.addEventListener('click', () => {
    settingsOpen = false;
    game.togglePause();
    refreshInterface();
  });
  muteButton.addEventListener('click', () => {
    audioEngine.toggleMuted();
    audioEngine.uiClick();
    refreshInterface();
  });
  settingsButton.addEventListener('click', () => {
    audioEngine.handleUserGesture();
    audioEngine.uiClick();
    if (!settingsOpen && game.getSnapshot().state === 'playing') {
      game.pause();
    }
    settingsOpen = !settingsOpen;
    refreshInterface();
  });
  closeSettingsButton.addEventListener('click', () => {
    audioEngine.uiClick();
    settingsOpen = false;
    refreshInterface();
  });
  previewJuiceButton.addEventListener('click', () => {
    audioEngine.handleUserGesture();
    audioEngine.unlock();
    game.previewJuiceImpact();
  });
  resetJuiceButton.addEventListener('click', () => {
    audioEngine.uiClick();
    juiceSettings.particleDensity = DEFAULT_JUICE_SETTINGS.particleDensity;
    juiceSettings.particleSize = DEFAULT_JUICE_SETTINGS.particleSize;
    juiceSettings.screenShake = DEFAULT_JUICE_SETTINGS.screenShake;
    juiceSettings.reducedMotion = DEFAULT_JUICE_SETTINGS.reducedMotion;
    applyAndSaveJuiceSettings();
  });

  window.addEventListener('keydown', (event) => {
    audioEngine.handleUserGesture();
    const snapshot = game.getSnapshot();
    if (event.code === 'Enter' && !settingsOpen) {
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
        const bezelOffsetX = Math.max(-1.2, Math.min(1.2, renderView.shakeOffsetX * 0.14)).toFixed(
          1,
        );
        const bezelOffsetY = Math.max(-1.2, Math.min(1.2, renderView.shakeOffsetY * 0.14)).toFixed(
          1,
        );
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

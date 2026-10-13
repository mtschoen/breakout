import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeElement {
  tagName: string;
  className: string;
  textContent: string;
  innerHTML: string;
  hidden: boolean;
  type: string;
  href: string;
  target: string;
  rel: string;
  tabIndex: number;
  width: number;
  height: number;
  dataset: Record<string, string>;
  style: { transform: string };
  attributes: Map<string, string>;
  children: FakeElement[];
  listeners: Map<string, EventListener[]>;
  classSet: Set<string>;
  classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    toggle: (token: string, force?: boolean) => boolean;
    contains: (token: string) => boolean;
  };
  append: (...nodes: FakeElement[]) => void;
  replaceChildren: (...nodes: FakeElement[]) => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatch: (type: string, eventInit?: Record<string, unknown>) => void;
  focus: () => void;
  setPointerCapture: (pointerId: number) => void;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  getContext: (contextId: string) => CanvasRenderingContext2D | null;
}

function createFakeCanvasContext(): CanvasRenderingContext2D {
  const gradientStub = {
    addColorStop: () => {},
  };
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    quadraticCurveTo: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
    createLinearGradient: () => gradientStub,
    createRadialGradient: () => gradientStub,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;
}

function createFakeElement(
  tagName: string,
  allCreatedElements: FakeElement[],
  canvasContext: CanvasRenderingContext2D | null,
): FakeElement {
  const classSet = new Set<string>();
  const listeners = new Map<string, EventListener[]>();
  const attributes = new Map<string, string>();
  const children: FakeElement[] = [];

  const element: FakeElement = {
    tagName: tagName.toLowerCase(),
    className: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    type: '',
    href: '',
    target: '',
    rel: '',
    tabIndex: -1,
    width: 480,
    height: 640,
    dataset: {},
    style: { transform: '' },
    attributes,
    children,
    listeners,
    classSet,
    classList: {
      add: (...tokens: string[]) => {
        for (const token of tokens) {
          classSet.add(token);
        }
      },
      remove: (...tokens: string[]) => {
        for (const token of tokens) {
          classSet.delete(token);
        }
      },
      toggle: (token: string, force?: boolean) => {
        const shouldAdd = force ?? !classSet.has(token);
        if (shouldAdd) {
          classSet.add(token);
        } else {
          classSet.delete(token);
        }
        return shouldAdd;
      },
      contains: (token: string) => classSet.has(token),
    },
    append: (...nodes: FakeElement[]) => {
      children.push(...nodes);
    },
    replaceChildren: (...nodes: FakeElement[]) => {
      children.length = 0;
      children.push(...nodes);
    },
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value);
    },
    addEventListener: (type: string, listener: EventListener) => {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      const bucket = listeners.get(type) ?? [];
      listeners.set(
        type,
        bucket.filter((entry) => entry !== listener),
      );
    },
    dispatch: (type: string, eventInit: Record<string, unknown> = {}) => {
      const eventObject = {
        type,
        button: 0,
        detail: 1,
        pointerId: 1,
        clientX: 240,
        clientY: 320,
        preventDefault: () => {},
        ...eventInit,
      } as unknown as Event;
      for (const listener of listeners.get(type) ?? []) {
        listener(eventObject);
      }
    },
    focus: () => {},
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 640 }),
    getContext: () => canvasContext,
  };

  allCreatedElements.push(element);
  return element;
}

describe('Application cabinet bootstrap (src/main.ts)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('boots cabinet DOM, updates HUD, handles overlays, touch controls, pointer input, and keyboard shortcuts', async () => {
    const allElements: FakeElement[] = [];
    const canvasContext = createFakeCanvasContext();
    const appContainer = createFakeElement('div', allElements, canvasContext);
    const windowListeners = new Map<string, EventListener[]>();
    const documentListeners = new Map<string, EventListener[]>();
    let reducedMotionChangeHandler: ((event: { matches: boolean }) => void) | null = null;
    const storageMap = new Map<string, string>([['prism-breakout.high-score', '2500']]);
    const scheduledFrameCallbacks: Array<(timestampMilliseconds: number) => void> = [];

    const fakeDocument = {
      readyState: 'complete',
      hidden: false,
      documentElement: { dataset: {} as Record<string, string> },
      querySelector: (selector: string) => (selector === '#app' ? appContainer : null),
      createElement: (tagName: string) => createFakeElement(tagName, allElements, canvasContext),
      addEventListener: (type: string, listener: EventListener) => {
        const bucket = documentListeners.get(type) ?? [];
        bucket.push(listener);
        documentListeners.set(type, bucket);
      },
    };

    const fakeWindow = {
      localStorage: {
        getItem: (key: string) => storageMap.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storageMap.set(key, value);
        },
      },
      matchMedia: () => ({
        matches: false,
        addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
          reducedMotionChangeHandler = listener;
        },
      }),
      addEventListener: (type: string, listener: EventListener) => {
        const bucket = windowListeners.get(type) ?? [];
        bucket.push(listener);
        windowListeners.set(type, bucket);
      },
      removeEventListener: () => {},
    };

    vi.stubGlobal('__BUILD_IDENTIFIER__', 'test-build-id');
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('requestAnimationFrame', (callback: (timestampMilliseconds: number) => void) => {
      scheduledFrameCallbacks.push(callback);
      return scheduledFrameCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const { boot } = await import('../src/main');
    expect(fakeDocument.documentElement.dataset.buildId).toBe('test-build-id');

    const findButtonByText = (label: string): FakeElement => {
      const match = allElements.find(
        (element) => element.tagName === 'button' && element.textContent === label,
      );
      if (!match) {
        throw new Error(`Button not found: ${label}`);
      }
      return match;
    };

    const launchRunButton = findButtonByText('Launch Run');
    const pauseButton = findButtonByText('Pause');
    const muteButton = findButtonByText('Mute');
    const resumeButton = findButtonByText('Resume');
    const restartButton = findButtonByText('Restart');
    const sourceLinkElement = allElements.find(
      (element) => element.tagName === 'a' && element.className.includes('source-link'),
    );
    expect(sourceLinkElement?.href).toBe('https://github.com/mtschoen/breakout');
    expect(sourceLinkElement?.target).toBe('_blank');
    const canvasElement = allElements.find((element) => element.tagName === 'canvas')!;

    // Trigger reduced-motion preference change
    expect(reducedMotionChangeHandler).not.toBeNull();
    reducedMotionChangeHandler!({ matches: true });

    // Start run via Enter key from ready state
    for (const listener of windowListeners.get('keydown') ?? []) {
      listener({ code: 'Enter', preventDefault: () => {} } as unknown as Event);
    }

    // Run two animation frames
    const firstFrame = scheduledFrameCallbacks.shift()!;
    firstFrame(100);
    const secondFrame = scheduledFrameCallbacks.shift()!;
    secondFrame(116);

    // Exercise touch buttons (pointerdown, pointerup, and keyboard click detail=0)
    const touchButtons = allElements.filter(
      (element) => element.tagName === 'button' && element.className === 'touch-button',
    );
    expect(touchButtons.length).toBe(3);
    for (const touchButton of touchButtons) {
      touchButton.dispatch('pointerdown', { pointerId: 1, button: 0 });
      touchButton.dispatch('pointerdown', { pointerId: 1, button: 0 }); // duplicate pointerId ignored
      touchButton.dispatch('pointerdown', { pointerId: 2, button: 1 }); // non-primary button ignored
      touchButton.dispatch('pointerup', { pointerId: 1 });
      touchButton.dispatch('pointerdown', { pointerId: 3, button: 0 });
      touchButton.dispatch('pointercancel', { pointerId: 3 });
      touchButton.dispatch('pointerdown', { pointerId: 4, button: 0 });
      touchButton.dispatch('lostpointercapture', { pointerId: 4 });
      touchButton.dispatch('pointerup', { pointerId: 99 }); // unknown pointerId ignored
      touchButton.dispatch('click', { detail: 0 });
      touchButton.dispatch('click', { detail: 1 });
    }

    // Exercise canvas pointer tracking and click launch
    canvasElement.dispatch('pointermove', { clientX: 120 });
    canvasElement.dispatch('pointerdown', { clientX: 180, button: 0 });
    canvasElement.dispatch('pointerleave');
    canvasElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    canvasElement.dispatch('pointermove', { clientX: 120 });

    // Pause via button, resume via Enter key
    pauseButton.dispatch('click');
    expect(pauseButton.textContent).toBe('Resume');
    for (const listener of windowListeners.get('keydown') ?? []) {
      listener({ code: 'Enter', preventDefault: () => {} } as unknown as Event);
    }
    expect(pauseButton.textContent).toBe('Pause');

    // Pause via window blur and resume via Resume button
    for (const listener of windowListeners.get('blur') ?? []) {
      listener({} as unknown as Event);
    }
    expect(pauseButton.textContent).toBe('Resume');
    resumeButton.dispatch('click');
    expect(pauseButton.textContent).toBe('Pause');

    // Pause via document visibilitychange
    fakeDocument.hidden = true;
    for (const listener of documentListeners.get('visibilitychange') ?? []) {
      listener({} as unknown as Event);
    }
    expect(pauseButton.textContent).toBe('Resume');
    fakeDocument.hidden = false;
    resumeButton.dispatch('click');

    // Toggle mute via button and KeyM
    muteButton.dispatch('click');
    expect(muteButton.textContent).toBe('Unmute');
    for (const listener of windowListeners.get('keydown') ?? []) {
      listener({ code: 'KeyM', preventDefault: () => {} } as unknown as Event);
    }
    expect(muteButton.textContent).toBe('Mute');

    // Restart and Launch Run clicks
    restartButton.dispatch('click');
    launchRunButton.dispatch('click');

    // Test storage helpers and gameOver overlay state transition
    const { readStoredHighScore, writeStoredHighScore, autoBoot } = await import('../src/main');
    writeStoredHighScore(9900);
    expect(readStoredHighScore()).toBe(9900);
    storageMap.clear();
    expect(readStoredHighScore()).toBe(0);

    fakeWindow.localStorage = {
      getItem: () => {
        throw new Error('Storage disabled');
      },
      setItem: () => {
        throw new Error('Storage disabled');
      },
    };
    expect(readStoredHighScore()).toBe(0);
    expect(() => writeStoredHighScore(500)).not.toThrow();

    // Boot a fresh instance and drive it to game over to cover gameOverOverlay update
    const secondRun = boot();
    secondRun.game.start(1);
    scheduledFrameCallbacks.pop()!(100);
    for (let life = 0; life < 3; life += 1) {
      const ball = secondRun.game.getBalls()[0] as {
        attachedToPaddle: boolean;
        y: number;
        velocityY: number;
      };
      ball.attachedToPaddle = false;
      ball.y = 700;
      ball.velocityY = 300;
      const frame = scheduledFrameCallbacks.pop()!;
      frame(200 + life * 16);
    }
    expect(secondRun.game.getSnapshot().state).toBe('over');
    const stageFrames = allElements.filter((element) => element.className === 'stage-frame');
    expect(stageFrames.some((element) => element.style.transform.startsWith('translate('))).toBe(
      true,
    );

    // Test autoBoot when readyState is loading
    fakeDocument.readyState = 'loading';
    autoBoot();
    for (const listener of documentListeners.get('DOMContentLoaded') ?? []) {
      listener({} as unknown as Event);
    }

    // Verify boot error paths when #app or 2D context is missing
    fakeDocument.querySelector = () => null;
    expect(() => boot()).toThrow('Missing #app element');

    const nullContextContainer = createFakeElement('div', allElements, null);
    fakeDocument.querySelector = () => nullContextContainer;
    fakeDocument.createElement = (tagName: string) => createFakeElement(tagName, allElements, null);
    expect(() => boot()).toThrow('Canvas 2D context is not available');
  });
});

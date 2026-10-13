export type TouchControl = 'left' | 'right' | 'launch';

export interface InputEventTarget {
  addEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | EventListenerOptions,
  ): void;
}

export class InputState {
  private currentTarget: InputEventTarget | Window | null = null;
  private readonly keyboardHeldKeys = new Set<string>();
  private touchLeftHeld = false;
  private touchRightHeld = false;
  private touchLaunchHeld = false;
  private launchPressedQueued = false;
  private pausePressedQueued = false;
  private currentPointerPlayfieldX: number | null = null;

  private readonly handleKeyDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const code = this.extractEventCode(keyboardEvent);
    if (code === '') {
      return;
    }

    const isRelevantGameKey =
      this.isLeftKey(code) ||
      this.isRightKey(code) ||
      this.isLaunchKey(code) ||
      this.isPauseKey(code);

    if (isRelevantGameKey && typeof keyboardEvent.preventDefault === 'function') {
      keyboardEvent.preventDefault();
    }

    if (keyboardEvent.repeat) {
      return;
    }

    const alreadyHeld = this.keyboardHeldKeys.has(code);
    this.keyboardHeldKeys.add(code);

    if (!alreadyHeld) {
      if (this.isLaunchKey(code)) {
        this.launchPressedQueued = true;
      }
      if (this.isPauseKey(code)) {
        this.pausePressedQueued = true;
      }
    }
  };

  private readonly handleKeyUp = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const code = this.extractEventCode(keyboardEvent);
    if (code !== '') {
      this.keyboardHeldKeys.delete(code);
    }
  };

  private readonly handleBlur = (): void => {
    this.keyboardHeldKeys.clear();
  };

  private extractEventCode(event: Event): string {
    if (
      'code' in event &&
      typeof (event as { code: unknown }).code === 'string' &&
      (event as { code: string }).code !== ''
    ) {
      return (event as { code: string }).code;
    }
    if ('key' in event && typeof (event as { key: unknown }).key === 'string') {
      const key = (event as { key: string }).key;
      if (key === ' ' || key === 'Spacebar') {
        return 'Space';
      }
      if (key === 'a' || key === 'A') {
        return 'KeyA';
      }
      if (key === 'd' || key === 'D') {
        return 'KeyD';
      }
      if (key === 'w' || key === 'W') {
        return 'KeyW';
      }
      if (key === 'p' || key === 'P') {
        return 'KeyP';
      }
      return key;
    }
    return '';
  }

  private isLeftKey(code: string): boolean {
    return code === 'ArrowLeft' || code === 'KeyA';
  }

  private isRightKey(code: string): boolean {
    return code === 'ArrowRight' || code === 'KeyD';
  }

  private isLaunchKey(code: string): boolean {
    return code === 'Space' || code === 'ArrowUp' || code === 'KeyW';
  }

  private isPauseKey(code: string): boolean {
    return code === 'KeyP' || code === 'Escape';
  }

  attach(target?: InputEventTarget | Window): void {
    if (this.currentTarget !== null) {
      this.detach();
    }
    const resolvedTarget = target ?? (typeof window !== 'undefined' ? window : null);
    if (resolvedTarget === null) {
      return;
    }
    this.currentTarget = resolvedTarget;
    this.currentTarget.addEventListener('keydown', this.handleKeyDown as EventListener);
    this.currentTarget.addEventListener('keyup', this.handleKeyUp as EventListener);
    this.currentTarget.addEventListener('blur', this.handleBlur as EventListener);
  }

  detach(): void {
    if (this.currentTarget !== null) {
      this.currentTarget.removeEventListener('keydown', this.handleKeyDown as EventListener);
      this.currentTarget.removeEventListener('keyup', this.handleKeyUp as EventListener);
      this.currentTarget.removeEventListener('blur', this.handleBlur as EventListener);
      this.currentTarget = null;
    }
    this.keyboardHeldKeys.clear();
  }

  get attached(): boolean {
    return this.currentTarget !== null;
  }

  get axisX(): number {
    let horizontalAxis = 0;
    const isLeftActive =
      this.touchLeftHeld ||
      this.keyboardHeldKeys.has('ArrowLeft') ||
      this.keyboardHeldKeys.has('KeyA');
    const isRightActive =
      this.touchRightHeld ||
      this.keyboardHeldKeys.has('ArrowRight') ||
      this.keyboardHeldKeys.has('KeyD');

    if (isLeftActive) {
      horizontalAxis -= 1;
    }
    if (isRightActive) {
      horizontalAxis += 1;
    }
    return horizontalAxis;
  }

  get launchHeld(): boolean {
    return (
      this.touchLaunchHeld ||
      this.keyboardHeldKeys.has('Space') ||
      this.keyboardHeldKeys.has('ArrowUp') ||
      this.keyboardHeldKeys.has('KeyW')
    );
  }

  consumeLaunchPressed(): boolean {
    const wasPressed = this.launchPressedQueued;
    this.launchPressedQueued = false;
    return wasPressed;
  }

  consumePausePressed(): boolean {
    const wasPressed = this.pausePressedQueued;
    this.pausePressedQueued = false;
    return wasPressed;
  }

  touchButtonDown(control: TouchControl): void {
    if (control === 'left') {
      this.touchLeftHeld = true;
    } else if (control === 'right') {
      this.touchRightHeld = true;
    } else if (control === 'launch') {
      if (!this.touchLaunchHeld) {
        this.launchPressedQueued = true;
      }
      this.touchLaunchHeld = true;
    }
  }

  touchButtonUp(control: TouchControl): void {
    if (control === 'left') {
      this.touchLeftHeld = false;
    } else if (control === 'right') {
      this.touchRightHeld = false;
    } else if (control === 'launch') {
      this.touchLaunchHeld = false;
    }
  }

  setPointerPlayfieldX(playfieldX: number | null): void {
    this.currentPointerPlayfieldX = playfieldX;
  }

  get pointerPlayfieldX(): number | null {
    return this.currentPointerPlayfieldX;
  }

  triggerPointerLaunch(): void {
    this.launchPressedQueued = true;
  }

  clearPressedEdges(): void {
    this.launchPressedQueued = false;
    this.pausePressedQueued = false;
  }
}

import { defaultKeys, type KeyBindings } from './storage';

export interface InputHooks {
  onPause(): void;
  onScoreboard(show: boolean): void;
  onLockChange(locked: boolean): void;
}

const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);

export class Input {
  keys = new Set<string>();
  mouseL = false;
  mouseR = false;
  tMoveX = 0;
  tMoveY = 0;
  tFire = false;
  tAds = false;
  tSprint = false;
  locked = false;
  fallback = false;
  enabled = true;
  private lookX = 0;
  private lookY = 0;
  private edges = { jump: false, reload: false, swap: false, slot: 0 };
  private disposers: (() => void)[] = [];
  keymap: KeyBindings = defaultKeys();

  constructor(private el: HTMLCanvasElement, private touch: boolean, private hooks: InputHooks, keymap?: KeyBindings) {
    if (keymap) this.keymap = { ...keymap };
    const on = <K extends keyof WindowEventMap>(t: Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', this.onKeyDown);
    on(window, 'keyup', this.onKeyUp);
    on(window, 'mouseup', this.onMouseUp);
    on(window, 'blur', this.onBlur);
    const elOn = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    elOn('mousedown', this.onMouseDown);
    elOn('contextmenu', (e) => e.preventDefault());
    elOn('wheel', this.onWheel, { passive: true });
    const docMove = (e: MouseEvent) => this.onMouseMove(e);
    const lockChange = () => {
      this.locked = document.pointerLockElement === this.el;
      if (this.locked) this.fallback = false;
      else {
        this.mouseL = false;
        this.mouseR = false;
      }
      this.hooks.onLockChange(this.locked || this.fallback);
    };
    const lockError = () => this.setFallback();
    document.addEventListener('mousemove', docMove);
    document.addEventListener('pointerlockchange', lockChange);
    document.addEventListener('pointerlockerror', lockError);
    this.disposers.push(() => {
      document.removeEventListener('mousemove', docMove);
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('pointerlockerror', lockError);
    });
  }

  private isTyping(e: Event) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    const c = e.code;
    if (c === 'Tab') {
      e.preventDefault();
      if (!e.repeat) this.hooks.onScoreboard(true);
      return;
    }
    if (c === 'Escape' || c === 'KeyP') {
      if (!e.repeat && (c === 'KeyP' || !this.locked)) this.hooks.onPause();
      return;
    }
    if (!this.enabled) return;
    if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) {
      this.keys.add(c);
      return;
    }
    this.keys.add(c);
    const k = this.keymap;
    if (c === k.jump) this.edges.jump = true;
    else if (c === k.reload) this.edges.reload = true;
    else if (c === k.swap) this.edges.swap = true;
    else if (c === k.slot1) this.edges.slot = 1;
    else if (c === k.slot2) this.edges.slot = 2;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'Tab') this.hooks.onScoreboard(false);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.touch || !this.enabled) return;
    if (!this.locked) {
      this.requestLock();
      if (!this.fallback) return;
    }
    if (e.button === 0) this.mouseL = true;
    if (e.button === 2) this.mouseR = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseL = false;
    if (e.button === 2) this.mouseR = false;
  };

  private onMouseMove(e: MouseEvent) {
    if (!this.enabled || this.touch) return;
    if (this.locked || (this.fallback && (this.mouseL || this.mouseR || e.buttons))) {
      const mx = Math.max(-300, Math.min(300, e.movementX || 0));
      const my = Math.max(-300, Math.min(300, e.movementY || 0));
      this.lookX += mx;
      this.lookY += my;
    }
  }

  private onWheel = (e: WheelEvent) => {
    if (this.enabled && Math.abs(e.deltaY) > 10) this.edges.swap = true;
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseL = false;
    this.mouseR = false;
    this.tFire = false;
    this.hooks.onScoreboard(false);
  };

  private setFallback() {
    if (this.locked) return;
    const was = this.fallback;
    this.fallback = true;
    if (!was) this.hooks.onLockChange(true);
  }

  requestLock() {
    if (this.touch || this.locked) return;
    try {
      if (typeof this.el.requestPointerLock !== 'function') {
        this.setFallback();
        return;
      }
      const r = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => this.setFallback());
    } catch {
      this.setFallback();
    }
  }

  exitLock() {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // игнор
      }
    }
  }

  setKeymap(k: KeyBindings) {
    this.keymap = { ...k };
  }

  moveX() {
    let x = 0;
    if (this.keys.has(this.keymap.right) || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has(this.keymap.left) || this.keys.has('ArrowLeft')) x -= 1;
    return clamp1(x + this.tMoveX);
  }

  moveY() {
    let y = 0;
    if (this.keys.has(this.keymap.forward) || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has(this.keymap.back) || this.keys.has('ArrowDown')) y -= 1;
    return clamp1(y + this.tMoveY);
  }

  fire() {
    return this.enabled && (this.mouseL || this.tFire);
  }

  ads() {
    return this.enabled && (this.mouseR || this.tAds);
  }

  sprint() {
    return this.keys.has(this.keymap.sprint) || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.tSprint;
  }

  addLook(dx: number, dy: number) {
    this.lookX += dx;
    this.lookY += dy;
  }

  press(name: 'jump' | 'reload' | 'swap') {
    this.edges[name] = true;
  }

  takeLook(): [number, number] {
    const r: [number, number] = [this.lookX, this.lookY];
    this.lookX = 0;
    this.lookY = 0;
    return r;
  }

  takeJump() {
    const v = this.edges.jump;
    this.edges.jump = false;
    return v;
  }

  takeReload() {
    const v = this.edges.reload;
    this.edges.reload = false;
    return v;
  }

  takeSwap() {
    const v = this.edges.swap;
    this.edges.swap = false;
    return v;
  }

  takeSlot() {
    const v = this.edges.slot;
    this.edges.slot = 0;
    return v;
  }

  clearEdges() {
    this.edges = { jump: false, reload: false, swap: false, slot: 0 };
    this.lookX = 0;
    this.lookY = 0;
  }

  dispose() {
    for (const d of this.disposers) d();
    this.disposers = [];
  }
}

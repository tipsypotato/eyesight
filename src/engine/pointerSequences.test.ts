import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EyeEngine } from './EyeEngine';
import { createEyeStore } from '../state/store';

class ElementStub extends EventTarget {
  style: Record<string, string> = {};
  classList = { add() {} };
  clientWidth = 600;
  clientHeight = 400;
  parentElement: ElementStub | null = null;
  children: ElementStub[] = [];
  captures = new Set<number>();
  get ownerDocument() { return document; }
  getRootNode() { return document; }
  append(...children: ElementStub[]) { children.forEach(child => this.appendChild(child)); }
  appendChild(child: ElementStub) { child.parentElement = this; this.children.push(child); }
  setAttribute() {}
  remove() {}
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight }; }
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
}

vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = new ElementStub();
    setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  },
}));
vi.mock('./geometry', async importOriginal => ({
  ...await importOriginal<typeof import('./geometry')>(),
  buildEye: () => ({ root: new THREE.Group(), parts: new Map(), dispose() {} }),
}));

let engine: EyeEngine;
beforeEach(() => {
  const documentStub = Object.assign(new EventTarget(), { createElement: () => new ElementStub(), createElementNS: () => new ElementStub() });
  const media = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal('document', documentStub);
  vi.stubGlobal('window', Object.assign(new EventTarget(), { devicePixelRatio: 1, matchMedia: () => media }));
  vi.stubGlobal('getComputedStyle', () => ({ position: 'relative' }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => { engine?.dispose(); vi.unstubAllGlobals(); });

function fixture() {
  const host = new ElementStub(); host.parentElement = new ElementStub();
  const select = vi.fn(), store = createEyeStore();
  engine = new EyeEngine(host as unknown as HTMLElement, select);
  engine.setState(store.getState());
  const handlers = engine as unknown as {
    handlePointerDown(event: PointerEvent): void; handlePointerMove(event: PointerEvent): void;
    handlePointerUp(event: PointerEvent): void; handlePointerCancel(event: Event): void;
    handlePointerLeave(): void;
    pickStructure: ReturnType<typeof vi.fn>; pickSectionFrame: ReturnType<typeof vi.fn>;
    sectionCallbacks: { begin(): void; change(offset: number): void; end(): void };
    sectionPointerId: number | null; rig: { controls: { enabled: boolean } };
  };
  handlers.pickStructure = vi.fn(() => 'cornea');
  handlers.pickSectionFrame = vi.fn(() => null);
  const event = (id = 1, x = 50, y = 50, type = 'pointerup') => Object.assign(new Event(type, { cancelable: true }), {
    pointerId: id, button: 0, clientX: x, clientY: y, pointerType: 'touch',
  }) as PointerEvent;
  const down = (id = 1, x = 50, y = 50) => handlers.handlePointerDown(event(id, x, y, 'pointerdown'));
  const move = (id = 1, x = 50, y = 50) => handlers.handlePointerMove(event(id, x, y, 'pointermove'));
  const up = (id = 1, x = 50, y = 50) => handlers.handlePointerUp(event(id, x, y));
  return { handlers, select, store, event, down, move, up };
}

it('selects only a tracked primary tap and ignores a gesture that started on a panel', () => {
  const { select, down, up } = fixture();
  up(2); expect(select).not.toHaveBeenCalled();
  down(1); up(2); expect(select).not.toHaveBeenCalled();
  up(1); expect(select).toHaveBeenCalledTimes(1);
});

it('suppresses an out-and-back drag, including coalesced movement', () => {
  const { handlers, select, event, down, move, up } = fixture();
  down(); move(1, 100); move(); up();
  expect(select).not.toHaveBeenCalled();
  down();
  handlers.handlePointerMove(Object.assign(event(1), { getCoalescedEvents: () => [event(1, 100), event(1)] }));
  up(); expect(select).not.toHaveBeenCalled();
  down(); up(); expect(select).toHaveBeenCalledTimes(1);
});

it('uses a 12 pixel touch tolerance while retaining 6 pixels for a mouse', () => {
  const { handlers, select, event, down, move, up } = fixture();
  down(); move(1, 60); up(1, 60); expect(select).toHaveBeenCalledTimes(1);
  handlers.handlePointerDown(Object.assign(event(2), { pointerType: 'mouse' }));
  handlers.handlePointerMove(Object.assign(event(2, 60), { pointerType: 'mouse' }));
  handlers.handlePointerUp(Object.assign(event(2, 60), { pointerType: 'mouse' }));
  expect(select).toHaveBeenCalledTimes(1);
});

it('invalidates a contact that leaves the canvas even if it returns without a move event', () => {
  const { handlers, select, down, up } = fixture();
  down(); handlers.handlePointerLeave(); up(); expect(select).not.toHaveBeenCalled();
  down(); up(); expect(select).toHaveBeenCalledTimes(1);
});

it.each([[1, 2], [2, 1]])('suppresses a pinch until all contacts lift in order %s then %s', (first, last) => {
  const { select, down, move, up } = fixture();
  down(1); down(2); move(2, 90); up(first); down(3); up(last); up(3);
  expect(select).not.toHaveBeenCalled();
  down(4); up(4); expect(select).toHaveBeenCalledTimes(1);
});

it('invalidates cancelled contacts and permits the next complete gesture', () => {
  const { handlers, select, event, down, up } = fixture();
  down(1); down(2);
  handlers.handlePointerCancel(event(1, 50, 50, 'pointercancel'));
  up(2); up(1); expect(select).not.toHaveBeenCalled();
  down(3); up(3); expect(select).toHaveBeenCalledTimes(1);
});

it('invalidates lost capture, tracks release outside the canvas, then accepts a new tap', () => {
  const { handlers, select, event, down, up } = fixture();
  down(1); handlers.handlePointerCancel(event(1, 50, 50, 'lostpointercapture'));
  down(2); up(2); expect(select).not.toHaveBeenCalled();
  window.dispatchEvent(event(1));
  down(3); up(3); expect(select).toHaveBeenCalledTimes(1);
});

it('invalidates stale releases after blur or a mode change', () => {
  const { handlers, select, store, down, up } = fixture();
  down(1); handlers.handlePointerCancel(new Event('blur')); up(1);
  down(2); store.getState().setMode('optics'); engine.setState(store.getState()); up(2);
  expect(select).not.toHaveBeenCalled();
  down(3); up(3); expect(select).toHaveBeenCalledTimes(1);
});

it('keeps secondary contacts from ending a frame drag or selecting after its release', () => {
  const { handlers, select, down, up } = fixture();
  const end = vi.fn();
  handlers.sectionCallbacks = { begin() {}, change() {}, end };
  handlers.pickSectionFrame.mockReturnValue({ point: new THREE.Vector3(0, 1.24, 0) });
  down(1); expect(handlers.rig.controls.enabled).toBe(false);
  down(2); up(2);
  expect(end).not.toHaveBeenCalled();
  expect(handlers.sectionPointerId).toBe(1);
  down(3); up(1); expect(end).toHaveBeenCalledTimes(1);
  expect(handlers.rig.controls.enabled).toBe(true);
  up(3); expect(select).not.toHaveBeenCalled();
  handlers.pickSectionFrame.mockReturnValue(null);
  down(4); up(4); expect(select).toHaveBeenCalledTimes(1);
});

it('consumes frame cancellation without passing untracked contacts to OrbitControls', () => {
  const { handlers, select, event, down, up } = fixture();
  const end = vi.fn();
  handlers.sectionCallbacks = { begin() {}, change() {}, end };
  handlers.pickSectionFrame.mockReturnValue({ point: new THREE.Vector3(0, 1.24, 0) });
  down(1); down(2);
  const secondary = event(2, 50, 50, 'pointercancel');
  handlers.handlePointerCancel(secondary);
  expect(secondary.defaultPrevented).toBe(true);
  expect(end).not.toHaveBeenCalled();
  const primary = event(1, 50, 50, 'pointercancel');
  handlers.handlePointerCancel(primary);
  expect(primary.defaultPrevented).toBe(true);
  expect(end).toHaveBeenCalledTimes(1);
  expect(handlers.rig.controls.enabled).toBe(true);
  handlers.pickSectionFrame.mockReturnValue(null);
  down(3); up(3); expect(select).toHaveBeenCalledTimes(1);
});

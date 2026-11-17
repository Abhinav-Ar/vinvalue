import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it, expect, vi } from 'vitest';
const script = (name: string) => readFileSync(`extension/controllers/${name}Controller.js`, 'utf8');
it('syncs authenticated DTOs, ignores event answers, and clears caches after revocation', async () => {
  const listeners: Record<string, () => void> = {};
  const storage: Record<string, any> = { conditions: { private: 'stale' } };
  const chrome = { runtime: { id: 'ext', onMessage: { addListener: vi.fn() } }, storage: { local: {
    set: async (v: object) => Object.assign(storage, v), remove: async (keys: string[]) => { for (const k of keys) delete storage[k]; },
  } } };
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, accountId: 'a', cars: [] }) });
  const context = { chrome, fetch, window: { addEventListener: (n: string, fn: () => void) => { listeners[n] = fn; } }, document: { visibilityState: 'visible' }, setTimeout: vi.fn(), setInterval: vi.fn(), Date };
  runInNewContext(script('garageSync'), context);
  await vi.waitFor(() => expect(storage.snapshot?.accountId).toBe('a'));
  expect(storage.conditions).toBeUndefined();
  expect(fetch).toHaveBeenCalledWith('/api/extension/garage', expect.objectContaining({ credentials: 'include', cache: 'no-store' }));
  fetch.mockResolvedValue({ ok: false }); listeners.focus!();
  await vi.waitFor(() => expect(storage.snapshot).toBeUndefined());
});
it('native setter informs React and condition answers stay in the matching question group', () => {
  const listeners = vi.fn();
  const groups = [{ querySelector: () => ({ textContent: 'Warning lights?' }), getAttribute: () => null }];
  const context: any = { chrome: { runtime: { onMessage: { addListener: listeners } } }, document: { querySelectorAll: () => groups, getElementById: () => null } };
  runInNewContext(script('formFill'), context);
  runInNewContext(`globalThis.hits = []; clickByText = (text, container) => { hits.push([text, container]); return true; }; applyConditionAnswers({ warningLights: 'Check Engine', bodyDamage: 'None' });`, context);
  expect(context.hits).toEqual([['check engine', groups[0]]]);
  expect(listeners).toHaveBeenCalledOnce();
  expect(script('formFill')).not.toContain('console.log');
  expect(script('formFill')).not.toContain('window.addEventListener("autoiq:fill"');
});
it('manifest keeps only storage permission and known HTTPS hosts', () => {
  const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
  expect(manifest.permissions).toEqual(['storage']);
  expect(manifest.host_permissions).toHaveLength(7);
  expect(manifest.host_permissions.every((h: string) => h.startsWith('https://') && !h.includes('localhost'))).toBe(true);
});

it('uses the native input setter and dispatches input/change/blur for React controls', () => {
  class Input {
    tagName = 'INPUT'; type = 'text'; stored = ''; calls = 0; events: string[] = [];
    get value() { return this.stored; }
    set value(v: string) { this.stored = v; this.calls++; }
    dispatchEvent(e: { type: string }) { this.events.push(e.type); }
  }
  const context: any = { HTMLInputElement: Input, Event: class { constructor(public type: string) {} }, chrome: { runtime: { onMessage: { addListener() {} } } } };
  runInNewContext(script('formFill'), context);
  context.input = new Input();
  runInNewContext('setInputValue(input, "38200")', context);
  expect(context.input.value).toBe('38200');
  expect(context.input.calls).toBeGreaterThan(0);
  expect(context.input.events).toEqual(['input', 'change', 'blur']);
});
it('popup selects a lone car, copies a detail, and refuses unsupported tabs', async () => {
  class Element {
    style: Record<string,string> = {}; disabled = true; textContent = ''; className = ''; innerHTML = '';
    children: Element[] = []; handlers: Record<string, () => any> = {};
    classList = { add: vi.fn(), remove: vi.fn() };
    append(...children: Element[]) { this.children.push(...children); }
    appendChild(child: Element) { this.children.push(child); }
    addEventListener(name: string, fn: () => any) { this.handlers[name] = fn; }
    click() { return this.handlers.click?.(); }
    querySelector(selector: string): Element | null {
      return this.children.find(c => selector === '.car-item' ? c.className === 'car-item' : c.className === 'copy-hint') ?? null;
    }
  }
  const elements = new Map<string, Element>();
  const get = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  const sendMessage = vi.fn();
  const clipboard = vi.fn().mockResolvedValue(undefined);
  const car = { id: 'v', vin: '1FA6P8CF9K5123456', year: 2019, make: 'Ford', model: 'Mustang', mileage: 0, answers: {} };
  runInNewContext(script('popup'), {
    Intl, Date, setTimeout: vi.fn(), navigator: { clipboard: { writeText: clipboard } },
    document: { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [] },
    chrome: { tabs: { query: async (q: { active?: boolean }) => q.active ? [{ id: 7, url: 'https://example.com/' }] : [], sendMessage },
      storage: { local: { get: async () => ({ snapshot: { version: 1, accountId: 'a', cars: [car], syncedAt: Date.now() } }), remove: vi.fn() } } },
  });
  await vi.waitFor(() => expect(get('btn-fill').disabled).toBe(false));
  get('detail-grid').children[0]!.click();
  expect(clipboard).toHaveBeenCalledWith(car.vin);
  await get('btn-fill').click();
  expect(get('status').textContent).toContain("isn't supported");
  expect(sendMessage).not.toHaveBeenCalled();
});

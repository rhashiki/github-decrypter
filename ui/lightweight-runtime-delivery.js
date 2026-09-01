(() => {
  'use strict';
  if (window.__LD43_LIGHTWEIGHT_RUNTIME_DELIVERY__) return;
  window.__LD43_LIGHTWEIGHT_RUNTIME_DELIVERY__ = true;

  const tasks = new Map();
  let wakeTimer = 0;
  let wakeAt = 0;
  let running = false;

  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  function arm(delay = 0) {
    if (!tasks.size) return;
    const wait = clamp(delay, 0, 60_000, 0);
    const target = Date.now() + wait;
    if (wakeTimer && wakeAt <= target + 4) return;
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeAt = target;
    wakeTimer = setTimeout(runDue, wait);
  }

  function nextDelay() {
    if (!tasks.size) return 0;
    const now = Date.now();
    let next = Infinity;
    for (const task of tasks.values()) {
      if (task.inFlight) continue;
      next = Math.min(next, task.nextAt);
    }
    return Number.isFinite(next) ? Math.max(0, next - now) : 16;
  }

  function finish(task, status) {
    tasks.delete(task.id);
    window.dispatchEvent(new CustomEvent('ld43:delivery-task-finished', {
      detail:{ id:task.id, status, attempts:task.attempts }
    }));
  }

  async function runDue() {
    wakeTimer = 0;
    wakeAt = 0;
    if (running || !tasks.size) return;
    running = true;
    const now = Date.now();
    const due = [...tasks.values()].filter(task => !task.inFlight && task.nextAt <= now);

    for (const task of due) {
      if (!tasks.has(task.id)) continue;
      task.inFlight = true;
      task.attempts += 1;
      let complete = false;
      try {
        complete = (await task.run()) === true;
        task.lastError = '';
      } catch (error) {
        task.lastError = error?.message || String(error);
      } finally {
        task.inFlight = false;
      }

      if (complete) finish(task, 'complete');
      else if (task.attempts >= task.maxAttempts) finish(task, 'exhausted');
      else task.nextAt = Date.now() + task.interval;
    }

    running = false;
    if (tasks.size) arm(nextDelay());
  }

  function register(id, run, options = {}) {
    const key = String(id || '').trim();
    if (!key) throw new Error('Delivery task id is required.');
    if (typeof run !== 'function') throw new Error(`Delivery task ${key} requires a function.`);

    const interval = clamp(options.interval, 50, 5_000, 100);
    const maxAttempts = Math.round(clamp(options.maxAttempts, 1, 240, 120));
    const startDelay = clamp(options.startDelay, 0, 5_000, 0);
    const existing = tasks.get(key);
    if (existing) return () => cancel(key);

    tasks.set(key, {
      id:key,
      run,
      interval,
      maxAttempts,
      attempts:0,
      nextAt:Date.now() + startDelay,
      inFlight:false,
      lastError:''
    });
    arm(startDelay);
    return () => cancel(key);
  }

  function cancel(id) {
    const removed = tasks.delete(String(id || ''));
    if (!tasks.size && wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = 0;
      wakeAt = 0;
    }
    return removed;
  }

  function poke(id) {
    const task = tasks.get(String(id || ''));
    if (!task || task.inFlight) return false;
    task.nextAt = Date.now();
    arm(0);
    return true;
  }

  function pulse() {
    const now = Date.now();
    for (const task of tasks.values()) if (!task.inFlight) task.nextAt = now;
    arm(0);
  }

  function inspect() {
    return [...tasks.values()].map(task => ({
      id:task.id,
      attempts:task.attempts,
      maxAttempts:task.maxAttempts,
      interval:task.interval,
      inFlight:task.inFlight,
      lastError:task.lastError
    }));
  }

  for (const eventName of ['ld3:design-system-ready','ld2:dom-reconcile','ld2:control-center-ready','ld41:branding-changed']) {
    window.addEventListener(eventName, pulse);
  }

  window.LovableDecrypterDeliveryScheduler = Object.freeze({
    build:43,
    register,
    cancel,
    poke,
    pulse,
    inspect
  });
})();

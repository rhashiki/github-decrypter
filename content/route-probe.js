(() => {
  'use strict';
  if (window.__LD2_ROUTE_PROBE__) return;
  window.__LD2_ROUTE_PROBE__ = true;

  const EVENT = 'ld2:navigation';
  let lastHref = location.href;
  let scheduled = false;

  function emit() {
    scheduled = false;
    const href = location.href;
    if (href === lastHref) return;
    lastHref = href;
    document.dispatchEvent(new Event(EVENT));
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(emit);
  }
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    if (typeof original !== 'function') continue;
    history[name] = function (...args) {
      const result = Reflect.apply(original, this, args);
      schedule();
      return result;
    };
  }
  addEventListener('popstate', schedule, true);
  addEventListener('hashchange', schedule, true);
})();
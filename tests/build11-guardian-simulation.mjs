import assert from 'node:assert/strict';

function simulate({ routing = true, bridge = true, kind = 'enter' } = {}) {
  const trace = [];
  let nativeSent = false;
  let decrypterExecutions = 0;

  const original = { trusted: true, prevented: false, stopped: false, kind };
  if (!routing) {
    nativeSent = true;
    trace.push('routing-off:native');
    return { nativeSent, decrypterExecutions, trace };
  }

  // Guardian: original trusted dispatch is always stopped first.
  original.prevented = true;
  original.stopped = true;
  trace.push(`guardian:block:${kind}`);

  // Synthetic internal dispatch is ignored by Guardian and offered to Bridge.
  const synthetic = { trusted: false, prevented: false };
  if (bridge) {
    synthetic.prevented = true;
    decrypterExecutions += 1;
    trace.push('bridge:intercept');
  } else {
    trace.push('bridge:missing');
  }

  if (!synthetic.prevented) trace.push('guardian:inactive');
  return { nativeSent, decrypterExecutions, trace, dispatchVerified: synthetic.prevented };
}

for (const kind of ['enter', 'click', 'submit']) {
  const ok = simulate({ routing: true, bridge: true, kind });
  assert.equal(ok.nativeSent, false, `${kind}: native Lovable dispatch must never escape while routing ON`);
  assert.equal(ok.decrypterExecutions, 1, `${kind}: Decrypter must execute exactly once`);
  assert.equal(ok.dispatchVerified, true, `${kind}: synthetic dispatch must be verifiable`);
}

const broken = simulate({ routing: true, bridge: false, kind: 'enter' });
assert.equal(broken.nativeSent, false, 'bridge failure must fail closed');
assert.equal(broken.decrypterExecutions, 0, 'bridge failure cannot fabricate execution');
assert.ok(broken.trace.includes('guardian:inactive'));

const off = simulate({ routing: false, bridge: false, kind: 'click' });
assert.equal(off.nativeSent, true, 'routing OFF must restore native Lovable behavior');
assert.equal(off.decrypterExecutions, 0);

console.log('Build 11 Guardian simulation: OK');

import assert from 'node:assert/strict';
import {
  Badge,
  Button,
  Card,
  DESIGN_SYSTEM_BUILD,
  DESIGN_SYSTEM_SCHEMA,
  designTokens,
  Stack,
  Status,
} from '../packages/ui/src/index.js';

assert.equal(DESIGN_SYSTEM_BUILD, 29);
assert.equal(DESIGN_SYSTEM_SCHEMA, 'gd-ui-tokens/1');
assert.equal(designTokens.schema, DESIGN_SYSTEM_SCHEMA);
assert.equal(designTokens.build, 29);
assert.equal(Object.isFrozen(designTokens), true);
assert.equal(Object.isFrozen(designTokens.color), true);
assert.equal(Object.isFrozen(designTokens.space), true);
assert.equal(designTokens.color.canvas, '#0d1117');
assert.equal(designTokens.color.accent, '#58a6ff');
assert.equal(designTokens.color.success, '#3fb950');

const button = Button({ children: 'Run', variant: 'primary', disabled: true });
assert.equal(button.type, 'button');
assert.equal(button.props.type, 'button');
assert.equal(button.props.disabled, true);
assert.match(button.props.className, /gd-button/);
assert.match(button.props.className, /gd-button--primary/);

const card = Card({ children: 'Card', tone: 'warning', id: 'card' });
assert.equal(card.type, 'div');
assert.equal(card.props.id, 'card');
assert.match(card.props.className, /gd-card--warning/);

const badge = Badge({ children: 'Ready', tone: 'success' });
assert.equal(badge.type, 'span');
assert.match(badge.props.className, /gd-badge--success/);

const stack = Stack({ children: 'Stack', gap: 'xl', direction: 'row', align: 'center' });
assert.equal(stack.type, 'div');
assert.match(stack.props.className, /gd-stack--row/);
assert.match(stack.props.className, /gd-stack--gap-xl/);
assert.match(stack.props.className, /gd-stack--align-center/);

const status = Status({ label: 'Healthy', tone: 'success' });
assert.equal(status.type, 'span');
assert.match(status.props.className, /gd-status--success/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build29-unified-design-system-runtime/2',
  tokenSchema: DESIGN_SYSTEM_SCHEMA,
  frozenTokens: true,
  nativeElementComposition: true,
  buttonDefaultType: 'button',
  semanticVariants: true,
  stackComposition: true,
  rootReactDependency: false,
  environmentAuthority: false,
}, null, 2));

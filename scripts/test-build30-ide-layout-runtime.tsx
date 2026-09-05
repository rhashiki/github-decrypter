import assert from 'node:assert/strict';
import {
  IDE_LAYOUT_BUILD,
  IDE_LAYOUT_SCHEMA,
  Workbench,
  WorkbenchActivityBar,
  WorkbenchEditor,
  WorkbenchPanel,
  WorkbenchSidebar,
  WorkbenchStatusBar,
  WorkbenchTabBar,
  WorkbenchTopBar,
} from '../packages/ui/src/index.js';

assert.equal(IDE_LAYOUT_BUILD, 30);
assert.equal(IDE_LAYOUT_SCHEMA, 'gd-ide-layout/1');

const workbench = Workbench({
  children: 'shell',
  sidebarCollapsed: true,
  panelCollapsed: false,
  id: 'workbench',
});
assert.equal(workbench.type, 'div');
assert.equal(workbench.props.id, 'workbench');
assert.equal(workbench.props['data-gd-layout'], IDE_LAYOUT_SCHEMA);
assert.equal(workbench.props['data-sidebar-collapsed'], 'true');
assert.equal(workbench.props['data-panel-collapsed'], 'false');
assert.match(workbench.props.className, /gd-workbench/);

const topbar = WorkbenchTopBar({ children: 'top' });
assert.equal(topbar.type, 'header');
assert.match(topbar.props.className, /gd-workbench__topbar/);

const activity = WorkbenchActivityBar({ children: 'activity', 'aria-label': 'Navigation' });
assert.equal(activity.type, 'nav');
assert.equal(activity.props['aria-label'], 'Navigation');
assert.match(activity.props.className, /gd-workbench__activity/);

const sidebar = WorkbenchSidebar({ children: 'sidebar', 'aria-label': 'Workspace' });
assert.equal(sidebar.type, 'aside');
assert.equal(sidebar.props['aria-label'], 'Workspace');
assert.match(sidebar.props.className, /gd-workbench__sidebar/);

const editor = WorkbenchEditor({ children: 'editor', 'aria-label': 'Editor' });
assert.equal(editor.type, 'main');
assert.equal(editor.props['aria-label'], 'Editor');
assert.match(editor.props.className, /gd-workbench__editor/);

const panel = WorkbenchPanel({ children: 'panel', 'aria-label': 'Panel' });
assert.equal(panel.type, 'section');
assert.equal(panel.props['aria-label'], 'Panel');
assert.match(panel.props.className, /gd-workbench__panel/);

const status = WorkbenchStatusBar({ children: 'status' });
assert.equal(status.type, 'footer');
assert.match(status.props.className, /gd-workbench__status/);

const tabs = WorkbenchTabBar({ children: 'tab', label: 'Editor tabs' });
assert.equal(tabs.type, 'div');
assert.equal(tabs.props.role, 'tablist');
assert.equal(tabs.props['aria-label'], 'Editor tabs');
assert.match(tabs.props.className, /gd-workbench__tabs/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build30-ide-layout-runtime/1',
  layoutSchema: IDE_LAYOUT_SCHEMA,
  semanticRegions: true,
  collapseStateAttributes: true,
  accessibleLabels: true,
  environmentAuthority: false,
}, null, 2));

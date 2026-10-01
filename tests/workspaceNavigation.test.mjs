import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSections, sectionForPage, sidebarItems } from '../src/components/Layout/workspaceNavigation.js';

const items = [
  { key: 'today', group: 'Home' },
  ...['inbox', 'customers', 'deals', 'work'].map(key => ({ key, group: 'Operate' })),
  ...['manage', 'leads', 'database', 'docview', 'workflows', 'reports', 'settings'].map(key => ({ key, group: 'Manage' })),
];

test('top sections have the requested order and never include Home', () => {
  assert.deepEqual(availableSections(items), ['Operate', 'Manage']);
});

test('each sidebar contains the fixed Home dashboard and only its selected section', () => {
  assert.deepEqual(sidebarItems(items, 'Operate').map(item => item.key), ['today', 'inbox', 'customers', 'deals', 'work']);
  for (const section of availableSections(items)) {
    const visible = sidebarItems(items, section);
    assert.equal(visible[0].key, 'today');
    assert.ok(visible.every(item => item.group === 'Home' || item.group === section));
  }
});

test('search and record navigation select the matching section; Home preserves it', () => {
  assert.equal(sectionForPage(items, 'database', 'Operate'), 'Manage');
  assert.equal(sectionForPage(items, 'customers', 'Manage'), 'Operate');
  assert.equal(sectionForPage(items, 'settings', 'Operate'), 'Manage');
  assert.equal(sectionForPage(items, 'today', 'Manage'), 'Manage');
});

test('sections and sidebar respect the already permission-filtered navigation', () => {
  const viewerItems = items.filter(item => !['workflows', 'manage'].includes(item.key));
  assert.deepEqual(availableSections(viewerItems), ['Operate', 'Manage']);
  assert.equal(sectionForPage(viewerItems, 'today', 'Manage'), 'Manage');
  assert.deepEqual(sidebarItems(viewerItems, 'Operate').map(item => item.key), ['today', 'inbox', 'customers', 'deals', 'work']);
  const docViewerItems = items.filter(item => ['docview'].includes(item.key));
  assert.deepEqual(availableSections(docViewerItems), ['Manage']);
  assert.equal(sectionForPage(docViewerItems, 'docview'), 'Manage');
  assert.deepEqual(sidebarItems(docViewerItems, 'Manage').map(item => item.key), ['docview']);
});

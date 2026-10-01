import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSections, sectionForPage, sidebarItems } from '../src/components/Layout/workspaceNavigation.js';

const items = [
  { key: 'crm_dashboard', group: 'Home' },
  ...['leads', 'accounts', 'contacts', 'opportunities', 'activities', 'inbox'].map(key => ({ key, group: 'CRM' })),
  { key: 'dashboard', group: 'Sales' },
  { key: 'database', group: 'Sales' },
  { key: 'docview', group: 'Sales' },
  { key: 'workflows', group: 'Automation' },
  { key: 'reports', group: 'Reports' },
  { key: 'settings', group: 'Admin' },
];

test('top sections have the requested order and never include Home', () => {
  assert.deepEqual(availableSections(items), ['CRM', 'Sales', 'Automation', 'Reports', 'Admin']);
});

test('each sidebar contains the fixed Home dashboard and only its selected section', () => {
  assert.deepEqual(sidebarItems(items, 'CRM').map(item => item.key), ['crm_dashboard', 'leads', 'accounts', 'contacts', 'opportunities', 'activities', 'inbox']);
  for (const section of availableSections(items)) {
    const visible = sidebarItems(items, section);
    assert.equal(visible[0].key, 'crm_dashboard');
    assert.ok(visible.every(item => item.group === 'Home' || item.group === section));
  }
});

test('search and record navigation select the matching section; Home preserves it', () => {
  assert.equal(sectionForPage(items, 'database', 'CRM'), 'Sales');
  assert.equal(sectionForPage(items, 'contacts', 'Sales'), 'CRM');
  assert.equal(sectionForPage(items, 'settings', 'CRM'), 'Admin');
  assert.equal(sectionForPage(items, 'crm_dashboard', 'Automation'), 'Automation');
});

test('sections and sidebar respect the already permission-filtered navigation', () => {
  const viewerItems = items.filter(item => !['workflows', 'dashboard'].includes(item.key));
  assert.deepEqual(availableSections(viewerItems), ['CRM', 'Sales', 'Reports', 'Admin']);
  assert.equal(sectionForPage(viewerItems, 'crm_dashboard', 'Automation'), 'CRM');
  assert.deepEqual(sidebarItems(viewerItems, 'Sales').map(item => item.key), ['crm_dashboard', 'database', 'docview']);
  const docViewerItems = items.filter(item => ['docview', 'settings'].includes(item.key));
  assert.deepEqual(availableSections(docViewerItems), ['Sales', 'Admin']);
  assert.equal(sectionForPage(docViewerItems, 'docview'), 'Sales');
  assert.deepEqual(sidebarItems(docViewerItems, 'Sales').map(item => item.key), ['docview']);
});

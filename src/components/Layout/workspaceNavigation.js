export const WORKSPACE_SECTIONS = ['CRM', 'Sales', 'Automation', 'Reports', 'Admin'];

export function availableSections(items) {
  return WORKSPACE_SECTIONS.filter(section => items.some(item => item.group === section));
}

export function sectionForPage(items, active, previous = 'CRM') {
  const sections = availableSections(items);
  const group = items.find(item => item.key === active)?.group;
  return sections.includes(group) ? group : sections.includes(previous) ? previous : sections[0];
}

export function sidebarItems(items, section) {
  return items.filter(item => item.group === 'Home' || item.group === section);
}

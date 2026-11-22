import test from 'node:test';
import assert from 'node:assert/strict';
import {navGroups, activeNavItem} from '../src/components/admin/shell';

test('every navigation entry is unique and every section has its own icon', () => {
  const items = navGroups.flatMap((g) => g.items);
  assert.equal(new Set(items.map((i) => i.href)).size, items.length);
  assert.equal(new Set(items.map((i) => i.Icon)).size, items.length);
});

test('active item resolves exact and nested paths, and hides admin-only pages from other roles', () => {
  assert.equal(activeNavItem('/admin', 'operator')?.label, 'Overview');
  assert.equal(activeNavItem('/admin/loans', 'operator')?.label, 'Loans');
  assert.equal(activeNavItem('/admin/loans/abc', 'operator')?.label, 'Loans');
  assert.equal(activeNavItem('/admin/content', 'admin')?.label, 'Website content');
  assert.equal(activeNavItem('/admin/content', 'operator'), undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getBuiltInTemplates } from './template-library.js';

test('getBuiltInTemplates returns the 4 named §22.1 examples with the expected slot counts', () => {
  const templates = getBuiltInTemplates();
  const byName = Object.fromEntries(templates.map((t) => [t.name, t]));

  assert.equal(templates.length, 4);
  assert.equal(byName['A4_上2下1'].slots.length, 3); // top-2 + bottom-1
  assert.equal(byName['A4_照片4格'].slots.length, 4);
  assert.equal(byName['A3_6格'].slots.length, 6);
  assert.equal(byName['證件照8格'].slots.length, 8);
});

test('getBuiltInTemplates: every Template is a real Template (schema-valid, no Source reference)', () => {
  for (const template of getBuiltInTemplates()) {
    assert.match(template.id, /^tmpl-/);
    assert.ok(template.paper);
    for (const slot of template.slots) {
      assert.equal(slot.sourceId, null);
      assert.ok(slot.w > 0 && slot.h > 0);
    }
  }
});

test('getBuiltInTemplates: A4 templates use A4 paper, A3_6格 uses A3', () => {
  const templates = getBuiltInTemplates();
  const byName = Object.fromEntries(templates.map((t) => [t.name, t]));
  assert.equal(byName['A4_上2下1'].paper.size, 'A4');
  assert.equal(byName['A4_照片4格'].paper.size, 'A4');
  assert.equal(byName['證件照8格'].paper.size, 'A4');
  assert.equal(byName['A3_6格'].paper.size, 'A3');
});

test('getBuiltInTemplates returns a FRESH set (with fresh ids) on every call — callers can safely mutate their own copy', () => {
  const first = getBuiltInTemplates();
  const second = getBuiltInTemplates();
  assert.notEqual(first[0].id, second[0].id);
  assert.deepEqual(first[0].slots.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h })), second[0].slots.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h })));
});

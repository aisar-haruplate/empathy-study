import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMacroCategory, KNOWN_BRANDS, MACRO_CATEGORIES } from './taxonomyCategories.ts';

test('exposes only the three research macro categories', () => {
  assert.deepEqual(MACRO_CATEGORIES.map((category) => category.id), [
    'probiotics',
    'fruits_vegetables',
    'grains_staples',
  ]);
});

test('groups yogurt brands and supplements into the probiotics focus', () => {
  assert.equal(classifyMacroCategory('Yakult').macroId, 'probiotics');
  assert.equal(classifyMacroCategory('Greek yogurt').macroId, 'probiotics');
  assert.equal(classifyMacroCategory('fish oil supplement').macroId, 'probiotics');
  assert.ok(KNOWN_BRANDS.filter((brand) => brand.categoryName === 'yogurt').every((brand) => brand.categoryId === 'probiotics'));
});

test('groups produce and grains without deep breakdown', () => {
  assert.equal(classifyMacroCategory('carrot and apple').specificItem, 'fruits & vegetables');
  assert.equal(classifyMacroCategory('rice and oats').specificItem, 'grains & carbohydrates');
});

test('does not classify unrelated products as probiotics', () => {
  assert.equal(classifyMacroCategory('toothpaste').macroId, '');
});

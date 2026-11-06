import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, normalizeDigits } from '../utils/normalize-arabic.js';

test('normalizeArabic strips Arabic diacritics', () => {
  assert.equal(normalizeArabic('مُحَمَّد'), 'محمد');
});

test('normalizeArabic unifies alef variants', () => {
  assert.equal(normalizeArabic('أحمد إسلام آمن'), 'احمد اسلام امن');
});

test('normalizeArabic maps taa marbuta and alef maqsura', () => {
  assert.equal(normalizeArabic('فاتنة'), 'فاتنه');
  assert.equal(normalizeArabic('مصطفى'), 'مصطفي');
});

test('normalizeArabic lowercases and trims', () => {
  assert.equal(normalizeArabic('  ARN Stream  '), 'arn stream');
});

test('normalizeArabic handles invalid input safely', () => {
  assert.equal(normalizeArabic(null), '');
  assert.equal(normalizeArabic(undefined), '');
  assert.equal(normalizeArabic(42), '');
  assert.equal(normalizeArabic(''), '');
});

test('normalizeArabic is idempotent', () => {
  const once = normalizeArabic('الأصدقاءُ الأوفياء');
  assert.equal(normalizeArabic(once), once);
});

test('normalizeDigits converts Arabic-Indic and Persian digits', () => {
  assert.equal(normalizeDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  assert.equal(normalizeDigits('۱۲۳'), '123');
  assert.equal(normalizeDigits('abc'), 'abc');
});

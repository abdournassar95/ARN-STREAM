import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordStrength, PASSWORD_MIN_LENGTH } from '../utils/password-policy.js';

test('rejects short passwords', () => {
  assert.equal(validatePasswordStrength('1234567').ok, false);
});

test('rejects empty / non-string passwords', () => {
  assert.equal(validatePasswordStrength('').ok, false);
  assert.equal(validatePasswordStrength(null).ok, false);
  assert.equal(validatePasswordStrength(undefined).ok, false);
});

test('rejects well-known common passwords', () => {
  assert.equal(validatePasswordStrength('password').ok, false);
  assert.equal(validatePasswordStrength('Admin123'.toLowerCase()).ok, false);
});

test('accepts a reasonable passphrase', () => {
  assert.equal(validatePasswordStrength('Sunset-Cedar-42').ok, true);
});

test('honours a custom minimum length', () => {
  assert.equal(validatePasswordStrength('abcdef', { minLength: 6 }).ok, true);
  assert.equal(validatePasswordStrength('abcdef', { minLength: 12 }).ok, false);
});

test('exposes the default minimum length', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
});

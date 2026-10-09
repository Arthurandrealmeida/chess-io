import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, readPreferences, savePreferences } from '../src/preferences.js';

test('blocked localStorage does not prevent startup or saving preferences', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage blocked', 'SecurityError');
    },
  });
  try {
    assert.deepEqual(readPreferences(), DEFAULTS);
    assert.equal(savePreferences(DEFAULTS), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('unavailable or corrupt storage falls back to defaults', () => {
  assert.deepEqual(readPreferences(null), DEFAULTS);
  assert.deepEqual(readPreferences({ getItem: () => '{broken' }), DEFAULTS);
  assert.equal(savePreferences(DEFAULTS, null), false);
});

test('valid preferences still round-trip and invalid fields use defaults', () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
  const preferences = {
    ...DEFAULTS,
    theme: 'dark',
    board: 'wood',
    side: 'b',
    level: 12,
    clock: 'blitz3',
  };
  assert.equal(savePreferences(preferences, storage), true);
  assert.deepEqual(readPreferences(storage), preferences);
  storage.setItem(
    'chess-studio.preferences',
    JSON.stringify({ theme: 'invalid', level: 100, side: 'x' }),
  );
  assert.deepEqual(readPreferences(storage), DEFAULTS);
});

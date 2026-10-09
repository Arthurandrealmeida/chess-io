import { TIME_CONTROLS } from './game.js';
export const DEFAULTS = {
  theme: 'light',
  animations: true,
  board: 'green',
  level: 5,
  clock: 'rapid',
  side: 'w',
  playerName: '',
};
export function readPreferences(storage) {
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    const saved = JSON.parse(storage.getItem('chess-studio.preferences') || '{}');
    return {
      ...DEFAULTS,
      theme: ['light', 'dark'].includes(saved.theme) ? saved.theme : DEFAULTS.theme,
      animations: typeof saved.animations === 'boolean' ? saved.animations : true,
      board: ['green', 'wood', 'blue'].includes(saved.board) ? saved.board : 'green',
      level:
        Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= 20 ? saved.level : 5,
      clock: Object.hasOwn(TIME_CONTROLS, saved.clock) ? saved.clock : 'rapid',
      side: ['w', 'b', 'random'].includes(saved.side) ? saved.side : 'w',
      playerName: typeof saved.playerName === 'string' ? saved.playerName.slice(0, 40) : '',
    };
  } catch {
    return { ...DEFAULTS };
  }
}
export function savePreferences(value, storage) {
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    storage.setItem('chess-studio.preferences', JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

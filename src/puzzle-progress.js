const KEY = 'chess.io.puzzle-progress.v1';
const empty = () => ({ solved: 0, failed: 0, assisted: 0, recent: [], attempts: [] });
export function createPuzzleStorage(storage) {
  const memory = new Map();
  return {
    getItem(key) {
      if (memory.has(key)) return memory.get(key);
      try {
        return storage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(key, value);
      } catch {
        /* Keep this session's counters in memory. */
      }
    },
  };
}
export function readPuzzleProgress(storage) {
  try {
    const value = JSON.parse(storage?.getItem(KEY) || 'null');
    if (!value || typeof value !== 'object') return empty();
    const result = empty();
    for (const key of ['solved', 'failed', 'assisted'])
      result[key] = Number.isSafeInteger(value[key]) && value[key] >= 0 ? value[key] : 0;
    for (const key of ['recent', 'attempts'])
      result[key] = Array.isArray(value[key])
        ? value[key].filter((v) => typeof v === 'string' && v.length <= 100).slice(-5000)
        : [];
    return result;
  } catch {
    return empty();
  }
}
export function recordPuzzleAttempt(storage, { id, outcome, attemptId }) {
  const result = readPuzzleProgress(storage);
  if (
    !['solved', 'failed', 'assisted'].includes(outcome) ||
    typeof id !== 'string' ||
    (attemptId && result.attempts.includes(attemptId))
  )
    return result;
  result[outcome]++;
  result.recent = [...result.recent.filter((v) => v !== id), id].slice(-5000);
  if (attemptId) result.attempts = [...result.attempts, attemptId].slice(-5000);
  try {
    storage?.setItem(KEY, JSON.stringify(result));
  } catch {
    /* Training still works without persistent storage. */
  }
  return result;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readPuzzleProgress,
  recordPuzzleAttempt,
  createPuzzleStorage,
} from '../src/puzzle-progress.js';
test('progresso conta tentativa única e limita histórico; armazenamento inválido não bloqueia', () => {
  let value = null;
  const storage = { getItem: () => value, setItem: (k, v) => (value = v) };
  assert.equal(readPuzzleProgress(storage).solved, 0);
  let p = recordPuzzleAttempt(storage, { id: 'a', outcome: 'solved', attemptId: 'one' });
  assert.equal(p.solved, 1);
  p = recordPuzzleAttempt(storage, { id: 'a', outcome: 'solved', attemptId: 'one' });
  assert.equal(p.solved, 1);
  p = recordPuzzleAttempt(storage, { id: 'b', outcome: 'assisted', attemptId: 'two' });
  assert.equal(p.assisted, 1);
  value = JSON.stringify({ ...p, recent: Array.from({ length: 5000 }, (_, i) => String(i)) });
  p = recordPuzzleAttempt(storage, { id: 'new', outcome: 'failed', attemptId: 'three' });
  assert.equal(p.recent.length, 5000);
  assert.equal(p.recent.at(-1), 'new');
  value = 'broken';
  assert.equal(readPuzzleProgress(storage).solved, 0);
  assert.doesNotThrow(() =>
    recordPuzzleAttempt(
      {
        getItem() {
          throw Error();
        },
        setItem() {
          throw Error();
        },
      },
      { id: 'z', outcome: 'solved' },
    ),
  );
});
test('armazenamento bloqueado conserva duas tentativas e IDs em memória durante a sessão', () => {
  for (const failed of [
    undefined,
    {
      getItem() {
        throw Error('blocked');
      },
      setItem() {
        throw Error('blocked');
      },
    },
    {
      getItem: () => null,
      setItem() {
        throw Error('quota');
      },
    },
  ]) {
    const storage = createPuzzleStorage(failed);
    recordPuzzleAttempt(storage, { id: 'first', outcome: 'solved', attemptId: 'one' });
    const result = recordPuzzleAttempt(storage, {
      id: 'second',
      outcome: 'solved',
      attemptId: 'two',
    });
    assert.equal(result.solved, 2);
    assert.deepEqual(result.recent, ['first', 'second']);
  }
});

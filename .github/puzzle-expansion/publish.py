"""One-off dataset preparation; publish only a reviewed branch, never main."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

root = Path.cwd()
work = Path(os.environ['RUNNER_TEMP']) / 'chess-puzzles-three-million'
work.mkdir()
def run(*args, capture=False):
    result = subprocess.run(args, check=True, text=True, capture_output=capture)
    return result.stdout.strip() if capture else None

source = work / 'lichess_db_puzzle.csv.zst'
run('curl', '--fail', '--location', '--retry', '3', '--output', str(source),
    'https://database.lichess.org/lichess_db_puzzle.csv.zst')
digest = hashlib.sha256()
with source.open('rb') as stream:
    for block in iter(lambda: stream.read(1048576), b''):
        digest.update(block)
assert digest.hexdigest() == '76335bfa7d7c4a7f93c1366d81549e53951ebb79dd43d34904cab8f22d962f8d', 'Source changed; stop rather than publish an unreviewed snapshot'
run(sys.executable, 'scripts/import-puzzles.py', '--source', str(source),
    '--output', str(work / 'generated'), '--limit', '3000000',
    '--workers', str(min(6, os.cpu_count() or 1)),
    '--last-modified', '2026-10-02T08:51:45Z')
run(sys.executable, '.github/puzzle-expansion/append.py', 'data/puzzles',
    str(work / 'generated'), str(work / 'final'))
run('node', 'scripts/check-puzzle-data.js', str(work / 'final'))
shutil.rmtree(root / 'data/puzzles')
shutil.move(str(work / 'final'), str(root / 'data/puzzles'))
for name in ['cover.svg', 'social-preview.png']:
    shutil.copyfile(root / '.github/puzzle-expansion' / name, root / 'assets/branding' / name)
readme = root / 'README.md'
text = readme.read_text().replace('1,000,000', '3,000,000').replace('1 million', '3 million').replace('--limit 1000000', '--limit 3000000')
package = root / 'package.json'
package.write_text(package.read_text().replace('1 million', '3 million'))
# Remove helpers here; the connector removes the workflow during promotion.
# GITHUB_TOKEN cannot modify workflow files.
shutil.rmtree(root / '.github/puzzle-expansion')
run('npm', 'run', 'build')
metrics = json.loads(run('node', 'scripts/check-puzzle-data.js', 'data/puzzles', 'dist', capture=True))
assert metrics['total'] == 3000000
text = text.replace('**44.9 MB**', f"**{metrics['puzzleBytes'] / 1e6:.1f} MB**")
text = text.replace('**509 compressed data packages**', f"**{metrics['shards']:,} compressed data packages**")
text = text.replace('**47.4 MB**', f"**{metrics['siteBytes'] / 1e6:.1f} MB**")
readme.write_text(text)
for script in ['check', 'lint', 'format:check']:
    run('npm', 'run', script)
run('npm', 'test')
run(sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py')
run('git', 'diff', '--check')
branch = 'data/puzzles-three-million-' + os.environ['GITHUB_RUN_ID']
run('git', 'switch', '-c', branch)
run('git', 'config', 'user.name', 'github-actions[bot]')
run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
run('git', 'add', '-A')
run('git', 'commit', '-m', 'Expand training collection to 3 million validated puzzles')
run('git', 'push', 'origin', 'HEAD:refs/heads/' + branch)
result = dict(metrics, branch=branch, sha=run('git', 'rev-parse', 'HEAD', capture=True),
              tree=run('git', 'rev-parse', 'HEAD^{tree}', capture=True))
print('PUBLISH_READY ' + json.dumps(result), flush=True)
Path(os.environ['GITHUB_STEP_SUMMARY']).write_text('Prepared and verified 3,000,000 puzzles.\n\n```json\n' + json.dumps(result, indent=2) + '\n```\n')

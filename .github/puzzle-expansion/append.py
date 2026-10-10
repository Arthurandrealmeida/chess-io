import collections
import gzip
import hashlib
import json
import pathlib
import shutil
import sys

old, generated, output = map(pathlib.Path, sys.argv[1:])
def unpack(path):
    return json.loads(gzip.decompress(path.read_bytes()))
def encode(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()

base = unpack(old / 'manifest.json.gz')
expanded = unpack(generated / 'manifest.json.gz')
assert base['total'] == 1_000_000 and expanded['total'] == 3_000_000
assert base['themes'] == expanded['themes'], 'Theme IDs changed; cannot reuse original shards'
assert base['source']['sha256'] == expanded['source']['sha256']
assert not output.exists()
old_ids = set()
for shard in base['shards']:
    for record in unpack(old / shard['path']):
        assert record[0] not in old_ids
        old_ids.add(record[0])
assert len(old_ids) == 1_000_000
shutil.copytree(old, output)
shards = list(base['shards'])
extra_shards = 0
def write_shard(records, bucket):
    global extra_shards
    if not records:
        return
    raw = encode(records)
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    if len(compressed) > 262144 or len(raw) > 1048576:
        assert len(records) > 1
        mid = len(records) // 2
        write_shard(records[:mid], bucket)
        write_shard(records[mid:], bucket)
        return
    name = f'r{bucket:02d}-extra-{extra_shards:05d}.json.gz'
    assert not (output / name).exists()
    (output / name).write_bytes(compressed)
    counts = collections.Counter(t for r in records for t in r[4])
    shards.append({'path': name, 'sha256': hashlib.sha256(raw).hexdigest(),
                   'gzipBytes': len(compressed), 'jsonBytes': len(raw),
                   'count': len(records), 'ratingMin': min(r[3] for r in records),
                   'ratingMax': max(r[3] for r in records),
                   'themeCounts': sorted(counts.items())})
    extra_shards += 1

seen = set()
preserved = added = 0
pending = []
bucket = None
for shard in expanded['shards']:
    for record in unpack(generated / shard['path']):
        assert record[0] not in seen, 'Duplicate ID in generated data'
        seen.add(record[0])
        if record[0] in old_ids:
            preserved += 1
            continue
        new_bucket = record[3] // 200
        if new_bucket != bucket or len(pending) == 2000:
            write_shard(pending, bucket)
            pending = []
        bucket = new_bucket
        pending.append(record)
        added += 1
write_shard(pending, bucket)
assert preserved == 1_000_000 and added == 2_000_000 and len(seen) == 3_000_000
expanded['shards'] = shards
manifest_bytes = gzip.compress(encode(expanded), mtime=0)
assert len(manifest_bytes) <= 1048576
(output / 'manifest.json.gz').write_bytes(manifest_bytes)
report = json.loads((generated / 'import-report.json').read_text())
report.update({'previousPublished': preserved, 'added': added,
               'reusedShards': len(base['shards']), 'manifestBytes': len(manifest_bytes),
               'shardCount': len(shards), 'shardBytes': sum(s['gzipBytes'] for s in shards)})
(output / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))

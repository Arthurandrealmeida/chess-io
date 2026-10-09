"""Offline import; source and SQLite temporaries never enter the published site."""
import argparse, concurrent.futures, csv, datetime, gzip, hashlib, io, json, os, pathlib, sqlite3, subprocess, tempfile, collections, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
def encode(value): return json.dumps(value,separators=(',',':'),ensure_ascii=False).encode()
def sha(data): return hashlib.sha256(data).hexdigest()
def validate_batch(batch):
    process=getattr(validate_batch.local,'process',None)
    if process is None:
        process=subprocess.Popen(['node',str(ROOT/'scripts/validate-puzzle-records.js')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
        validate_batch.local.process=process
    process.stdin.write(encode(batch).decode()+'\n'); process.stdin.flush()
    line=process.stdout.readline()
    if not line: raise RuntimeError('Validador encerrou sem resposta')
    return batch,json.loads(line)
import threading
validate_batch.local=threading.local()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--output',required=True);parser.add_argument('--limit',type=int);parser.add_argument('--workers',type=int,default=min(4,os.cpu_count() or 1));parser.add_argument('--last-modified',default=None);args=parser.parse_args()
    if args.limit is not None and args.limit < 1: parser.error('limit deve ser positivo')
    source=pathlib.Path(args.source);output=pathlib.Path(args.output)
    if output.exists() and any(output.iterdir()): parser.error('diretório de saída deve estar vazio; prepare nova versão separadamente')
    output.mkdir(parents=True,exist_ok=True); start=time.time(); report={'sourceRows':0,'duplicates':0,'rejected':0,'published':0,'errors':[]}
    with tempfile.TemporaryDirectory(prefix='chess-puzzles-') as temporary:
        db=sqlite3.connect(str(pathlib.Path(temporary)/'records.db'));db.execute('PRAGMA journal_mode=OFF');db.execute('PRAGMA synchronous=OFF')
        db.execute('CREATE TABLE records (id TEXT PRIMARY KEY, priority INTEGER, rating INTEGER, payload TEXT)')
        decompressor=None
        if source.suffix=='.zst':
            decompressor=subprocess.Popen(['zstd','-dc',str(source)],stdout=subprocess.PIPE);stream=io.TextIOWrapper(decompressor.stdout,encoding='utf-8')
        else: stream=source.open(encoding='utf-8',newline='')
        with stream:
            for row in csv.DictReader(stream):
                report['sourceRows']+=1
                try:
                    record=[row['PuzzleId'],row['FEN'],row['Moves'],int(row['Rating']),row['Themes'].split()]
                    if not 0 <= record[3] <= 10000: raise ValueError('rating')
                    priority=int.from_bytes(hashlib.blake2b(record[0].encode(),digest_size=8).digest(),'big')>>1
                    db.execute('INSERT INTO records VALUES (?,?,?,?)',(record[0],priority,record[3],encode(record).decode()))
                except sqlite3.IntegrityError: report['duplicates']+=1
                except (KeyError,ValueError): report['rejected']+=1
                if report['sourceRows']%250000==0: db.commit();print('Lidos',report['sourceRows'],flush=True)
        if decompressor and decompressor.wait()!=0: raise RuntimeError('Falha na descompressão da origem')
        db.commit();db.execute('CREATE INDEX selection ON records(priority)');db.execute('CREATE TABLE valid (bucket INTEGER,id TEXT,payload TEXT)')
        def batches():
            batch=[]
            for (payload,) in db.execute('SELECT payload FROM records ORDER BY priority'+(' LIMIT '+str(args.limit) if args.limit else '')):
                batch.append(json.loads(payload))
                if len(batch)==500: yield batch;batch=[]
            if batch: yield batch
        # Submit only a bounded number of batches; memory does not scale with collection size.
        themes=set(); checked=0
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,args.workers)) as pool:
            iterator=iter(batches());pending=[]
            for _ in range(max(1,args.workers)*2):
                batch=next(iterator,None)
                if batch: pending.append(pool.submit(validate_batch,batch))
            while pending:
                future=pending.pop(0);batch,results=future.result()
                for record,result in zip(batch,results):
                    if result['valid']:
                        db.execute('INSERT INTO valid VALUES (?,?,?)',(record[3]//200,record[0],encode(record).decode()));themes.update(record[4]);report['published']+=1
                    else:
                        report['rejected']+=1
                        if len(report['errors'])<20:report['errors'].append({'id':record[0],'error':result.get('error')})
                checked+=len(batch)
                if checked%10000==0:db.commit();print('Validados',checked,'válidos',report['published'],flush=True)
                batch=next(iterator,None)
                if batch: pending.append(pool.submit(validate_batch,batch))
        db.commit();themes=sorted(themes);theme_ids={t:i for i,t in enumerate(themes)};shards=[]
        def write_shard(records,bucket):
            if not records:return
            raw=encode(records);compressed=gzip.compress(raw,compresslevel=9,mtime=0)
            if len(compressed)>262144 or len(raw)>1048576:
                if len(records)==1:raise RuntimeError('Registro excede orçamento')
                middle=len(records)//2;write_shard(records[:middle],bucket);write_shard(records[middle:],bucket);return
            path=f'r{bucket:02d}-{len(shards):05d}.json.gz';(output/path).write_bytes(compressed)
            counts=collections.Counter(t for row in records for t in row[4])
            shards.append({'path':path,'sha256':sha(raw),'gzipBytes':len(compressed),'jsonBytes':len(raw),'count':len(records),'ratingMin':min(r[3] for r in records),'ratingMax':max(r[3] for r in records),'themeCounts':sorted(counts.items())})
        records=[];bucket=None
        for b,payload in db.execute('SELECT bucket,payload FROM valid ORDER BY bucket,id'):
            if b!=bucket or len(records)==2000:write_shard(records,bucket);records=[]
            bucket=b;record=json.loads(payload);record[4]=[theme_ids[t] for t in record[4]];records.append(record)
        write_shard(records,bucket)
        digest=hashlib.sha256()
        with source.open('rb') as f:
            for block in iter(lambda:f.read(1048576),b''):digest.update(block)
        manifest={'schemaVersion':1,'source':{'url':'https://database.lichess.org/lichess_db_puzzle.csv.zst','sha256':digest.hexdigest(),'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'lastModified':args.last_modified},'total':report['published'],'themes':themes,'shards':shards}
        raw=encode(manifest);compressed=gzip.compress(raw,mtime=0)
        if len(raw)>8388608 or len(compressed)>1048576:raise RuntimeError('Manifesto excede orçamento')
        (output/'manifest.json.gz').write_bytes(compressed)
        report.update({'sourceBytes':source.stat().st_size,'manifestBytes':len(compressed),'shardCount':len(shards),'shardBytes':sum(s['gzipBytes'] for s in shards),'seconds':round(time.time()-start,1),'sourceSha256':digest.hexdigest()})
        (output/'import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=='__main__':main()

import unittest, tempfile, pathlib, subprocess, csv, gzip, json
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ImportTest(unittest.TestCase):
 def test_quoted_csv_dedup_legal_records_shards_and_counts(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=pathlib.Path(tmp); source=path/'sample.csv'
   with source.open('w',newline='') as f:
    w=csv.writer(f);w.writerow(['PuzzleId','FEN','Moves','Rating','Themes','GameUrl'])
    fen='4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'
    w.writerow(['abc01',fen,'d7d5 e5d6',1200,'endgame short','https://example.org/a,b'])
    w.writerow(['abc01',fen,'d7d5 e5d6',1200,'endgame short',''])
    w.writerow(['bad01','not fen','a1a2 a2a3',1000,'',''])
    w.writerow(['bad02',fen,'d7d5 e5e8',1000,'',''])
   result=subprocess.run(['python3',str(ROOT/'scripts/import-puzzles.py'),'--source',str(source),'--output',str(path/'out'),'--workers','1'],capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stderr)
   m=json.loads(gzip.decompress((path/'out/manifest.json.gz').read_bytes()));self.assertEqual(m['total'],1)
   records=json.loads(gzip.decompress((path/'out'/m['shards'][0]['path']).read_bytes()));self.assertEqual(records[0][0],'abc01');self.assertEqual(len(records[0]),5)
   report=json.loads((path/'out/import-report.json').read_text());self.assertEqual(report['duplicates'],1);self.assertEqual(report['rejected'],2)
if __name__=='__main__':unittest.main()

import unittest, tempfile, json, io, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch
from contextlib import redirect_stdout
import capture_tree_forecast
class FrozenDatetime(datetime):
 @classmethod
 def now(cls,tz=None):return datetime(2026,10,8,9,0,tzinfo=timezone.utc)
class PipelineTests(unittest.TestCase):
 def test_capture_model_replays_in_typescript(self):
  # Synthetic features/labels only: this test is not an eligible race capture.
  training=[dict(season=2026,round=round_,type='DRIVER',code=f'D{i}',x=[float((i+j)%7) for j in range(10)],incumbent=10.0,actual=float(i%13)) for round_ in range(2,6) for i in range(20)]
  targets=[dict(season=2026,round=18,type='DRIVER',code='D0',x=[float(j%7) for j in range(10)],incumbent=10.0),dict(season=2026,round=18,type='CONSTRUCTOR',code='C0',x=[0.0]*10,incumbent=32.1)]
  source=dict(season=2026,round=18,lockAt='2026-10-20T10:00:00Z',sourceCapturedAt='2026-10-08T08:00:00Z',sourceSHA256='a'*64,training=training,targets=targets,status='SYNTHETIC FIXTURE; NOT RACE EVIDENCE')
  with tempfile.TemporaryDirectory() as directory:
   input_path=Path(directory)/'input.json';output_path=Path(directory)/'snapshot.json';input_path.write_text(json.dumps(source))
   with patch.object(sys,'argv',['capture_tree_forecast.py',str(input_path),str(output_path)]),patch.object(capture_tree_forecast,'datetime',FrozenDatetime),redirect_stdout(io.StringIO()):capture_tree_forecast.main()
   saved=json.loads(output_path.read_text(encoding='utf8'))
   self.assertEqual(saved['predictions'][1]['candidate'],32.1);self.assertEqual(len(saved['model']['trees']),60)
   result=subprocess.run(['node','node_modules/tsx/dist/cli.mjs','scripts/check-snapshot-tree-parity.ts',str(output_path)],capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stderr)
   self.assertIn('Portable math parity only',result.stdout)
if __name__=='__main__':unittest.main()

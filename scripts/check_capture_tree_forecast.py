import unittest, tempfile, json, copy
from pathlib import Path
from capture_tree_forecast import validate_input, write_snapshot, validate_protocol

class CaptureTests(unittest.TestCase):
 def payload(self):
  return dict(season=2026,round=18,lockAt='2026-10-20T10:00:00Z',sourceCapturedAt='2026-10-19T09:00:00Z',sourceSHA256='a'*64,training=[dict(season=2026,round=17,type='DRIVER',code='VER',x=[1.0]*10,incumbent=10.0,actual=11.0)],targets=[dict(season=2026,round=18,type='DRIVER',code='VER',x=[1.0]*10,incumbent=10.0),dict(season=2026,round=18,type='CONSTRUCTOR',code='RBR',x=[1.0]*10,incumbent=20.0)])
 def test_valid(self): validate_input(self.payload(),'2026-10-19T10:00:00Z','2026-10-08T07:08:34Z')
 def test_future_training_rejected(self):
  p=self.payload();p['training'][0]['round']=18
  with self.assertRaises(ValueError):validate_input(p,'2026-10-19T10:00:00Z','2026-10-08T07:08:34Z')
 def test_target_labels_rejected(self):
  p=self.payload();p['targets'][0]['actual']=0
  with self.assertRaises(ValueError):validate_input(p,'2026-10-19T10:00:00Z','2026-10-08T07:08:34Z')
 def test_late_capture_rejected(self):
  with self.assertRaises(ValueError):validate_input(self.payload(),'2026-10-20T10:00:00Z','2026-10-08T07:08:34Z')
 def test_nonfinite_rejected(self):
  p=self.payload();p['targets'][0]['x'][0]=float('nan')
  with self.assertRaises(ValueError):validate_input(p,'2026-10-19T10:00:00Z','2026-10-08T07:08:34Z')
 def test_duplicate_rejected(self):
  p=self.payload();p['targets'].append(p['targets'][0])
  with self.assertRaises(ValueError):validate_input(p,'2026-10-19T10:00:00Z','2026-10-08T07:08:34Z')
 def test_no_overwrite(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'snapshot.json';write_snapshot(path,{'prediction':1})
   with self.assertRaises(FileExistsError):write_snapshot(path,{'prediction':2})
   self.assertIn('1',path.read_text())
 def test_protocol_mutations_rejected(self):
  protocol=json.loads(Path('docs/driver-only-tree-prospective-protocol.json').read_text(encoding='utf8'))
  validate_protocol(protocol)
  for field in ['max_iter','learning_rate']:
   changed=copy.deepcopy(protocol);changed['candidate']['parameters'][field]=999
   with self.assertRaises(ValueError):validate_protocol(changed)
  changed=copy.deepcopy(protocol);changed['frozenAt']='2026-10-09T00:00:00Z'
  with self.assertRaises(ValueError):validate_protocol(changed)
  changed=copy.deepcopy(protocol);changed['candidate']['constructorResidualScale']=.5
  with self.assertRaises(ValueError):validate_protocol(changed)
 def test_invalid_serialization_creates_no_file(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'snapshot.json'
   with self.assertRaises(ValueError):write_snapshot(path,{'extra':float('nan')})
   self.assertFalse(path.exists())
if __name__=='__main__': unittest.main()

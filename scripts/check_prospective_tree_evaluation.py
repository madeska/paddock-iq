import unittest, hashlib, tempfile, subprocess, sys, json
from pathlib import Path
from evaluate_prospective_tree import score_event, summarize, validate_snapshot_identity
class EvaluationTests(unittest.TestCase):
 def snapshot(self):return dict(capturedAt='2026-10-08T09:00:00Z',input=dict(season=2026,round=18,lockAt='2026-10-20T10:00:00Z',targets=[dict(code='D0',type='DRIVER'),dict(code='C0',type='CONSTRUCTOR')]),predictions=[dict(code='D0',type='DRIVER',incumbent=10.,candidate=9.),dict(code='C0',type='CONSTRUCTOR',incumbent=20.,candidate=20.)])
 def outcomes(self):return dict(season=2026,round=18,raceEndedAt='2026-10-21T12:00:00Z',capturedAt='2026-10-22T00:00:00Z',scores=[dict(code='D0',type='DRIVER',actualPoints=8.),dict(code='C0',type='CONSTRUCTOR',actualPoints=22.)])
 def score(self,snapshot=None,outcome=None):return score_event(snapshot or self.snapshot(),outcome or self.outcomes(),'2026-10-23T00:00:00Z')
 def test_frozen_snapshot_identity_and_line_endings(self):
  raw=Path('docs/driver-only-tree-prospective-protocol.json').read_bytes();protocol=json.loads(raw)
  snapshot=self.snapshot();snapshot.update(policy=protocol['policy'],scikitLearn='1.7.2',protocolSHA256=hashlib.sha256(raw).hexdigest())
  validate_snapshot_identity(snapshot,raw,18)
  changed=dict(snapshot,protocolSHA256='a'*64)
  with self.assertRaises(ValueError):validate_snapshot_identity(changed,raw,18)
  changed=dict(snapshot,scikitLearn='1.9.0')
  with self.assertRaises(ValueError):validate_snapshot_identity(changed,raw,18)
  lf=raw.replace(b'\r\n',b'\n');snapshot['protocolSHA256']=hashlib.sha256(lf.replace(b'\n',b'\r\n')).hexdigest()
  validate_snapshot_identity(snapshot,raw,18)
 def test_empty_registry_cli_never_claims_validation(self):
  registry={'events':[dict(round=r,status='pending',reason='No captured forecast') for r in range(18,24)]}
  with tempfile.TemporaryDirectory() as directory:
   source=Path(directory)/'registry.json';output=Path(directory)/'report.json';source.write_text(json.dumps(registry))
   result=subprocess.run([sys.executable,'scripts/evaluate_prospective_tree.py',str(source),str(output)],capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stderr);report=json.loads(output.read_text(encoding='utf8'))
   self.assertEqual(report['eligibleEventCount'],0);self.assertFalse(report['independentConfirmation']);self.assertFalse(report['numericalGatePassed'])
   prior=output.read_bytes();second=subprocess.run([sys.executable,'scripts/evaluate_prospective_tree.py',str(source),str(output)],capture_output=True,text=True)
   self.assertNotEqual(second.returncode,0);self.assertEqual(output.read_bytes(),prior)
 def test_paired_errors_and_constructor_identity(self):
  result=self.score();self.assertEqual(result['rows'][0]['incumbentError'],2.);self.assertEqual(result['rows'][0]['candidateError'],1.);self.assertTrue(result['coverageComplete'])
 def test_missing_label_is_not_zero(self):
  outcome=self.outcomes();outcome['scores'][0]['actualPoints']=None
  result=self.score(outcome=outcome);self.assertEqual(len(result['rows']),1);self.assertFalse(result['coverageComplete']);self.assertEqual(result['missingLabels'],[{'code':'D0','type':'DRIVER'}])
 def test_real_zero_and_negative_labels_are_retained(self):
  outcome=self.outcomes();outcome['scores'][0]['actualPoints']=0;outcome['scores'][1]['actualPoints']=-10
  result=self.score(outcome=outcome);self.assertEqual(result['rows'][0]['incumbentError'],10);self.assertEqual(result['rows'][1]['incumbentError'],30)
 def test_unforecast_outcome_marks_incomplete_coverage(self):
  outcome=self.outcomes();outcome['scores'].append(dict(code='D1',type='DRIVER',actualPoints=0))
  result=self.score(outcome=outcome);self.assertFalse(result['coverageComplete']);self.assertEqual(result['unforecastOutcomeAssets'],[{'type':'DRIVER','code':'D1'}])
 def test_declared_missing_target_blocks_full_coverage(self):
  snapshot=self.snapshot();snapshot['input']['missingTargets']=[dict(type='DRIVER',code='D1',reason='No own history')]
  self.assertFalse(self.score(snapshot=snapshot)['coverageComplete'])
 def test_driver_only_cohort_cannot_pass_full_forecast_gate(self):
  snapshot=self.snapshot();snapshot['input']['targets']=snapshot['input']['targets'][:1];snapshot['predictions']=snapshot['predictions'][:1]
  outcome=self.outcomes();outcome['scores']=outcome['scores'][:1]
  events=[]
  for round_ in range(18,24):
   event=self.score(snapshot=snapshot,outcome=outcome);event['round']=round_;events.append(event)
  self.assertFalse(summarize(events,6)['numericalGatePassed'])
 def test_saved_lineup_scores_five_drivers_two_constructors_and_x2(self):
  snapshot=self.snapshot();outcome=self.outcomes();targets=[];predictions=[];scores=[]
  for i in range(5):
   targets.append(dict(type='DRIVER',code=f'D{i}'));predictions.append(dict(type='DRIVER',code=f'D{i}',incumbent=10.,candidate=9.));scores.append(dict(type='DRIVER',code=f'D{i}',actualPoints=8.))
  for i in range(2):
   targets.append(dict(type='CONSTRUCTOR',code=f'C{i}'));predictions.append(dict(type='CONSTRUCTOR',code=f'C{i}',incumbent=20.,candidate=20.));scores.append(dict(type='CONSTRUCTOR',code=f'C{i}',actualPoints=22.))
  snapshot['input']['targets']=targets;snapshot['predictions']=predictions;outcome['scores']=scores
  snapshot['input']['lineups']=[dict(teamNo=1,drivers=[f'D{i}' for i in range(5)],constructors=['C0','C1'],x2='D0')]
  result=self.score(snapshot=snapshot,outcome=outcome)
  self.assertEqual(result['lineups'][0]['incumbentError'],8.);self.assertEqual(result['lineups'][0]['candidateError'],2.)
 def test_constructor_change_rejected(self):
  snapshot=self.snapshot();snapshot['predictions'][1]['candidate']=21
  with self.assertRaises(ValueError):self.score(snapshot=snapshot)
 def test_duplicate_or_wrong_round_outcome_rejected(self):
  outcome=self.outcomes();outcome['scores'].append(outcome['scores'][0])
  with self.assertRaises(ValueError):self.score(outcome=outcome)
  outcome=self.outcomes();outcome['round']=19
  with self.assertRaises(ValueError):self.score(outcome=outcome)
 def test_incomplete_events_never_pass_numeric_gate(self):
  report=summarize([self.score()],6)
  self.assertFalse(report['numericalGatePassed']);self.assertEqual(report['status'],'insufficient-events');self.assertFalse(report['independentConfirmation'])
 def test_six_improving_synthetic_events_satisfy_numeric_gate_only(self):
  events=[]
  for round_ in range(18,24):
   event=self.score();event['round']=round_;events.append(event)
  report=summarize(events,6)
  self.assertTrue(report['numericalGatePassed']);self.assertFalse(report['independentConfirmation']);self.assertLess(report['pairedRaceBootstrap']['high'],0)
if __name__=='__main__':unittest.main()

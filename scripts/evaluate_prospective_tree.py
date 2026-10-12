"""Evaluate captured forecasts only; source eligibility requires a separate evidence audit."""
import argparse, json, math, random, hashlib, subprocess
from pathlib import Path
from datetime import datetime, timezone
from capture_tree_forecast import instant, finite, validate_input, validate_protocol, write_snapshot, validate_captured_lineups
from tree_publication_receipt import verify_publication_receipt

def identity(row):
 if row.get('type') not in ['DRIVER','CONSTRUCTOR'] or not isinstance(row.get('code'),str) or not row['code']:raise ValueError('Invalid asset identity')
 return (row['type'],row['code'])

def unique_rows(rows):
 result={}
 for row in rows:
  key=identity(row)
  if key in result:raise ValueError('Duplicate asset identity')
  result[key]=row
 return result

def score_saved_lineups(lineups,predictions,scores):
 validate_captured_lineups(lineups)
 result=[]
 for lineup in lineups:
  team=lineup['teamNo'];drivers=lineup['drivers'];constructors=lineup['constructors'];x2=lineup['x2']
  keys=[('DRIVER',code) for code in drivers]+[('CONSTRUCTOR',code) for code in constructors]+[('DRIVER',x2)]
  if any(key not in predictions or not finite(scores.get(key,{}).get('actualPoints')) for key in keys):
   result.append(dict(teamNo=team,status='missing-asset-or-label'));continue
  actual=sum(scores[k]['actualPoints'] for k in keys);incumbent=sum(predictions[k]['incumbent'] for k in keys);candidate=sum(predictions[k]['candidate'] for k in keys)
  result.append(dict(teamNo=team,status='paired-raw-lineup',actual=actual,incumbent=incumbent,candidate=candidate,incumbentError=incumbent-actual,candidateError=candidate-actual,note='Raw asset points plus x2; excludes chip effects and transfer penalties'))
 return result

def score_event(snapshot,outcome,now):
 data=snapshot['input'];round_=data['round']
 if outcome['season']!=data['season'] or outcome['round']!=round_:raise ValueError('Outcome forecast identity mismatch')
 if not instant(snapshot['capturedAt'])<instant(data['lockAt'])<instant(outcome['raceEndedAt'])<=instant(outcome['capturedAt'])<=instant(now):raise ValueError('Incomplete or future outcome')
 targets=unique_rows(data['targets']);predictions=unique_rows(snapshot['predictions']);scores=unique_rows(outcome['scores'])
 if targets.keys()!=predictions.keys():raise ValueError('Prediction target pairing mismatch')
 rows=[];missing=[]
 for key,prediction in predictions.items():
  if not finite(prediction['incumbent']) or not finite(prediction['candidate']):raise ValueError('Nonfinite prediction')
  if key[0]=='CONSTRUCTOR' and prediction['candidate']!=prediction['incumbent']:raise ValueError('Constructor forecast changed')
  actual=scores.get(key,{}).get('actualPoints')
  if actual is None:missing.append(dict(type=key[0],code=key[1]));continue
  if not finite(actual):raise ValueError('Invalid actual score')
  rows.append(dict(type=key[0],code=key[1],actual=actual,incumbentError=prediction['incumbent']-actual,candidateError=prediction['candidate']-actual))
 return dict(round=round_,rows=rows,lineups=score_saved_lineups(data.get('lineups',[]),predictions,scores),missingLabels=missing,coverageComplete=not missing and not data.get('missingTargets') and not any(k not in targets for k in scores),forecastCount=len(targets),pairedCount=len(rows),unforecastOutcomeAssets=[dict(type=k[0],code=k[1]) for k in scores if k not in targets],missingTargets=data.get('missingTargets',[]))

def metrics(errors):
 if not errors:return None
 return dict(n=len(errors),MAE=sum(abs(e) for e in errors)/len(errors),RMSE=math.sqrt(sum(e*e for e in errors)/len(errors)),bias=sum(errors)/len(errors))

def summarize(events,minimum_events):
 events=sorted(events,key=lambda e:e['round'])[:minimum_events]
 if len({e['round'] for e in events})!=len(events):raise ValueError('Duplicate evaluated round')
 rows=[r for event in events for r in event['rows']]
 lineup_rows=[r for event in events for r in event.get('lineups',[]) if r['status']=='paired-raw-lineup']
 lineup_summary={name:metrics([r[name+'Error'] for r in lineup_rows]) for name in ['incumbent','candidate']}
 summary={kind:{name:metrics([r[name+'Error'] for r in rows if kind=='ALL' or r['type']==kind]) for name in ['incumbent','candidate']} for kind in ['ALL','DRIVER','CONSTRUCTOR']}
 blocks=[(len(e['rows']),sum(abs(r['candidateError'])-abs(r['incumbentError']) for r in e['rows'])) for e in events if e['rows']]
 interval=None
 if blocks:
  samples=[];rng=random.Random(771)
  for _ in range(10000):
   draw=[rng.choice(blocks) for _ in blocks];samples.append(sum(b[1] for b in draw)/sum(b[0] for b in draw))
  samples.sort();interval=dict(deltaMAE=sum(b[1] for b in blocks)/sum(b[0] for b in blocks),low=samples[250],high=samples[9749])
 enough=len(events)>=minimum_events
 complete=all(e['coverageComplete'] for e in events)
 driver=summary['DRIVER'];constructor=summary['CONSTRUCTOR'];all_=summary['ALL']
 passed=bool(enough and complete and constructor['candidate'] and interval and interval['high']<0 and all_['candidate']['MAE']<all_['incumbent']['MAE'] and driver['candidate'] and driver['candidate']['RMSE']<=driver['incumbent']['RMSE'])
 return dict(status='insufficient-events' if not enough else 'numeric-pass-source-audit-required' if passed else 'numeric-gate-not-met',numericalGatePassed=passed,independentConfirmation=False,activationAllowed=False,eligibleEventCount=len(events),coverageComplete=complete,summary=summary,lineupSummary=lineup_summary,pairedRaceBootstrap=interval,note='Numerical comparison only. Publication proof does not certify official roster, quotes, feature cutoffs, lock or outcome source. Source audit and review remain required.')

def validate_snapshot_identity(snapshot,protocol_raw,round_):
 protocol=json.loads(protocol_raw);validate_protocol(protocol)
 lf=protocol_raw.replace(b'\r\n',b'\n')
 hashes={hashlib.sha256(lf).hexdigest(),hashlib.sha256(lf.replace(b'\n',b'\r\n')).hexdigest()}
 if snapshot.get('policy')!=protocol['policy'] or snapshot.get('scikitLearn')!='1.7.2' or snapshot.get('protocolSHA256') not in hashes or snapshot['input']['round']!=round_:raise ValueError('Frozen snapshot identity mismatch')


def main():
 parser=argparse.ArgumentParser();parser.add_argument('manifest');parser.add_argument('output');args=parser.parse_args()
 protocol_raw=Path('docs/driver-only-tree-prospective-protocol.json').read_bytes();protocol=json.loads(protocol_raw);validate_protocol(protocol)
 manifest=json.loads(Path(args.manifest).read_text(encoding='utf8'));events=manifest['events']
 if sorted(e['round'] for e in events)!=list(range(18,24)):raise ValueError('Registry must account for every2026 R18–23 exactly once')
 now=datetime.now(timezone.utc).isoformat();evaluated=[];pending=[];excluded=[]
 for event in sorted(events,key=lambda e:e['round']):
  status=event['status']
  if status in ['pending','excluded']:
   if not event.get('reason'):raise ValueError('Unreported pending/exclusion reason')
   (pending if status=='pending' else excluded).append(event);continue
  if status!='completed':raise ValueError('Invalid registry status')
  snapshot_path=Path(event['snapshot']);raw=snapshot_path.read_bytes();snapshot=json.loads(raw)
  validate_snapshot_identity(snapshot,protocol_raw,event['round'])
  validate_input(snapshot['input'],snapshot['capturedAt'],protocol['frozenAt'])
  publication=verify_publication_receipt(event['publication'],raw,snapshot['input']['lockAt'])
  if instant(publication['createdAt'])<instant(snapshot['capturedAt']):raise ValueError('Declared capture after publication')
  # Validate the stored model and paired predictions before opening any outcome labels.
  check=subprocess.run(['node','node_modules/tsx/dist/cli.mjs','scripts/check-snapshot-tree-parity.ts',str(snapshot_path)],capture_output=True,text=True)
  if check.returncode:raise ValueError('Stored model/prediction parity failed: '+check.stderr)
  outcome_raw=Path(event['outcomes']).read_bytes()
  if hashlib.sha256(outcome_raw).hexdigest()!=event['outcomesSHA256']:raise ValueError('Outcome source file changed')
  result=score_event(snapshot,json.loads(outcome_raw),now);result['publication']=publication;evaluated.append(result)
 report=summarize(evaluated,protocol['evaluation']['minimumCompletedEvents']);report.update(policy=protocol['policy'],events=evaluated,pending=pending,excluded=excluded,evaluatedAt=now)
 write_snapshot(args.output,report)
 print(json.dumps({key:report[key] for key in ['status','eligibleEventCount','numericalGatePassed','independentConfirmation']}))
if __name__=='__main__':main()

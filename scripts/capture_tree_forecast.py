"""Research capture only. Input provenance still requires source/feature audit."""
import argparse, hashlib, json, math
from datetime import datetime, timezone
from pathlib import Path

def instant(value):
 t=datetime.fromisoformat(value.replace('Z','+00:00'))
 if t.tzinfo is None: raise ValueError('Timestamp needs timezone')
 return t

def finite(value):
 return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def validate_input(data, now, frozen):
 lock=instant(data['lockAt']);captured=instant(data['sourceCapturedAt']);now=instant(now)
 if not instant(frozen)<=captured<=now<lock: raise ValueError('Capture must follow freeze and precede lock')
 if data['season']!=2026 or not isinstance(data['round'],int) or data['round']<18: raise ValueError('Ineligible scope')
 digest=data['sourceSHA256']
 if len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest): raise ValueError('Source hash required')
 for section in ['training','targets']:
  if not data[section]: raise ValueError('Empty cohort')
  seen=set()
  for row in data[section]:
   identity=(row['round'],row['type'],row['code'])
   if identity in seen: raise ValueError('Duplicate identity')
   seen.add(identity)
   if row['season']!=2026 or row['type'] not in ['DRIVER','CONSTRUCTOR'] or not row['code']: raise ValueError('Invalid identity')
   if not isinstance(row['round'],int) or row['round']<1: raise ValueError('Invalid round')
   if section=='training':
    if row['round']>=data['round'] or not finite(row['actual']): raise ValueError('Future or invalid training label')
   elif row['round']!=data['round'] or 'actual' in row: raise ValueError('Target labels forbidden')
   if len(row['x'])!=10 or not all(finite(x) for x in row['x']) or not finite(row['incumbent']): raise ValueError('Invalid features')
 if not any(r['type']=='DRIVER' for r in data['training']): raise ValueError('No driver training')

def write_snapshot(path, data):
 # Exclusive creation: never replace previously captured predictions.
 serialized=json.dumps(data,indent=2,allow_nan=False)+'\n'
 with Path(path).open('x',encoding='utf8') as stream: stream.write(serialized)

def validate_protocol(protocol):
 expected=json.loads("{\"version\":1,\"frozenAt\":\"2026-10-08T07:08:34.949Z\",\"policy\":\"driver-only-tree-half-v1\",\"developmentEvidence\":\"2023/2024/2025 and 2026 R1–16 already inspected by earlier research; none are independent evidence\",\"candidate\":{\"driverResidualScale\":0.5,\"constructorResidualScale\":0,\"parameters\":{\"loss\":\"squared_error\",\"learning_rate\":0.05,\"max_iter\":60,\"max_leaf_nodes\":4,\"min_samples_leaf\":20,\"l2_regularization\":10,\"early_stopping\":false,\"random_state\":42,\"correctionScale\":0.5}},\"training\":\"Separate driver model refit using only strictly earlier forecast frames in the target season; actual is label only. No target/future labels. No hyperparameter reselection.\",\"reference\":\"Shared production baseline and 25% component blend, identical roster, historical features and final rounding. Constructor predictions bit-for-bit unchanged.\",\"evaluation\":{\"season\":2026,\"minimumRound\":18,\"minimumCompletedEvents\":6,\"requireCapturedBeforeLock\":true,\"requireLockAfterFreeze\":true,\"selection\":\"First six eligible completed race weekends; no selection by forecast errors\",\"primaryMetric\":\"Equal-weight per-asset MAE over all paired drivers and constructors\",\"secondaryMetrics\":[\"per-type MAE\",\"per-type RMSE\",\"per-type bias\",\"coverage\",\"team lineup error with x2 if available\"],\"uncertainty\":\"10000 paired race-block bootstrap draws, Python Random seed 771; 2.5% and 97.5% endpoints\",\"success\":\"Full per-asset MAE lower with upper delta interval below zero; driver RMSE no worse; constructors unchanged; source identity, history cutoff and quote timing verified\"},\"capture\":\"Immutable source/feature/prediction snapshot with SHA256 committed before each official lock; predictions captured after lock ineligible. Missing outcomes are never zero; exclusions audited before error comparison.\",\"activation\":\"No automatic activation. Require prospective success plus tested production inference parity and review. No claim of global optimality.\",\"failure\":\"Report failure or insufficient eligible races without retuning this protocol. A changed candidate requires a new protocol and fresh unseen outcomes.\"}")
 if protocol!=expected: raise ValueError('Frozen protocol changed')

def main():
 import numpy as np
 import sklearn
 from sklearn.ensemble import HistGradientBoostingRegressor
 from threadpoolctl import threadpool_limits
 parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('output');args=parser.parse_args()
 raw=Path(args.input).read_bytes();data=json.loads(raw)
 protocol_raw=Path('docs/driver-only-tree-prospective-protocol.json').read_bytes();protocol=json.loads(protocol_raw)
 if sklearn.__version__!='1.7.2': raise ValueError('Frozen scikit-learn version 1.7.2 required')
 validate_protocol(protocol)
 now=datetime.now(timezone.utc).isoformat();validate_input(data,now,protocol['frozenAt'])
 options=dict(protocol['candidate']['parameters']);options.pop('correctionScale')
 train=[r for r in data['training'] if r['type']=='DRIVER'];drivers=[r for r in data['targets'] if r['type']=='DRIVER']
 with threadpool_limits(limits=1):
  model=HistGradientBoostingRegressor(**options).fit(np.array([r['x'] for r in train]),np.array([r['actual']-r['incumbent'] for r in train]))
  deltas=model.predict(np.array([r['x'] for r in drivers])) if drivers else []
 correction={r['code']:float(delta) for r,delta in zip(drivers,deltas)}
 predictions=[dict(code=r['code'],type=r['type'],incumbent=r['incumbent'],candidate=(math.floor((r['incumbent']+.5*correction[r['code']])*10+.5)/10 if r['type']=='DRIVER' else r['incumbent'])) for r in data['targets']]
 # Recheck real time after model fitting; a long fit crossing lock is ineligible.
 finished=datetime.now(timezone.utc).isoformat();validate_input(data,finished,protocol['frozenAt'])
 write_snapshot(args.output,dict(policy=protocol['policy'],capturedAt=finished,inputSHA256=hashlib.sha256(raw).hexdigest(),protocolSHA256=hashlib.sha256(protocol_raw).hexdigest(),scikitLearn=sklearn.__version__,input=data,predictions=predictions,status='Research capture; source audit and pre-lock Git commit evidence required'))
 print(json.dumps({'output':args.output,'predictions':len(predictions),'capturedAt':finished}))
if __name__=='__main__': main()

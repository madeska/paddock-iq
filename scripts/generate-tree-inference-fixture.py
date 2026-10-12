import json, math, hashlib
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from threadpoolctl import threadpool_limits
from export_tree_residual_model import export_tree_residual_model
from capture_tree_forecast import validate_protocol

def main():
 source=Path('docs/tree-forecast-frames-2025.json').read_bytes();frames=json.loads(source)['frames']
 protocol=json.loads(Path('docs/driver-only-tree-prospective-protocol.json').read_text(encoding='utf8'));validate_protocol(protocol)
 options=dict(protocol['candidate']['parameters']);options.pop('correctionScale')
 cases=[]
 with threadpool_limits(limits=1):
  for round_ in [6,24]:
   train=[r for r in frames if r['type']=='DRIVER' and r['round']<round_]
   target=[r for r in frames if r['type']=='DRIVER' and r['round']==round_]
   model=HistGradientBoostingRegressor(**options).fit(np.array([r['x'] for r in train]),np.array([r['actual']-r['incumbent'] for r in train]))
   inputs=[dict(features=r['x'],incumbent=r['incumbent'],kind='historical target feature; accuracy already consumed') for r in target]
   for stage in model._predictors:
    for node in stage[0].nodes:
     if node['is_leaf']: continue
     threshold=float(node['num_threshold'])
     for value in [math.nextafter(threshold,-math.inf),threshold,math.nextafter(threshold,math.inf)]:
      x=list(target[0]['x']);x[int(node['feature_idx'])]=value
      inputs.append(dict(features=x,incumbent=target[0]['incumbent'],kind='synthetic threshold boundary; not forecast evidence'))
   residuals=model.predict(np.array([r['features'] for r in inputs]))
   for row,delta in zip(inputs,residuals):
    row['residual']=float(delta);row['candidate']=math.floor((row['incumbent']+.5*float(delta))*10+.5)/10
   cases.append(dict(model=export_tree_residual_model(model,2025,round_),inputs=inputs))
 report=dict(note='Portable inference parity only. No new accuracy selection or activation.',frameLFNormalizedSHA256=hashlib.sha256(source.replace(b'\r\n',b'\n')).hexdigest(),cases=cases)
 Path('scripts/fixtures/tree-inference-parity.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf8')
 print(json.dumps({'models':len(cases),'vectors':sum(len(c['inputs']) for c in cases)}))
if __name__=='__main__': main()

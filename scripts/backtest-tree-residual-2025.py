import json, math, random, sys, hashlib
import sklearn
import argparse
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from threadpoolctl import threadpool_limits

def metrics(errors):
 return {'n':len(errors),'MAE':sum(abs(e) for e in errors)/len(errors),'RMSE':math.sqrt(sum(e*e for e in errors)/len(errors)),'Bias':sum(errors)/len(errors)}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--season',type=int,choices=[2023,2024,2025],default=2025);season=parser.parse_args().season
 frame_path=Path(f'docs/tree-forecast-frames-{season}.json');frames=json.loads(frame_path.read_text())['frames'];assert all(r['season']==season for r in frames)
 rounds=sorted(set(r['round'] for r in frames if r['round']>=6));scales=[('incumbent',0),('tree-residual-half',.5)]+([('tree-residual-full',1)] if season==2025 else []);names=[name for name,_ in scales]
 options=dict(loss='squared_error',learning_rate=.05,max_iter=60,max_leaf_nodes=4,min_samples_leaf=20,l2_regularization=10,early_stopping=False,random_state=42)
 outcomes=[]
 with threadpool_limits(limits=1):
  for round_ in rounds:
   for kind in ['DRIVER','CONSTRUCTOR']:
    train=[r for r in frames if r['round']<round_ and r['type']==kind]
    target=[r for r in frames if r['round']==round_ and r['type']==kind]
    assert all(r['round']<round_ for r in train)
    model=HistGradientBoostingRegressor(**options).fit(np.array([r['x'] for r in train]),np.array([r['actual']-r['incumbent'] for r in train]))
    correction=model.predict(np.array([r['x'] for r in target]))
    for row,delta in zip(target,correction):
     for name,scale in scales:
      prediction=math.floor((row['incumbent']+scale*float(delta))*10+.5)/10
      outcomes.append(dict(round=round_,type=kind,model=name,error=prediction-row['actual']))
 summary=[dict(model=name,type=kind,**metrics([r['error'] for r in outcomes if r['model']==name and r['type']==kind])) for name in names for kind in ['DRIVER','CONSTRUCTOR']]
 intervals=[]
 for name in names[1:]:
  for kind in ['DRIVER','CONSTRUCTOR']:
   blocks=[]
   for round_ in rounds:
    base=[r['error'] for r in outcomes if r['round']==round_ and r['type']==kind and r['model']=='incumbent']
    candidate=[r['error'] for r in outcomes if r['round']==round_ and r['type']==kind and r['model']==name]
    assert len(base)==len(candidate)
    blocks.append((len(base),sum(map(abs,candidate))-sum(map(abs,base))))
   rng=random.Random(771);samples=[]
   for _ in range(10000):
    draw=[rng.choice(blocks) for _ in blocks];samples.append(sum(b[1] for b in draw)/sum(b[0] for b in draw))
   samples.sort();intervals.append(dict(model=name,type=kind,deltaMAE=sum(b[1] for b in blocks)/sum(b[0] for b in blocks),low=samples[250],high=samples[9749]))
 report=dict(environment={'python':sys.version,'numpy':np.__version__,'scikitLearn':sklearn.__version__},frameFileSHA256=hashlib.sha256(frame_path.read_bytes()).hexdigest(),frameFileLFNormalizedSHA256=hashlib.sha256(frame_path.read_bytes().replace(b'\r\n',b'\n')).hexdigest(),options=options,summary=summary,pairedRaceBootstrap=intervals,season=season,note=f'Supplementary/exploratory already-consumed{season} errors. Fixed2025-selected shallow model; only half correction validated on other seasons. Source/year-adapter/quote limits remain. Separate type models; only strictly earlier production forecast frames train residuals. Fixed shallow configuration, no parameter search/activation. Python bootstrap generator differs from earlier JS reports. Full driver/constructor comparison with same rows.',byRound=[dict(round=r,model=name,type=kind,**metrics([o['error'] for o in outcomes if o['round']==r and o['type']==kind and o['model']==name])) for r in rounds for name in names for kind in ['DRIVER','CONSTRUCTOR']])
 Path(f'docs/tree-residual-{season}-results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'summary':summary,'intervals':intervals},indent=2))
if __name__=='__main__': main()

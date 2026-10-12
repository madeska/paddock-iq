import json, math, random
from pathlib import Path

# Policy selected after inspecting these seasons: supplementary, not blind validation.
results = []
for season in [2023, 2024, 2025]:
    source = json.loads(Path(f'docs/tree-residual-{season}-results.json').read_text())
    rows = source['byRound']
    rounds = sorted({r['round'] for r in rows})
    blocks = []
    for round_ in rounds:
        baseline = [r for r in rows if r['round'] == round_ and r['model'] == 'incumbent']
        candidate = [r for r in rows if r['round'] == round_ and ((r['type'] == 'DRIVER' and r['model'] == 'tree-residual-half') or (r['type'] == 'CONSTRUCTOR' and r['model'] == 'incumbent'))]
        assert len(baseline) == len(candidate) == 2
        assert {r['type']:r['n'] for r in baseline} == {r['type']:r['n'] for r in candidate}
        blocks.append((sum(r['n'] for r in baseline), sum(r['n']*r['MAE'] for r in baseline), sum(r['n']*r['MAE'] for r in candidate)))
    count = sum(b[0] for b in blocks)
    rng = random.Random(771)
    samples = []
    for _ in range(10000):
        draw = [rng.choice(blocks) for _ in blocks]
        samples.append(sum(b[2]-b[1] for b in draw)/sum(b[0] for b in draw))
    samples.sort()
    results.append(dict(season=season,n=count,incumbentMAE=sum(b[1] for b in blocks)/count,candidateMAE=sum(b[2] for b in blocks)/count,deltaMAE=sum(b[2]-b[1] for b in blocks)/count,low=samples[250],high=samples[9749],constructorsUnchanged=True))
report = dict(policy='Half tree residual for drivers; incumbent constructors unchanged',status='Supplementary comparison; policy chosen after consuming all three seasons; no independent confirmation or production activation',metric='Unweighted per-asset MAE across drivers and constructors; not team lineup scoring',results=results)
Path('docs/driver-only-tree-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

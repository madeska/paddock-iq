# Fixed shallow tree residual correction

Research-only scikit-learn HistGradientBoostingRegressor1.7.2, squared loss,60 iterations, max4 leaves, min20 samples/leaf, learning rate0.05,L2=10, early_stopping=False, seed42. Fixed configuration, no parameter grid. Two correction scales tested: half/full. Training each type uses only earlier target-round forecast frames. Python environment is isolated outside the app checkout; production dependencies unchanged.

Features are generated from the shared production baseline/component simulation, audited quote, past score summaries/history count and known practice/sprint context. Actual points are a separate label. Export asserts original full replay parity and future-score baseline invariance. Candidate rows and incumbent evaluation cohorts are identical.

Consumed2025 R6–24:379 drivers,190 constructors. Half correction MAE10.5894→10.4137(DR),18.3568→18.0311(CT);RMSE14.1685→14.0217 and23.6429→23.4637. Bias0.3573→0.3863 and-0.1221→0.5111. Race-block delta-MAE intervals DR[-0.2792,-0.0782],CT[-0.7374,+0.0526]. Full correction is weaker. This is promising exploratory driver evidence, not independent validation or joint superiority.

The bootstrap uses Python Random771, which differs from previous JS generators; method remains paired race-block resampling. Pin environment with scripts/tree-model-requirements.txt. Export via scripts/export-tree-forecast-frames-2025.ts, evaluate via scripts/backtest-tree-residual-2025.py. Dataset/error windows already consumed; no production activation. Official model documentation: https://scikit-learn.org/1.7/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html.

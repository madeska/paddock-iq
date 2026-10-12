# Portable tree residual inference

The research model can now be exported from pinned sklearn1.7.2 to numerical tree JSON and evaluated in TypeScript without Python. This code is not imported by the production prediction API and does not activate the candidate.

Python export checks the complete pinned estimator configuration, including default depth and constraints, against the frozen fitting parameters, ten features and sixty scalar boosting stages; categorical splits are rejected. Leaf values already contain shrinkage and must not be multiplied by learning rate again. TypeScript validates the model and tree graph, checks target season/round identity, follows numerical threshold equality left, and sums the base plus all leaf values. Driver-only correction uses half the residual with one-decimal rounding and canonical zero. Constructor predictions are returned unchanged.

The committed parity fixture uses existing consumed2025 training windows before R6 and R24. It includes 946 numerical test vectors, both historical target features and synthetic split-threshold boundaries. Residual differences must be below1e-10; rounded candidate outputs must exactly match sklearn. These tests prove implementation parity, not accuracy or independent improvement.

Prospective Python capture now stores the exported fitted model beside its predictions and full input. After capture, run npx tsx scripts/check-snapshot-tree-parity.ts SNAPSHOT.json. This checks prediction identity and portable math only, not source provenance, quote timing or publication-before-lock eligibility. A valid result does not permit production activation.

Reproduce the fixture with Python scripts/generate-tree-inference-fixture.py in the pinned environment; run TypeScript scripts/check-tree-residual-inference.ts with tsx --test. Python export guard tests are scripts/check_tree_model_export.py. Fixture model data is numerical research output, not a production model artifact for a future race.

Additional synthetic end-to-end test: Python scripts/check_tree_capture_pipeline.py runs the actual capture entry point under a fixed test clock and passes its temporary snapshot to the TypeScript parity CLI. The temporary artifact is removed and is never committed as race evidence.

The main application tsconfig excludes scripts. The new research TypeScript files were therefore also checked explicitly with strict standalone TypeScript settings and the same esnext/dom libraries; this caught and fixed a subprocess test return-type annotation.

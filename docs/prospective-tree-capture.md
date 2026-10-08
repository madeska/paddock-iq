# Prospective tree capture tool

Research-only CLI: Python scripts/capture_tree_forecast.py INPUT.json OUTPUT.json, with scripts/tree-model-requirements.txt installed. Run from the repository root. The frozen scikit-learn version is enforced.

Input contains season, round, official lockAt, sourceCapturedAt, sourceSHA256, training and targets. Each row has season, round, type, code, the ten features in tree-forecast-frames-2025.json order, and incumbent. Training rows additionally contain actual; targets must never contain actual. Use the shared production forecast exporter logic to generate frames, not hand-entered estimates. Training features must themselves have been generated with historical cutoffs. A syntactically valid input is not proof of that provenance.

The tool refits the frozen shallow driver model on earlier same-season frames, applies half the residual, keeps constructors unchanged, and writes the full input and predictions with input/protocol hashes. Source capture and completed fit must precede lock and follow protocol freeze. Exclusive file creation prevents accidental overwrite. Commit the snapshot before lock; filesystem timestamps and hashes alone do not prove publication timing. No local tool can prevent subsequent manual editing, so audit the pre-lock Git object against the stored hashes.

Seven guard tests run with Python scripts/check_capture_tree_forecast.py. These do not yet verify end-to-end source export or model parity. No actual prospective snapshot has been captured, no production integration has been activated, and no independent improvement has been established. Source identity, verified quote timing, cutoff-safe features, and official lock provenance are still mandatory audits before including an event in validation.

# Past-only adaptive component weight

Research-only convex stacking, independently for drivers and constructors. Given prior forecast baseline b, component c and actual y, learn weight from strictly earlier target rounds with least-squares contrast c-b; fixed20-observation shrink toward incumbent0.25 and clamp[0,1]. Zero contrast or no history keeps0.25. No search over shrinkage or weights. Caller must supply historical forecast features generated without future outcomes; labels alone being past is not enough.

Benchmark rebuilds shared production frames chronologically R2–24 from the complete pinned2025 source, audited prices and completed practice. Reports already-consumed R6–24:379 paired drivers and190 constructors, explicit COLR7 cold-start omission. Both models use identical field, seed,2025 scoring, intensity and rounding. Reference full replay parity, target/future input mutation and learned-weight target/future mutation checks run each round. Current rows may be stored before candidate evaluation but strict r<target excludes them.

| Asset | Reference MAE | Candidate MAE | Reference RMSE | Candidate RMSE | Reference bias | Candidate bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Driver |10.5894|10.5340|14.1685|14.0643|0.3573|0.9889|
| Constructor |18.3568|18.1937|23.6429|23.1680|-0.1221|0.6695|

Race-block delta-MAE intervals cross zero: drivers[-0.2737,+0.1707], constructors[-0.5716,+0.1989]. Learned weights near0.7 for drivers and0.46–0.61 for constructors improve squared error slightly but worsen overprediction bias. No robust joint superiority or independent confirmation. Production stays unchanged. Four unit tests pass; no production caller enables stacking.

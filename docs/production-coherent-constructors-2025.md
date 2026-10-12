# Constructor forecasts coherent with unchanged driver forecasts

Research-only identity: constructor expectation=sum two unrounded final driver expectations + simulated constructor total - simulated total of the same two drivers. The difference retains QT/pit extras and removes their simulated DOTD awards. No final-driver rounding before aggregation, no double counting. Exactly two known projected drivers required; otherwise retain shared baseline fallback. No target labels enter this transformation.

Already-consumed2025 R6–24,379 paired drivers and190 constructors. All driver predictions remain exactly unchanged. Full coherent variant constructor MAE18.3568→17.8311,RMSE23.6429→22.9998,bias-0.1221→-0.0258. Half-coherent variant MAE18.0174,RMSE23.2049,bias-0.0742. Fixed variants, no parameter fitting. Full coherent is the stronger exploratory candidate across all three metrics.

Paired race-block delta-MAE intervals still cross zero: full[-1.4926,+0.3711], half[-0.8384,+0.1321]. This is exploratory improvement, not proof of superiority. Three helper tests, shared incumbent parity/future-input invariance and current type checks pass. No production caller enables it.

# Driver-only tree policy

Half residual correction applies only to drivers; constructors retain exactly the incumbent forecast. The fixed tree configuration is unchanged. This policy was chosen after seeing the mixed cross-season results, so these comparisons are supplementary and cannot serve as independent confirmation.

| Season | Full per-asset MAE incumbent | Candidate | Paired race-block delta interval |
| --- | ---: | ---: | ---: |
| 2023 | 12.5604 | 12.5333 | [-0.1751, +0.1305] |
| 2024 | 10.6095 | 10.4510 | [-0.2642, -0.0537] |
| 2025 | 13.1831 | 13.0661 | [-0.1861, -0.0520] |

The metric averages each available asset prediction equally, not a Fantasy team lineup or doubled-driver total. It does not establish improvements in transfer recommendations or lineup ranking. Constructor forecasts are unchanged by construction; this avoids the observed constructor deterioration from applying tree residuals to both types. Source timing and historical simulation adapter limitations still apply. No production activation.

Reproduce with Python scripts/check-driver-only-tree.py using the committed per-round tree reports. The script checks paired type counts and uses 10,000 race-block bootstrap draws with seed 771. Next required evidence is a frozen policy evaluated on an untouched season or new races, followed by a tested production inference implementation if that validation supports activation.

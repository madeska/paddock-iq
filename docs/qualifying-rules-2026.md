# 2026 qualifying progression correction

Production constructor forecasts now use `xpts-constructor-baseline75-component25-v3`. Driver forecasts remain v2. Market and My Team retain older constructor versions as fallbacks until a projection refresh.

The former fixed Q2 cutoff of 15 assumed a 20-car field. With 22 cars, six are eliminated after Q1 and sixteen can reach Q2. The simulator now derives the cutoff from field size: 20 -> 15, 22 -> 16, 24 -> 17. Drivers with no qualifying time remain excluded from progression awards.

Source: [Formula 1's 2026 rule changes](https://www.formula1.com/en/latest/article/from-smaller-cars-to-a-bigger-budget-cap-12-rule-changes-you-need-to-know-in.56uUTFhB0z5j3iZfhC0rGP).

A deterministic 22-driver test places one constructor's drivers P15/P16: both reach Q2 and the constructor receives the three-point teamwork bonus rather than one point. A 20-driver test preserves the one-point bonus for that same pair. Existing no-time and disqualification behavior is unchanged.

Historical diagnostic: reconstructing constructor qualifying totals from the stored official driver results and progression bonuses matches 160 of 176 rows with the old cutoff and 175 with the corrected cutoff. The remaining RBR round-4 case includes an additional constructor qualification penalty; this cutoff correction does not add a disqualification probability model.

Earlier stored research reports describe the v2 fifteen-driver-cutoff snapshot. Re-running their commands now includes the corrected constructor Q2 rule, so constructor metrics can differ from those historical JSON snapshots; driver metrics remain comparable. The new recent-overtake report identifies its v3 baseline explicitly.

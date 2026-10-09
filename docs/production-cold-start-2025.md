# Research-only cold-start prior

Fixed prior:50% current teammate past-score EWMA(alpha.25)+50% pooled past driver-score mean. With no teammate history use pooled mean; with no past history, quote or known team omit prediction. Own chronological history remains empty; no invented scores, boost or practice position. Existing production baseline entries and production callers are unchanged.

Exploratory consumed2025 R6–14 comparison holds component weight25%, shared practice/pit/scoring/seed/rounding unchanged. The candidate adds COL R7 and restores Alpine constructor support. New prediction7.7 versus actual0 is reported separately, not mixed into common-cohort metrics. On179 common drivers MAE10.6626→10.6592; on90 constructors17.4333→17.3900. Only one event changes, so nine-block bootstrap intervals ending at zero reflect many unaffected blocks, not robust evidence across nine cold starts. No activation or independent superiority claim.

This addresses coverage rather than proving stronger point forecasts. New field membership alters rankings and random draws for every asset in the affected event. Future validation must include more entrant events and explicitly separate cold-start quality from common-cohort effects. Four unit tests cover fixed prior calculation, strict future-label exclusion unavailable data and invalid quotes. Type checks and incumbent replay parity pass.

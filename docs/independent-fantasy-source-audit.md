# Independent Fantasy archive source audit

Goal: evaluate full Fantasy xPts on a separate season, rather than repeatedly selecting models on 2026 data.

Candidate: https://github.com/JoshCBruce/fantasy-data, pinned commit `1bb0e02d06e1567e01cda53532e031a4086eac2f`. The author describes extraction from official Fantasy statistics. This is a third-party snapshot, not a currently official validated dataset.

Sample audit of `latest/driver_data/NOR.json` and `latest/constructor_data/MCL.json`:

- Missing R6 and R7 entries.
- Two different Italy entries labeled R16.
- Three different United States entries labeled R22, including an empty zero-score entry.
- Current asset value is present; a full race-by-race pre-lock price history is not established. Never use the current value as an earlier race's price.

The older `15-Netherlands/driver_data/NOR.json` preserves R6 United States and R7 Italy, consistent with Miami/Imola chronological slots, but country labels alone do not uniquely identify events. Its R15 total is zero; completed-session status must be established instead of treating empty observations as played zeros.

Decision: do not admit `latest` into independent validation. Audit the older snapshot against event chronology and sum-of-components checks. No benchmark scores have been computed on either snapshot yet. Preserve a later untouched subset only after validating identifiers/completeness without examining model error. Do not execute the source repository's scraper or assume a source asset's current team applies to past races.

Samples are cached outside the repository under `../simulation-research/fantasy-2025-public`. No source code or third-party dataset is redistributed by this audit. Production models are unchanged.

## Follow-up recovery

The country collision was traced to the pinned author's country-name round Map and stable per-asset numeric sorting. Chronological occurrences were recovered with older snapshot anchors, while lossy team-swap records remain unknown. See `independent-fantasy-2025.md` for evidence, strict recovery rules and model-evaluation partition limits. No ambiguous score is invented.

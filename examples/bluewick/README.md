# Example run: Bluewick (fictional)

Bluewick Fleet Systems is an invented company that sells GPS tracking, ELD compliance and dashcams to commercial
fleets. Every rep, account, deal, call and score here is synthetic.

| File | What it is |
|---|---|
| `config.json` | The run's settings: column mapping, won/lost stages, and pinned engine weights. |
| `deals.csv` | The CRM export: 1,424 deals, one row each. |
| `content.json` | Coaching wording tailored to fleet telematics. Compare it with `../../rep-coaching/assets/content.json` to see what tailoring looks like. |
| `workspace/scores/calls.jsonl` | 330 scored calls, one per line (what step 3 produces). |
| `workspace/scores/emails.jsonl` | 379 scored email threads, one per line. |
| `bluewick_rep_coaching.html` | The finished page. Open it in a browser. |

The weights are pinned in `config.json` so the page matches the published demo. To watch the skill learn them from
this data instead, change `"weights"` to `"learn"` and rebuild; with only fictional outcomes behind them, expect
noisy results.

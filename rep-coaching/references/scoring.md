# Scoring a call or an email thread

This is the instruction set for step 3. Whoever scores (you, or a subagent you dispatch) reads this file and the
run's `content.json` (or `assets/content.json` if the run has none), then writes one JSON file per call and one per
email thread. `assemble.rb` validates every file and refuses to build if any rule below is broken.

## Inputs

- **A call:** one item from `workspace/queue_calls.json`: `call_id`, `deal_id`, `account`, `owner`, `file` (the
  transcript). The rep being scored is the deal's owner.
- **An email thread:** one item from `workspace/queue_emails.json`: `deal_id`, `thread_file`, `owner`. The thread
  is every email on the deal, oldest first. Score only what the owner did or caused; ignore threads they are not part of.

## For each of the 13 skills

Take the skill's block from `content.json` (`label`, `question`, `look_for`, `anchors`) and answer its question for
this conversation only.

### The 0–5 scale (the same for every skill)

| Score | Meaning |
|---|---|
| 0 | **Absent.** Never came up. No language, no inference. |
| 1 | **Trace.** A passing mention, no named person or number, no commitment. |
| 2 | **Partial.** Discussed but generic: no name for the economic buyer, no number for metrics, no ranking for criteria. |
| 3 | **Substantive.** At least one hard anchor (a name, a number, a criterion, a date) plus some confirmation from the buyer. |
| 4 | **Strong.** Several confirmed specifics from more than one angle. |
| 5 | **Nailed.** Fully qualified by the framework's own definition. |

Be conservative. Score 3 only when the evidence really shows substantive coverage, not because the topic came up.
Every point of drift roughly doubles in the combined deal score and carries into the rep's profile.
Use the skill's `anchors` (examples of a 1, a 3 and a 5) to calibrate.

### Evidence rule

Every score needs a `reason`: two or three sentences that quote or closely paraphrase the conversation. A reason that
could have been written without reading the transcript is a failed answer. Never invent anything that was not said.

### Coaching note (calls only)

`note` is one next step for the rep on this skill, specific to this deal: what to ask or do on the next call,
naming the person or number involved where possible. It is quoted on the rep's coaching cards, so write it to the rep
("Ask Dana who signs off..."), not about them.

## Output: one file per call

Path: `workspace/scores/calls/<call_id>.json` (use the `call_id` from the queue exactly).

```json
{
  "deal_id": "D-1042",
  "call_date": "2026-03-14",
  "scores": {
    "metrics":           { "score": 2, "reason": "…", "note": "…" },
    "economic_buyer":    { "score": 1, "reason": "…", "note": "…" },
    "decision_criteria": { "score": 3, "reason": "…", "note": "…" },
    "decision_process":  { "score": 2, "reason": "…", "note": "…" },
    "identify_pain":     { "score": 4, "reason": "…", "note": "…" },
    "champion":          { "score": 2, "reason": "…", "note": "…" },
    "rapport":           { "score": 4, "reason": "…", "note": "…" },
    "upfront_contract":  { "score": 1, "reason": "…", "note": "…" },
    "pain":              { "score": 3, "reason": "…", "note": "…" },
    "budget":            { "score": 0, "reason": "…", "note": "…" },
    "decision":          { "score": 2, "reason": "…", "note": "…" },
    "fulfillment":       { "score": 3, "reason": "…", "note": "…" },
    "postsell":          { "score": 2, "reason": "…", "note": "…" }
  }
}
```

- All 13 keys, spelled exactly as above.
- `score` is a bare whole number 0–5. Never `2.5`, never `"2.0"`.
- `call_date` is `YYYY-MM-DD`, taken from the transcript (its header or the first timestamp). If the transcript has
  no date, use a date in the file name; if there is none either, stop and ask the user rather than guess.
- Two calls on the same deal can never share a date. If they genuinely happened on the same day, tell the user;
  the master table's key is deal ID + call date.
- Missing evidence is a `0` with a reason that says so, never a blank.

## Output: one file per email thread

Path: `workspace/scores/emails/<deal_id>.json` (the deal ID with anything other than letters, digits, `_`, `.`
and `-` replaced by `_`, matching the thread file's name).

```json
{ "deal_id": "D-1042", "scores": { "metrics": { "score": 1, "reason": "…" }, "…": "all 13 keys" } }
```

Same scale and evidence rule; no coaching note needed.

## Dispatching to subagents

For more than about 15 items, split the queue into batches of about 10 and run them in parallel, one subagent per
batch. Give each subagent this file's path, the content file's path, its list of queue items, and the output folder.
Use a fast, low-cost model for this volume work when one is available. When they finish, run `assemble.rb`: it
lists any file that broke a rule in `workspace/score_errors.txt`. Re-score only those.

---
name: rep-coaching
description: Builds a self-contained rep coaching web app from a sales team's recorded call transcripts, CRM deal export and email threads, guiding the user through each export. Scores every call and email thread on the 13 MEDDIC and Sandler skills (0–5, with a reason and a coaching note), combines them per deal, learns which skills win deals from closed deals, and gives every rep a personal top three to practise with quotes from their own calls. Use when someone asks to coach sales reps from call transcripts, score calls on MEDDIC or Sandler, build a rep coaching dashboard, find each rep's weak points, or turn call-recorder transcripts and a CRM export into coaching plans.
---

# Rep coaching from calls, emails and CRM data

Turns three exports (call transcripts, a CRM deal list, email threads) into one HTML file with six tabs: Start Here,
MEDDIC & Sandler 101, Engine Weights, Team Summary, Rep Coaching, and Build Your Own. Scripts in `scripts/` do the
mechanical work the same way every time; you (Claude) guide the user, and do all the reading and judging.

## How to work with the user

The exports are manual and most users have never done some of them. Your job is to make each one easy.
- **One step at a time.** Never ask for all three exports at once. Finish and confirm a step before starting the next.
- **Show, then confirm.** After every script, tell the user in plain words what it found (counts, names, problems)
  and get a yes before moving on. Use multiple-choice questions where your interface offers them.
- **Give the instructions, don't point at files.** When the user needs to export something, paste the matching
  section of `references/intake.md` into the conversation.
- **Never guess a link.** A transcript is attached to a deal only by its file name or by a match the user approved.
- **Plain English.** Define MEDDIC, Sandler, engine weight and combined score the first time you use them.
- **Rules:** run scripts as `ruby <skill-folder>/scripts/<name>.rb <run-folder>`; never hand-edit anything in
  `workspace/` or the finished page (fix inputs or score files and re-run); tell the user the finished page contains
  real call excerpts and is internal material.

## Step 0. Explain and set up

1. In three or four sentences, explain what the skill builds and what it needs: a CRM export of deals, the call
   transcripts, and (optionally) the deals' email threads. Say the first goal is **one deal with at least one call**
   (ideally its emails too), for a quick trial before the full run.
2. Ask whether they already have the exports or want help getting them.
3. Agree a **run folder** (default: a new folder next to their exports) and create it with an empty `config.json`
   containing the company name: `{"company": {"name": "…"}}`.

## Step 1. The CRM export

1. If they need it, paste `references/intake.md` section 1. Ask for the file path.
2. Run `ruby scripts/inspect.rb <file.csv>`. It prints the columns, a few rows, a suggested column mapping, whether
   any deal ID repeats, the stage values and the owners.
3. Show the user the suggested mapping as a short table and ask them to confirm or correct it. Then show the stage
   values and ask **which count as won and which as lost** (everything else is open). If deal IDs repeat, stop and
   help them re-export with one row per deal.
4. Write `deals_csv`, `columns`, `won_stages` and `lost_stages` into `config.json` (see `references/config.md`).

## Step 2. Call transcripts

1. If they need it, paste `references/intake.md` section 2. Ask for the transcripts folder and set `transcripts_dir`.
2. Run `ruby scripts/prepare.rb <run-folder>` and read its **link report** to the user: transcripts found, linked,
   not linked; deals with a call.
3. **If transcripts are not linked** (or the script stops because nothing links):
   - Look at `workspace/unmatched_transcripts.txt`. If the names do contain deal IDs in another format, set
     `deal_id_pattern` and re-run.
   - Otherwise run `ruby scripts/suggest_matches.rb <run-folder>`. It reads each unlinked transcript, finds the CRM
     account it mentions, and proposes a deal in `workspace/suggested_map.csv` with a confidence (high, medium, low,
     none). Show the user the list, low-confidence rows first, and ask them to confirm, correct or drop each row.
     Save the approved rows as `transcript_map.csv` in the run folder, set `transcript_map_csv`, and re-run
     `prepare.rb`. Never save a row the user did not approve.
4. Continue once at least one deal has a linked call.

## Step 3. Email threads (optional)

1. Ask whether they can export emails. If yes, paste `references/intake.md` section 3 and offer the two formats:
   a CSV (run `ruby scripts/inspect.rb <emails.csv> --emails`, confirm the mapping, set `emails_csv` and
   `email_columns`) or one `.txt` per deal (set `emails_dir`). If no, say the app works without them.
2. Re-run `prepare.rb` and read out the new line: deals with a call, with emails, with both.

## Step 4. Tailor the wording

Ask one question: what does the company sell, and to whom? Copy `assets/content.json` into the run folder as
`content.json`, set `content` in the config, and rewrite the `plain`, `look_for`, `anchors`, `questions` and
`weight_reason` fields in the company's terms. Keep every `key` and `label`. Show two or three rewritten lines and
ask if the tone is right. Skip if the user prefers the generic wording.

## Step 5. Trial run on one deal

1. Pick a deal from the link report's "good trial deals" (ideally one with a call and emails) and confirm it with
   the user.
2. `ruby scripts/prepare.rb <run-folder> --only <deal-id>` queues just that deal.
3. Score its calls and email thread yourself, following `references/scoring.md` exactly.
4. Run `assemble.rb`, `build_app.rb` and `check.rb` (below). Open or describe the page: the rep, their scores, one
   coaching card with its call excerpt. Say plainly that weights are equal for now because one deal cannot teach them.
5. Ask: do the rep name, account and scores look right? Fix any column, stage or linking problem now, before scoring
   everything.

## Step 6. Full run

1. `ruby scripts/prepare.rb <run-folder>` (no `--only`) queues everything not yet scored. Tell the user how many
   calls and threads that is and get a go-ahead for large runs.
2. Score the queues following `references/scoring.md`. For more than about 15 items, run parallel subagents in
   batches of about 10 (a fast, low-cost model if available), each given the scoring reference, the content file and
   its batch. Give the user a short progress update between batches.
3. `ruby scripts/assemble.rb <run-folder>`: validates every score, builds the master table (one CRM row per deal plus
   one row per call, keyed on deal ID + call date), combines call and email evidence per deal with
   `(1 − (1 − call/5)(1 − email/5)) × 10`, averages per rep with each deal counted once, and learns the engine
   weights from closed deals (or falls back to equal weights and says why). If it lists problems in
   `workspace/score_errors.txt`, re-score only those items and run it again.
4. `ruby scripts/build_app.rb <run-folder>` writes the page named in `output`.
5. `ruby scripts/check.rb <run-folder>` must print `ALL CHECKS PASSED` before you call the page ready. With Chrome or
   Chromium installed it opens the page headless and checks every tab; if not, say the browser check was skipped and
   ask the user to open the page once. If you can take screenshots, look at every tab.

## Step 7. Report and next steps

In plain words: how many deals, calls and email threads went in; whether the weights were learned or equal, and why;
the team's weakest skill; two or three reps whose top three stand out; where the file is and that it is internal.
Suggest next steps: add more closed deals so weights can be learned; re-run monthly (already-scored calls are skipped).

## If something goes wrong

| Symptom | What to do |
|---|---|
| `inspect.rb` says deal IDs repeat | The report has one row per product or contact. Re-export with one row per deal (intake §1). |
| `prepare.rb` stops: no call linked | Check `unmatched_transcripts.txt`; fix names, set `deal_id_pattern`, or use `suggest_matches.rb`. |
| A mapped column "is not in" the file | The header changed or has extra spaces; re-run `inspect.rb` and update `columns`. |
| `assemble.rb` lists score errors | Re-score only the files named in `workspace/score_errors.txt`. |
| Two calls on one deal share a date | Ask the user; the key is deal ID + call date, so each call needs its own date. |
| Weights say "equal" | Fewer than 40 closed, scored deals (10 won, 10 lost). Score more closed deals or accept equal weights. |
| `check.rb` fails in the browser | Read the failing line; fix the cause and rebuild. Never ship a page that fails. |

## Try it without any data
`examples/bluewick/` (in the repository root) is a fully scored run for a fictional fleet-telematics company. From
this skill's folder: `ruby scripts/assemble.rb ../examples/bluewick`, then `build_app.rb` and `check.rb` the same way.

## Files
- `scripts/`: `inspect.rb` (look inside a CSV), `prepare.rb` (link and queue), `suggest_matches.rb` (propose
  transcript-to-deal matches), `assemble.rb`, `build_app.rb`, `check.rb`, and `lib.rb`.
- `references/intake.md`: export instructions to share with the user, with fixes for common problems.
- `references/scoring.md`: how to score a call or thread, and the exact output format.
- `references/config.md`: every `config.json` setting.
- `assets/`: generic B2B `content.json`, and the page template (`template.html`, `app.js`, `glossary.*`).

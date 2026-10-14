# config.json: the run folder's settings

Every run happens in a **run folder** (any folder the user picks). It holds `config.json`, receives a `workspace/`
folder with intermediate files, and gets the finished page. All paths in the config are relative to the run folder.

```json
{
  "company": { "name": "Acme", "sells": "payroll software to mid-size employers" },
  "footer": "Built from Acme calls, emails and CRM data.",

  "deals_csv": "exports/opportunities.csv",
  "columns": {
    "deal_id": "Opportunity ID",
    "account": "Account Name",
    "owner": "Opportunity Owner",
    "stage": "Stage",
    "close_date": "Close Date",
    "division": "Team"
  },
  "won_stages": ["Closed Won"],
  "lost_stages": ["Closed Lost"],

  "transcripts_dir": "transcripts",
  "deal_id_pattern": "\\A.*--(.+?)\\.txt\\z",
  "transcript_map_csv": "transcript_map.csv",

  "emails_csv": "exports/emails.csv",
  "email_columns": { "deal_id": "Opportunity ID", "date": "Date", "from": "From", "to": "To", "subject": "Subject", "body": "Body" },
  "emails_dir": "email_threads",

  "content": "content.json",
  "weights": "learn",
  "min_closed_deals": 40,
  "rep_aliases": { "Cal Reyes": "Callum Reyes" },
  "exclude_reps": ["Sales Ops Bot"],
  "output": "rep_coaching.html"
}
```

| Key | Required | What it does |
|---|---|---|
| `company.name` | yes | Shown in the title, the header and throughout the copy. |
| `company.sells` | no | One phrase about what the company sells; helps when tailoring `content.json`. |
| `footer` | no | Line at the bottom of every tab. |
| `deals_csv` | yes | The CRM export, one row per deal. Deal IDs must not repeat. |
| `columns` | yes | Maps each field to the CSV's header. `deal_id`, `owner` and `stage` are required; `account`, `close_date` and `division` are optional but improve the page. |
| `won_stages` / `lost_stages` | no | Which stage names count as won and lost. Everything else is open. Default `Closed Won` / `Closed Lost`. Add stages such as `Verbal Commit` to `won_stages` if the business counts them as won. |
| `transcripts_dir` | no | Folder of `.txt` transcripts, one per call, searched recursively. |
| `deal_id_pattern` | no | Regex whose first group pulls the deal ID out of a transcript's file name. The default takes the text after the last `--`, so `call--pricing-review--D-1042.txt` belongs to deal `D-1042`. |
| `transcript_map_csv` | no | A CSV with columns `file,deal_id` linking transcripts whose names carry no deal ID. `suggest_matches.rb` proposes one; save only the rows the user approved. A row here wins over the file name. |
| `emails_csv` / `email_columns` | no | Email export with one row per email; `deal_id` and `body` columns are required, the rest optional. |
| `emails_dir` | no | Alternative to `emails_csv`: a folder with one `.txt` per deal thread, the deal ID after the last `--` in the name (e.g. `emails--D-1042.txt`). `email_deal_id_pattern` changes how the ID is read. Both can be used together. |
| `allow_no_transcripts` | no | `true` lets a run continue with email threads only. Off by default, because coaching quotes come from calls. |
| `content` | no | Tailored copy of `assets/content.json`. Without it the generic B2B wording is used. |
| `weights` | no | `"learn"` (default) learns them from closed deals; `"equal"` gives every skill the same weight; or an object such as `{"economic_buyer": 35.8, …}` pins them. |
| `min_closed_deals` | no | Closed, scored deals needed before weights are learned (default 40, and at least 10 won and 10 lost). Below that, equal weights are used and the page says so. |
| `rep_aliases` | no | Maps alternate spellings of an owner to one name. |
| `exclude_reps` | no | Owners to leave out of the rep views (shared accounts, bots, managers). |
| `output` | no | File name of the finished page (default `rep_coaching.html`). |

## Getting a transcript onto the right deal

Two ways, and they can be mixed:
1. **The deal ID in the file name**, after the last `--`: `call-transcript--<topic>--<deal_id>.txt`.
2. **An approved map.** Run `suggest_matches.rb`; it reads each unlinked transcript, finds the CRM account it
   mentions and proposes a deal with a confidence. The user confirms or corrects each row, and the approved rows are
   saved as `transcript_map.csv`.

`prepare.rb` lists every transcript it could not link in `workspace/unmatched_transcripts.txt`, prints a link
report (deals with a call, with emails, with both, and good trial deals), and stops with a reason if no call links
to any deal.

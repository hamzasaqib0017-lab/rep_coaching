# Getting the data out: a guide to share with the user

The user has to export three things by hand. Most people have never done some of these exports, so walk them through
one at a time, in plain words, and confirm each one works before asking for the next. Paste the relevant section
below into the conversation rather than pointing at this file.

**The minimum to start:** one CRM export that includes at least one deal, plus at least one call transcript for
that deal. One email thread for the same deal is recommended. With just those, the trial run in step 5 works; the
full run needs the full exports.

---

## 1. The CRM export (deals)

**What it is:** a spreadsheet with one row per deal (also called an opportunity).

**What it must contain**

| Column | Why | Example header |
|---|---|---|
| Deal ID | Links calls and emails to the deal. Must be unique per row. | `Opportunity ID`, `Deal ID`, `Record ID` |
| Owner | The rep being coached. | `Opportunity Owner`, `Deal Owner` |
| Stage | Tells won, lost and open deals apart. | `Stage`, `Deal Stage` |
| Close date *(recommended)* | Shows the period the weights come from. | `Close Date` |
| Account name *(recommended)* | Shown on coaching cards; used to match unnamed transcripts. | `Account Name`, `Company` |
| Team or division *(optional)* | Shown under each rep's name. | `Team`, `Owner Division` |

**How to export it (most CRMs work the same way)**
1. Open your CRM's **Reports** (or list view of deals/opportunities).
2. Create a report or view of **all deals**, including closed ones (won and lost), ideally the last one to two years.
   Closed deals are what the skill learns from.
3. Add the columns above.
4. Use **Export** (sometimes under a "…" or settings menu) and choose **CSV**. If only Excel is offered, export
   that, open it, and **Save As → CSV (UTF-8)**.
5. Save it somewhere easy to find and tell Claude the path.

**If something goes wrong**
- *"Deal IDs repeat"*: the report has one row per product line or per contact. Change it to one row per deal.
- *No deal ID column*: most CRMs hide it by default. Look for "ID", "Record ID" or "Opportunity ID" in the column
  picker.
- *Only open deals*: remove the filter on stage or "is closed".

---

## 2. Call transcripts

**What it is:** one plain-text file (`.txt`) per recorded sales call.

**How to export them**
1. In your call recorder, open a call and look for **Download transcript**, **Export** or **Copy transcript**.
   Choose plain text. If only a document format is offered, export it and copy the text into a `.txt` file.
2. Put all the transcript files in **one folder** (subfolders are fine).
3. Start the file with the call date if the transcript itself does not show it, for example `Date: 2026-03-14`.

**Linking each call to its deal (pick one)**
- **Best:** put the deal ID at the end of the file name after two dashes:
  `call-transcript--pricing-review--D-1042.txt`. Some recorders let you set the export name; otherwise rename.
- **Easier for many files:** leave the names as they are. Claude runs `suggest_matches.rb`, which reads each
  transcript, finds which CRM account it mentions, and proposes a deal. The user approves the list; nothing is
  renamed.

**If something goes wrong**
- *Transcripts listed as unmatched*: the deal ID in the name does not match the CRM export exactly (check for extra
  spaces or a different ID format), or no account name was recognised. Use the suggestion step.
- *No date in the transcript*: add a `Date: YYYY-MM-DD` line at the top.

---

## 3. Email threads (optional, recommended)

**What it is:** the emails exchanged on each deal. They strengthen the scores; the app works without them.

**Two accepted formats (pick whichever is easier)**
- **A CSV export** with one row per email: deal ID, date, from, to, subject, body. Many CRMs export logged emails
  or "activities" this way from the same Reports area as step 1.
- **One text file per deal**: copy each deal's thread into a `.txt` file named with the deal ID after two dashes,
  for example `emails--D-1042.txt`, all in one folder. Easiest when there are only a few deals to start with.

**If something goes wrong**
- *Email export has no deal ID*: use the one-file-per-deal format instead, or skip emails for now.
- *Huge export*: that is fine; only emails on deals in the CRM export are used.

---

## 4. A first, linked set for the trial run

Before the full run, pick **one deal** that has a transcript (and ideally an email thread). Claude scores just that
deal, builds the app and shows it, so problems with columns or file names show up in a couple of minutes instead of
after scoring hundreds of calls.

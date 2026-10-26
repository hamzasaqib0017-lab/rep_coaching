# Calibrating scores with a human coach

Use this lightweight review before scoring a large dataset, and repeat it when the rubric or model changes. The
purpose is to align the scoring standard and catch unsupported judgments—not to certify that a model is objective.

## Review a small sample

1. Choose 5–10 calls across different reps and outcomes when available. Include at least one call with limited buyer
   engagement; do not select only unusually clear examples. Start with the one-deal trial if that is all the user has.
2. Score each call with the current rubric. Ask a manager or experienced coach to independently review the same calls
   and evidence, without first seeing the model's scores.
3. Compare per-skill scores and cited evidence. For every disagreement, decide whether it came from missing context,
   a rubric ambiguity, a weak/unsupported model reason, or a genuine difference in judgment.
4. Update the scoring guidance or company-specific anchors in `content.json` when the issue is a rubric ambiguity.
   Keep the change narrow and specific; do not tune wording merely to force agreement on one example.
5. Re-score the sample with the revised guidance. Proceed when the remaining differences are understood and the
   manager agrees the output is useful as a coaching prompt. Keep a short note of the sample, key disagreements, and
   rubric changes in the run folder for future refreshes.

## Interpret results carefully

- A score describes evidence in the sampled call or thread, not the rep's stable ability. A zero means no evidence
  was observed in that material; it does not prove the rep cannot perform the skill.
- Do not use this report alone for compensation, promotion, termination, or other high-impact personnel decisions.
  Managers should check context, opportunity, role, territory, customer type, and whether the rep had a fair chance
  to demonstrate the skill.
- Historical won/lost differences are unadjusted associations. They are not causal effects and should not be
  presented as predicted win-probability changes.
- Keep the reviewed material and resulting HTML report in approved internal storage. The scripts are local, but the
  AI provider processes the source content during scoring; follow its settings and the organization's policy.

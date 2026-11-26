# AN-ALQ Safety Checklist

Development-window guardrails captured for ongoing reference. Apply before any feature ships.

## 1. Real red-teaming before release

- Dedicated safety review with enough people to actually cover the surface area.
- Not a token pass by one or two folks while the team is small.
- Document what was tested, what broke, and what was fixed.

## 2. System prompts err toward restriction on ambiguous terms

- Age-ambiguous or context-sensitive language should default to the safer interpretation.
- Never instruct the model to assume good intent when the input is ambiguous.
- Prompt text is part of the product surface — treat it like code, version it, review it.

## 3. Verify source material and consent before processing

- If the tool touches images or data of real people, confirm the source is legitimate and the user has rights to it.
- No silent processing of uploaded content that could belong to someone else.

## 4. Independent third-party safety evaluation before launch

- Outside eyes catch what the team building the thing cannot see.
- Budget for it even when it feels premature.

## 5. Monitor and log bypass attempts

- Track when users probe filters or find workarounds.
- Every bypass attempt is a patch opportunity — log it, review it, close it.
- The model should never coach a user on how to defeat its own safeguards.

## 6. X Posts and User objects leave only with the redistribution guardrails

Any export or download of X Posts or User objects must ship with these guardrails, from the [X Developer Policy, Content redistribution](https://docs.x.com/developer-terms/policy):

- Count a daily cap of 50,000 public Posts Objects and/or User Objects for each person who uses the service. The policy counts that allowance per person who uses the service, not as a shared pool.
- Allow that object download only by non-automated means, such as a person downloading a spreadsheet or a PDF.
- Before anyone receives such a download, require them to agree to the X Terms of Service, Privacy Policy, Developer Agreement, and Developer Policy.
- Do not distribute more than 1,500,000 Post IDs to any entity, including multiple individuals associated with a single entity, within any 30 day period, unless X has given written permission. Keep a counter for that window.
- If X Content goes to third parties, including a downloadable dataset or an API, distribute only Post IDs, Direct Message IDs, and/or User IDs, except for the non-automated public object allowance above.

## Core principle

Safety is a baseline, not a differentiator. The moment it becomes a competitive liability instead of a floor, the product has already lost the argument — before any external review happens.

## Remediation test

After any fix, re-test with a clean account. If the original failure mode still works, the remediation did not remediate.

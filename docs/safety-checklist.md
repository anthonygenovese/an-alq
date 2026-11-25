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

## Core principle

Safety is a baseline, not a differentiator. The moment it becomes a competitive liability instead of a floor, the product has already lost the argument — before any external review happens.

## Remediation test

After any fix, re-test with a clean account. If the original failure mode still works, the remediation did not remediate.

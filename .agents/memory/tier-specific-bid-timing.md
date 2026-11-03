---
name: Unified dispute countdown
description: Product rule for one 60-second countdown that starts with the dispute and resets on every bid.
---

Use a single 60-second countdown for the entire dispute. Start it when the dispute starts and reset it to 60 seconds after every accepted bid. If it expires without any bids, close the dispute without a winner; if bids were placed, close it after 60 seconds pass with no new bid. Do not switch to a separate timer after the first bid or vary this countdown by prize tier.

**Why:** On 2026-11-03, the user clarified that the initial no-bid period and the post-bid period use the same timer, reset by each new bid.

**How to apply:** Keep one consistent 60-second deadline across the dispute lifecycle. A bid resets that deadline; no bid before it expires ends the dispute.

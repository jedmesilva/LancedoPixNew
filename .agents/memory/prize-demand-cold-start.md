---
name: Prize demand cold start
description: Avoid deadlocking prize releases when historical activity does not yet exist.
---

When there is not enough comparable real-user activity to produce a reliable demand forecast, do not treat zero forecast demand as proof that no one will bid. Permit eligible disputes using the existing cash-reserve gate alone; once sufficient real history exists, enforce both the cash and demand gates. Never manufacture bids or count simulated/test activity as real demand.

**Why:** The user pointed out that requiring historical demand before any dispute can launch creates a circular deadlock: the system needs disputes to generate real history.

**How to apply:** Keep the configured cash coverage as the bootstrap safety limit, preserve unpredictable selection among cash-eligible tiers, and resume forecast-based demand filtering when the minimum real-history criteria are met.

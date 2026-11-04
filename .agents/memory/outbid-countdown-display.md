---
name: Outbid countdown display
description: Meaning and formatting of the remaining time shown on superseded bids.
---

For each superseded bid, show how much time remained until its countdown reached zero at the moment the next bid overtook it. Use the API's remaining-seconds value, display up to 59 seconds as `59s`, 60 seconds through 59:59 as `MM:SS`, and one hour or more as `HH:MM:SS`. Use the same compact format for live-dispute and next-dispute countdowns.

**Why:** The user clarified that this value must represent time left at the moment of being outbid, not elapsed time since the countdown began, and requested compact formats for longer durations.

**How to apply:** Derive historical outbid time from the superseded bid's persisted expiry and the next bid's recorded creation time; do not calculate it from displayed bid age. Format the live dispute countdown with that same display rule, while keeping its accessible label descriptive.

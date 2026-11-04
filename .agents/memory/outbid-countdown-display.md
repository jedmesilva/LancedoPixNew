---
name: Auction countdown display
description: Meaning, formats, and urgency colors for auction countdowns.
---

For each superseded bid, show how much time remained until its countdown reached zero at the moment the next bid overtook it. Use the API's remaining-seconds value, display up to 59 seconds as `59s`, 60 seconds through 59:59 as `MM:SS`, and one hour or more as `HH:MM:SS`. Use the same compact format for live-dispute and next-dispute countdowns.

During the live dispute's final 10 seconds, keep the timer red when the current user is not leading and show it green when the current user leads.

**Why:** The user clarified the outbid-time semantics and compact formats, and wants the final countdown color to indicate whether the current user is leading.

**How to apply:** Derive historical outbid time from the superseded bid's persisted expiry and the next bid's recorded creation time; do not calculate it from displayed bid age. Use shared formatting for live and next-dispute timers, and apply red/green urgency to the live timer's text and ring.

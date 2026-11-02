---
name: Recent-bid visual hierarchy
description: Visual treatment for the live hero, victory card, and recent-bids list.
---

Keep the current leader and circular timer in the hero card. The recent-bids list contains only superseded bids; keep its rows unfilled and reduce their size and opacity by rank. Show a related result card after a win, with the prize, bonus, winning bid, and winner.

Keep the prototype icon beside the “Lance atual” label. Do not add visible caption text such as “restantes” beneath the circular timer; keep timer context screen-reader-only.

**Why:** The prototype separates the active bid from bid history, and the user asked for exact recency values rather than estimates such as “há poucos segundos.” The user also corrected the extra timer caption and requested the missing label icon.

**How to apply:** Do not repeat the current leader in the history list. Use precise elapsed-time labels and make older rows visually subordinate without adding a colored background. Keep the icon in the label wrapper while updating its text dynamically; do not add visible text below the timer ring.

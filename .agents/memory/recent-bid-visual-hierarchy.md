---
name: Recent-bid visual hierarchy
description: Visual treatment for the live hero, victory card, and recent-bids list.
---

Keep the current leader and circular timer in the hero card. The recent-bids list contains only superseded bids; keep its rows unfilled and reduce their size and opacity by rank. Show a related result card after a win, with the prize, bonus, winning bid, and winner.

When an active dispute has no leader yet, show the minimum valid opening bid as the hero value under “Lance atual,” rather than R$ 0,00. Keep the action button explicit that this is the first bid; this is presentation-only.

For user-facing bid copy, use direct factual wording such as “Lance atual”; avoid ranking language and metaphors such as “líder” or “topo.”

Keep the prototype icon beside the “Lance atual” label. Do not add visible caption text such as “restantes” beneath the circular timer; keep timer context screen-reader-only.

Use the primary text color for the current bidder name and ordinary timer digits, not the green accent. Reserve green for status accents and red for timer urgency.

Animate the current-bid highlight whenever a new live bid arrives, whether the leader is the signed-in user or another participant. Do not replay it on initial load, timer updates, or round transitions.

**Why:** The prototype separates the active bid from bid history, and the user asked for exact recency values rather than estimates such as “há poucos segundos.” The user also corrected the extra timer caption, requested the missing label icon, rejected green on the name and timer, asked for the bid effect on bids from everyone, preferred the minimum opening bid as the current bid instead of zero, and explicitly rejected user-facing ranking language.

**How to apply:** Do not repeat the current leader in the history list. Use precise elapsed-time labels and make older rows visually subordinate without adding a colored background. Keep the icon in the label wrapper while updating its text dynamically; do not add visible text below the timer ring. Keep the bidder and timer dark except for the timer's urgent red state. Emit the highlight only when a same-round live bid increases the leader value; local bid success already emits it directly. In the no-leader state, derive the hero display from the minimum bid without changing persisted or accepted bid amounts.

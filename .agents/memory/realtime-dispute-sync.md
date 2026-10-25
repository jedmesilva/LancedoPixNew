---
name: Realtime dispute synchronization
description: Product and privacy rules for keeping the live dispute consistent across users, sections, and sessions.
---

Every view of the active dispute should converge on the same round, bids, leader, status, and timer deadline. WebSocket messages are invalidation notices only; account-specific balances, sessions, and bid history stay in authenticated API responses. Timers derive from absolute server deadlines.

**Why:** The user asked for all sections and users to see the same live dispute, bids, times, and statuses.

**How to apply:** Notify clients after committed shared-state changes and dispute-engine transitions. Clients should refresh their authenticated snapshot after notifications or reconnects, and should never receive another user's private state through the broadcast channel.

---
name: Realtime dispute synchronization
description: Product and privacy rules for keeping the live dispute consistent across users, sections, and sessions.
---

Every view of the active dispute should converge on the same round, bids, leader, status, and timer deadline. WebSocket messages are invalidation notices only; account-specific balances, sessions, and bid history stay in authenticated API responses. Timers derive from absolute server deadlines.

The deadline returned to clients must be the exact persisted bid expiry checked by the dispute engine; do not recompute it from the bid creation timestamp and configured duration.

Keep a low-frequency, no-store API snapshot poll running even while the WebSocket is open. The socket provides immediate updates; the poll recovers from missed notifications.

**Why:** The user asked for all sections and users to see the same live dispute, bids, times, and statuses.

**How to apply:** Notify clients after committed shared-state changes and dispute-engine transitions. Clients should refresh their authenticated snapshot after notifications or reconnects, retain a roughly five-second no-store poll while connected, and never receive another user's private state through the broadcast channel. Keep the API deadline and engine expiry on the same persisted timestamp.

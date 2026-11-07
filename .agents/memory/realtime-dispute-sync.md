---
name: Realtime dispute synchronization
description: Product and privacy rules for keeping the live dispute consistent across users, sections, and sessions.
---

Every view of the active dispute should converge on the same round, bids, leader, status, and timer deadline. WebSocket messages are invalidation notices only; account-specific balances, sessions, and bid history stay in authenticated API responses. Timers derive from absolute server deadlines.

The API and dispute engine must use the same absolute deadline. Before the first bid, derive it from the persisted dispute start plus the shared 60-second countdown; after a bid, use that bid's persisted expiry.

Do not poll while the WebSocket is healthy. Keep the no-store API poll only as a fallback while disconnected; reconnect with backoff and refresh the full snapshot when the socket opens. For live event lists, bypass the browser HTTP cache on both invalidation refetches and fallback polling, and send a no-store response header.

**Why:** The user asked for all sections and users to see the same live dispute, bids, times, and statuses. A WebSocket invalidation can still display stale event data if the subsequent API fetch uses the browser cache.

**How to apply:** Notify clients after committed shared-state changes and dispute-engine transitions. Clients should refresh their authenticated snapshot after notifications or reconnects, stop fallback polling when the socket opens, and never receive another user's private state through the broadcast channel. Derive initial no-bid timing from the persisted start time and keep post-bid timing tied to the persisted leader-bid expiry.

---
name: Lance do Pix database source of truth
description: Product requirement that test and real domain data live in the database and the client only renders persisted state.
---

All domain data must be persisted in the database regardless of whether it is for testing or real activity. The client must only consume and render database-backed API state; it must not invent users, balances, bids, disputes, or sample transaction activity. Server-side engines may create dispute rows, and a test bot may place bids, provided those records and wallet movements are persisted. The bot should reuse one existing database user and wallet rather than creating users repeatedly. Avoid static numeric transaction examples presented as activity. Do not delete existing database records without the user's explicit approval.

Do not assume test-mode data is forbidden or that real authentication/payment-provider integrations are requested. Distinguish records persisted in the database from externally settled money, and describe simulated payment credit accurately.

**Why:** On 2026-11-02, the user clarified that test and real activity are both acceptable, but users, credits, bids, and disputes must be database records, with dispute generation performed by the server-side engine.

**How to apply:** Keep domain behavior in the server and persist state changes before broadcasting them. Reuse a stable database-backed bot identity, have the client fetch live state, remove client-side sample activity, and ask before deleting historical test data.

---
name: Lance do Pix database source of truth
description: Product requirement that test and real domain data live in the database and the client only renders persisted state.
---

All domain data must be persisted in the database, and the client must only render API state; it must not invent users, balances, bids, disputes, or sample activity. Disputes, bids, and user activity must be real; do not run automated rival/test bidding or create artificial balances. The only permitted simulations are credit-top-up payment status (clearly labeled and available to all accounts, with no fake Pix QR) and a test account standing in for Google sign-in until that integration exists. Do not delete existing database records without the user's explicit approval.

Prize tiers are database-managed records only. Do not hard-code their values or generate, seed, activate, deactivate, or synchronize tier rows from application code. Runtime code reads the active tiers from the database; update the stored rows directly or through an explicitly requested management flow. Each dispute keeps the prize and increment copied when it was created; an updated tier increment applies to future disputes, not an ongoing one unless the user explicitly requests that change.

Distinguish persisted app activity from externally settled money, and describe simulated credit-top-up outcomes accurately. Google sign-in may use a clearly identified test account until the provider is integrated.

**Why:** On 2026-11-02, the user required users, credits, bids, and disputes to be database-backed and prize tiers to be database-managed. On 2026-11-03, the user clarified that the only allowed simulation is credit-top-up payment status for all accounts; Google may use a test account until integrated, while disputes, bids, and other users must be real.

**How to apply:** Keep domain behavior in the server and persist state changes before broadcasting them. Reuse a stable database-backed bot identity, have the client fetch live state, remove client-side sample activity, and ask before deleting historical test data. Load active prize tiers only from the database and fail clearly when none are configured.

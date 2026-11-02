---
name: Lance do Pix real activity
description: User requirement to keep displayed participants, balances, and bids grounded in real database activity.
---

Do not auto-create sample accounts, test-bot participants, artificial wallet credits, automated bids, or numeric transaction examples in user-facing flows. Participants, balances, and bids shown must come from persistent database records. If the database lacks valid records, show an empty state or require explicit provisioning rather than inventing data. Do not delete existing database records without the user's explicit approval.

Keep real authentication-provider and payment-provider integrations out of scope until explicitly requested. A database record created by a simulated payment is still not real payment-backed credit.

**Why:** On 2026-11-02, the user said this app must not load example data or content and that users, credits, and bids must be real database data.

**How to apply:** Remove runtime test-account/bot generation and fake balance/bid paths from the live product flow. Use verified payment settlement or an explicitly authorized real ledger process for credits; ask before choosing a payment provider or deleting historical test data.

---
name: Dispute cash accounting
description: Product rules for funding dispute prizes and bonuses from wallet credits and bids.
---

Wallet credits cannot be withdrawn. A dispute's prize is a platform debt intended to be covered by that dispute's bids. Attribute bid revenue to its own dispute; after the prize debt is covered, up to 10% of that dispute's free balance may fund its bonus. Never pool revenue across disputes. Treating unspent wallet credits as immobilized cash is still tentative and must be confirmed.

The bonus may be released while a dispute is active. Its engine should adapt incentives based on elapsed time and bid activity, including bid frequency, size, and periods without bids, to encourage participation without exhausting platform revenue. It must remain within the per-dispute bonus cap; do not treat this as an uncapped fixed reward on each bid. Exact thresholds and policy remain to be defined.

**Why:** The user specified these accounting boundaries while planning the dispute and bonus engines.

**How to apply:** Keep cash receipts, wallet credits, bid revenue, prize obligations, and bonus allocations distinct in the ledger. Scope bonus calculations to one dispute, evaluate on new bids and elapsed-time events, and define explainable thresholds and safeguards before implementation.

---
name: Dispute cash accounting
description: Product rules for funding dispute prizes and bonuses from wallet credits and bids.
---

Wallet credits cannot be withdrawn. A dispute's prize is a platform debt intended to be covered by that dispute's bids. Attribute bid revenue to its own dispute; after the prize debt is covered, up to 10% of that dispute's free balance may fund its bonus. Never pool revenue across disputes. Treating unspent wallet credits as immobilized cash is still tentative and must be confirmed.

**Why:** The user specified these accounting boundaries while planning the dispute and bonus engines.

**How to apply:** Keep cash receipts, wallet credits, bid revenue, prize obligations, and bonus allocations distinct in the ledger. Scope bonus calculations to one dispute and confirm the treatment of unspent wallet balances and the bonus release event before implementation.

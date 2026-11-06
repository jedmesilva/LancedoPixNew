---
name: Automation cap semantics
description: How zero-valued automatic bidding caps should behave.
---

For automated bidding, zero in the per-bid amount, per-dispute amount, daily amount, or per-dispute bid-count cap means no cap for that individual setting. Skip zero-valued monetary caps when checking their order. The selected account's actual wallet balance remains the absolute spending ceiling; reject a bid when the wallet cannot fund it.

**Why:** The user explicitly clarified that zero should follow the common “unlimited” convention rather than blocking activation.

**How to apply:** Treat zero as unlimited in configuration validation and bid execution, but always check and debit the selected account's real available wallet balance.

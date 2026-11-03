---
name: Tier-specific bid timing
description: Product preference for a per-tier bidding countdown instead of a global duration cycle.
---

The user favors configuring the bidding countdown duration per prize tier. A newly created dispute should inherit the duration configured for its selected tier, while its stored duration remains fixed for that dispute.

**Why:** The user suggested each prize tier have its own bid duration rather than sharing the current duration sequence.

**How to apply:** Keep the setting in internal tier configuration, copy it into the dispute's duration snapshot at creation, and do not expose other tier settings to end users.

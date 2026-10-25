---
name: Lance do Pix demo scope
description: Product boundary for the prototype's login, wallet, and Pix flows.
---

Keep the account, wallet, and Pix flows as demonstrations. Do not connect real authentication or process real payments unless the user explicitly requests it.

**Why:** The user chose to keep the prototype's demo profile, and the current product flow is a simulation.

**How to apply:** Keep session state isolated for the demo and label or treat Pix outcomes as simulated; ask before replacing those flows with real services.

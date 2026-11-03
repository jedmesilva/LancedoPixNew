---
name: Operator-only prize operations
description: Strict confidentiality boundary for prize-tier configuration, eligibility, and future queue data.
---

Prize-tier values and ranges, eligibility calculations, forecasts, and the future generation queue are internal platform-operations data. End users must not be able to retrieve or see them. The value of the currently active dispute's prize is intentionally public to everyone. Any future operator tooling must enforce authorization on the server; hiding information only in the interface is not sufficient.

**Why:** The user explicitly said this system is for platform operations and that users must never have access to its queue or prize-tier information, then clarified that everyone can see the prize for the active dispute.

**How to apply:** Keep tier catalogs, eligibility details, forecasts, and future queue data out of user-facing API responses and client bundles. Continue showing the active dispute's prize publicly. Add a server-enforced operator role before exposing internal details in an operator interface.

---
name: Operator-only prize operations
description: Strict confidentiality boundary for prize-tier configuration, eligibility, and future queue data.
---

Prize-tier values and ranges, eligibility calculations, forecasts, and the future generation queue are internal platform-operations data. End users must not be able to retrieve or see them. Any future operator tooling must enforce authorization on the server; hiding information only in the interface is not sufficient.

**Why:** The user explicitly said this system is for platform operations and that users must never have access to its queue or prize-tier information.

**How to apply:** Keep these fields out of user-facing API responses and client bundles. Add a server-enforced operator role before exposing them in an internal interface.

---
name: Operator-only prize operations
description: Strict confidentiality boundary for prize-tier configuration, eligibility, and future queue data.
---

Prize-tier values and ranges, eligibility calculations, forecasts, and the future generation queue are internal platform-operations data. End users must not be able to retrieve or see them in the UI or public API. The public interface must not mention tiers, prize ranges, internal eligibility, or business rules; when there is no active dispute, show a neutral no-active-dispute state and return no placeholder tier-derived values. The value of the currently active dispute's prize is intentionally public to everyone. Any future operator tooling must enforce authorization on the server; hiding information only in the interface is not sufficient.

**Why:** The user explicitly said this system is for platform operations and that users must never have access to its queue or prize-tier information, then clarified that public UI copy must not reveal tiers or eligibility rules while the active prize remains public.

**How to apply:** Keep tier catalogs, eligibility details, forecasts, internal blocked statuses, and future queue data out of user-facing API responses and client bundles. Map an internal blocked state to a neutral no-active-dispute response and sanitize placeholder values. Use neutral copy for the unavailable state. Continue showing the active dispute's prize publicly. Add a server-enforced operator role before exposing internal details in an operator interface.

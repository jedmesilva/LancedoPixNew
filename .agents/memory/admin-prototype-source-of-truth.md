---
name: Admin prototype is authoritative
description: The user's uploaded Lance do Pix admin prototype is the required interface and product reference.
---

The administrative interface must follow the HTML prototype the user supplied; do not substitute a different admin design. Replace its local demo state with real platform data. If a displayed metric is not yet measured, implement real instrumentation instead of hiding it or inventing a value.

**Why:** The user explicitly rejected alternate administrative interfaces and corrected the assumption that unmeasured metrics should simply be displayed as unavailable.

**How to apply:** Preserve the prototype's tabs, hierarchy, labels, controls, and visual system. Add privacy-conscious instrumentation or real API-backed behavior for every metric and action that the prototype presents.

---
name: Admin access key
description: The operator signs into the admin panel with the raw key configured in Replit Secrets.
---

Validate the configured operator key directly; do not require the user to generate a hash. Continue accepting the existing `ADMIN_ACCESS_KEY_HASH` secret name as the raw key for compatibility, and prefer `ADMIN_ACCESS_KEY` for new configuration. Never expose the secret in logs or chat.

**Why:** The user explicitly said the configured variable itself is the valid access key and the panel should validate that key directly.

**How to apply:** Read the key only on the server, compare it securely with the submitted key, and tell operators to enter the same raw value stored in Replit Secrets.

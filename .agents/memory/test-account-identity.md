---
name: Test account identity
description: Naming and email conventions for generated test accounts.
---

Use a recognizable test account name (the user suggested “João Teste”) and a unique generated email under the reserved `.invalid` domain. Show the generated email in the account UI. Do not use a real deliverable email address for test accounts.

**Why:** The user expects test accounts to have useful names and emails in the persisted record, while a reserved domain prevents accidental delivery and a unique suffix avoids collisions between accounts.

**How to apply:** Follow this convention in test-account creation routes and their account/profile display; do not change ordinary sign-up behavior.

---
name: Drizzle schema push compatibility
description: Compatibility constraints encountered while pushing this project's PostgreSQL schemas with Drizzle.
---

Use a PostgreSQL `bytea` custom type instead of importing a `bytea` helper from `drizzle-orm/pg-core`. `drizzle-zod` excludes `generatedAlwaysAsIdentity()` columns from insert schemas, so do not pass those column names to `.omit()`. For bigint defaults, use SQL literal defaults such as `sql\`0\`` rather than JavaScript bigint literals.

**Why:** The current schema-push toolchain failed at runtime with an unavailable `bytea` export, rejected omitted identity keys, and could not JSON-serialize bigint defaults.

**How to apply:** When adding or changing PostgreSQL schemas, preserve these patterns and run `pnpm --filter @workspace/db run push` against development after typechecking.

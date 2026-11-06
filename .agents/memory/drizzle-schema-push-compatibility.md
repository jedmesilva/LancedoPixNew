---
name: Drizzle schema push compatibility
description: Compatibility constraints encountered while pushing this project's PostgreSQL schemas with Drizzle.
---

Use a PostgreSQL `bytea` custom type instead of importing a `bytea` helper from `drizzle-orm/pg-core`. `drizzle-zod` excludes `generatedAlwaysAsIdentity()` columns from insert schemas, so do not pass those column names to `.omit()`. For bigint defaults, use SQL literal defaults such as `sql\`0\`` rather than JavaScript bigint literals.

**Why:** The current schema-push toolchain failed at runtime with an unavailable `bytea` export, rejected omitted identity keys, and could not JSON-serialize bigint defaults.

**How to apply:** When adding or changing PostgreSQL schemas, preserve these patterns and run `pnpm --filter @workspace/db run push` against development after typechecking.

## Push-plan caution

Do not rely on a config-level `tablesFilter` as a safety boundary for schema pushes here. A filtered strict preview unexpectedly proposed creating the other app tables and dropping existing identity sequences, while the unfiltered strict preview matched the read-only database inventory and showed only the intended `automation_config` changes. Inspect the entire unfiltered plan before applying any push; stop if it contains unrelated DDL.

**Why:** The filtered plan was broader and less accurate than the full schema comparison, so applying it could change unrelated tables or sequences.

**How to apply:** Use an unfiltered strict/verbose preview, review every statement, and never use `--force` to bypass unexpected changes.

**Non-interactive preview:** `drizzle-kit push --strict` prints its plan, then fails because the shell has no TTY for its confirmation prompt. Treat that output as a read-only preview; only run the normal verbose push after confirming the database target, reviewing the full plan, and getting any needed authorization.

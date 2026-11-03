---
name: Orval Node runtime
description: Runtime compatibility requirement for generating this workspace's API client and Zod schemas.
---

Orval v8's Zod generation uses `Map.groupBy`; Node.js 20 does not provide it, so API code generation fails after the React client output has already been generated. Run code generation with Node.js 22 or newer.

**Why:** The workspace's API generation failed under Node.js 20 with `Map.groupBy is not a function`; using Node.js 22 resolved it.

**How to apply:** Check the active Node runtime before running `pnpm --filter @workspace/api-spec run codegen`; use Node.js 22+.

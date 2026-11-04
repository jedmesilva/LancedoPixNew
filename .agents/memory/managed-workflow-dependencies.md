---
name: Managed workflow dependency synchronization
description: What to do when managed workspace processes are stale or cannot resolve declared packages.
---

When a frontend or API workflow cannot resolve a package already declared in its workspace manifest and lockfile, sync that workspace's dependencies before restarting the managed workflow.

**Why:** In this workspace, frontend and API packages were declared but their local links were absent; the preview failed to load and the running API process still served an obsolete route until rebuilt.

**How to apply:** Check the workspace manifest and lockfile first. If the dependency is declared but not installed, run a filtered frozen-lockfile install for that workspace, then restart only the affected workflow. Do not change app code or package versions to compensate for a missing installation.

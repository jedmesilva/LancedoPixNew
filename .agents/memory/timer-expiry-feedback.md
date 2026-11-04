---
name: Timer expiry feedback
description: User-facing behavior when dispute countdowns reach zero.
---

When a live dispute reaches zero, replace the digits with an indeterminate circular indicator and a visible adjacent “Confirmando resultado…” status until the server confirms the ended phase. When the next-dispute countdown reaches zero, keep the prior result visible and show the same indicator with “Iniciando próxima disputa…” until the new live phase is confirmed. Do not use a page skeleton for these data-state transitions.

**Why:** The user said a static zero feels like the app froze and distinguished data-state transitions from initial page loading.

**How to apply:** Show the moving indicator only while waiting for server confirmation; use the same ring geometry as the countdown and keep status copy outside the circle so it remains legible.

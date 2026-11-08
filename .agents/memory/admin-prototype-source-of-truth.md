---
name: Admin prototype is authoritative
description: The user's uploaded Lance do Pix admin prototype is the required interface and product reference.
---

For the administrative reorganization, the user's approved Mockup A (ActionCenter) is the source of truth for layout and visual design. Keep existing administrative flows, but connect them to real platform data and actions; do not substitute a different design. The automation page is an operations console: monitor active and recent disputes, all bids, bot bids, winners, and bot outcomes while keeping bot controls and configuration on that same page.

The user's complete administrative requirements document is the target product scope, not just a visual reference. All listed modules should ultimately be implemented with real data, permissions, and working server-side behavior rather than inert UI.

For an operator-initiated dispute closure, refund the credits charged for every bid in that dispute; do not award the prize.

**Why:** The user explicitly directed that Mockup A be implemented after finding the existing administrative UI did not match the selected redesign, said operators should not have to switch pages to monitor and control automation, and stated that the full documented admin scope must be implemented.

**How to apply:** Follow Mockup A's hierarchy, spacing, labels, controls, and visual system. Replace sample values and inert actions with existing API-backed behavior; show unsupported data as unavailable and keep unsupported critical controls disabled. Keep live monitoring, results, bot bids, and automation controls together on the automation route.

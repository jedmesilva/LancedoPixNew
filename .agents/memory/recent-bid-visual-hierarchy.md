---
name: Recent-bid visual hierarchy
description: Visual treatment for the current leader in the recent-bids list.
---

Keep the first recent-bid row unfilled. Make its typography and status icon substantially larger than lower ranks. Reduce ranks two through five in clear, regular steps; keep all recent bids smaller than the main current-bid amount. Use a Lucide crown while the dispute is active; after it ends, switch to a Lucide trophy and label the result “Ganhou o prêmio.” Center the icon vertically beside the leader's name.

**Why:** The user explicitly rejected a colored background on the first position.

**How to apply:** Preserve the existing page surface and make the hierarchy obvious through size and iconography, not a background fill. Render the state-appropriate Lucide icon and center it as a flex item, without manual baseline offsets.

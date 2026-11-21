---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/overlay.tsx"]
---

# Surface: Live Translate app (single screen + PiP overlay)

Mode: Operate. Audience: PC gamers with foreign friends in voice chat; job: glance and understand callouts mid-game. Constraints: PRODUCT.md (free by default, no backend, Chrome/Edge, TH/EN UI).

## Direction contract

THESIS: Translated speech arrives like flights on an airport arrivals board — one fixed place to glance, newest row on top and largest. Refuses the category default of a neon gamer dashboard with chat bubbles.

OWN-WORLD: Board black ground, charcoal flap rows split by a hairline seam, warm off-white type, signage yellow for headers, LISTEN and live state; condensed signage grotesk for time/route/status columns, a loopless Thai sans for translations. Stepped, no-ease motion.

STORY: The visitor picks where the voice comes from, presses Start, and from then on only looks at the top row; they trust where audio and keys go because each statement sits next to the control it describes.

FIRST VIEWPORT: Top bar: name, source switch, route (from → to), primary Start, overlay, settings. TH|EN lives in Settings: with it in the bar, the bar wrapped to two lines at 1440 px (moved 2026-11-22 after the first desktop capture). Below: the board with column header TIME · ROUTE · TRANSLATION · STATUS; newest row at top at subtitle size, a live LISTEN row above it while someone speaks; empty state is a three-step "how to connect" board.

FORM: Airport split-flap arrivals board, candidate 4 of 7; raises: stepped 2-frame flips (from acetate manual), exact timestamps per row (labanotation), newest row dominates (guide map), reduced motion holds still (datamatics). seed:2f0d946a06467ae5

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

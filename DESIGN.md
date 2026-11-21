---
name: Live Translate
description: Translated voice chat arriving as rows on an airport split-flap arrivals board.
colors:
  board: "#0d0f0e"
  bar: "#111312"
  flap: "#161918"
  flap-hi: "#1b1f1d"
  tile: "#232826"
  control: "#262a28"
  divider: "#2a2f2d"
  seam: "#070808"
  sign: "#f5c518"
  ink: "#f2efe6"
  ink-dim: "#a9ada7"
  danger: "#ff6b5e"
typography:
  board-title:
    fontFamily: "Barlow Condensed, Anuphan Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
  wordmark:
    fontFamily: "Barlow Condensed, Anuphan Variable, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  subtitle:
    fontFamily: "Anuphan Variable, system-ui, sans-serif"
    fontSize: "30px"
    lineHeight: 1.3
  subtitle-older:
    fontFamily: "Anuphan Variable, system-ui, sans-serif"
    fontSize: "18.6px"
    lineHeight: 1.3
  sign-label:
    fontFamily: "Barlow Condensed, Anuphan Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    letterSpacing: "0.08em"
  column-head:
    fontFamily: "Barlow Condensed, Anuphan Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.14em"
  body:
    fontFamily: "Anuphan Variable, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.375
  meta:
    fontFamily: "Anuphan Variable, system-ui, sans-serif"
    fontSize: "13px"
rounded:
  tile: "2px"
  sm: "2px"
  md: "3px"
  lg: "4px"
spacing:
  row-gap: "3px"
  tile-pad: "2px 6px"
  row-pad: "12px 20px"
  row-pad-compact: "8px 16px"
  column-gap: "20px"
  section-gap: "32px"
  container: "1400px"
components:
  flap-row:
    backgroundColor: "{colors.flap}"
    textColor: "{colors.ink}"
    typography: "{typography.subtitle-older}"
    padding: "{spacing.row-pad}"
  flap-row-newest:
    backgroundColor: "{colors.flap-hi}"
    textColor: "{colors.ink}"
    typography: "{typography.subtitle}"
    padding: "{spacing.row-pad}"
  flap-tile:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink-dim}"
    typography: "{typography.sign-label}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  button-primary:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.board}"
    rounded: "{rounded.sm}"
    height: "40px"
  button-stop:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.board}"
    rounded: "{rounded.sm}"
    height: "40px"
  button-bordered:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "40px"
  tabs-source-selected:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.board}"
    rounded: "{rounded.sm}"
  select:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "32px"
---

# Design System: Live Translate

## Overview

**Creative North Star: "The Arrivals Board"**

Translated speech arrives like flights on an airport split-flap board: one fixed place to glance, the newest row on top and largest. The whole screen is board black with charcoal flap rows stacked 3px apart; time, route and status sit on their own small tiles split through the middle by a hairline seam, the way a Solari module splits. Signage yellow is the board's only voice: the ARRIVALS title, its underline rule, column heads, the live LISTEN state and the primary action.

Density is that of a departures hall, not a dashboard: a single column of rows, generous subtitle type, everything else condensed and quiet. Motion is mechanical, never eased: rows drop in through three hard frames and the live indicator blinks on a square wave. The system rejects the category default of a neon gamer dashboard with chat bubbles.

**Key Characteristics:**
- Board black ground, charcoal flap rows, tonal steps instead of shadows.
- Seamed tiles for time, route and status; the seam is the world's signature mark.
- Condensed uppercase signage for Latin labels; a loopless Thai sans for every sentence.
- Signage yellow reserved for board voice and the primary action.
- Stepped motion that holds completely still under reduced motion.

## Colors

A near-black, low-chroma board with one warm signage yellow and warm off-white type.

### Primary
- **Signage Yellow** (`sign`): board title and its 2px underline rule, column heads, settings section labels, LISTEN and refined status text, the listening indicator square, the audio meter fill, the selected source tab, the Start button, the author link, focus ring and text selection.

### Neutral
- **Board Black** (`board`): page ground, text on yellow and red fills, theme-color.
- **Bar Charcoal** (`bar`): sticky top bar and settings drawer, separated from the board by a 1px `tile` rule.
- **Flap Charcoal** (`flap`): every board row; also the inset panels inside settings.
- **Newest Flap** (`flap-hi`): the newest finished row only, one step lighter.
- **Tile Charcoal** (`tile`): seamed tile faces; doubles as the bar's bottom rule and the drawer's left rule.
- **Control Charcoal** (`control`): HeroUI default fills (selects, tab track); `divider` for library dividers.
- **Seam Black** (`seam`): the 1px hairline through the middle of each tile.
- **Warm Ink** (`ink`): translations and primary text.
- **Dim Ink** (`ink-dim`): source-language line, tile text for time/route/done, captions, privacy footer.

### Semantic
- **Stop Red** (`danger`): the Start button turns this while listening (Stop); destructive flat buttons.

### Named Rules
**The One Voice Rule.** Yellow speaks only for the board (titles, heads, live state) and the single primary action. Rows, body text and secondary buttons stay in ink on charcoal.

**The Tonal Step Rule.** Surfaces separate by one charcoal step (`board` to `flap` to `flap-hi`), never by tint or hue.

## Typography

**Display Font:** Barlow Condensed 500/600 (falls back to Anuphan Variable, system-ui)
**Body Font:** Anuphan Variable (with system-ui)

**Character:** Condensed station signage for short Latin labels, paired with a loopless modern Thai sans that carries every actual sentence at reading size.

### Hierarchy
- **Board title** (600, 28px, 0.14em, uppercase): ARRIVALS, the one large yellow word on screen.
- **Wordmark** (600, 22px, 0.1em, uppercase, leading 1): "Live Translate" in the top bar.
- **Subtitle** (Anuphan, `--fs` default 30px, user range 18–48px, leading 1.3): the newest row's translation.
- **Older subtitle** (Anuphan, 0.62 × `--fs`, leading 1.3): every other row and the live LISTEN row.
- **Sign label** (500, 15px, 0.08em, uppercase, tabular numerals for time): tile text and board status. Settings section labels use the same face at 0.12em in yellow.
- **Column head** (500, 13px, 0.14em, uppercase, yellow): TIME · ROUTE · TRANSLATION · STATUS.
- **Body** (Anuphan, 15px, snug): source-language line under each translation.
- **Meta** (Anuphan, 13px, dim): tagline, select labels, footer privacy note (max 75ch).

### Named Rules
**The Untracked Thai Rule.** Letter-spacing applies to Latin signage only. Every tracked style resets to `letter-spacing: normal` under `:lang(th)` (the `th:` variant), because tracking breaks Thai mark stacking. Thai labels in the signage face therefore render untracked and in Anuphan.

**The Newest Wins Rule.** Only the newest finished row gets full subtitle size; everything older drops to 0.62×.

## Layout

A single centered column, max 1400px, 20px side padding. The top bar is sticky and wraps (gap 16px × 12px); the audio meter is a 3px strip along its bottom edge. The board is a four-column grid (time 4.75rem, route 3.25rem, translation flexible, status 8rem; 20px column gap, baseline-aligned). Rows stack with 3px gaps so the board ground reads as the gap between flaps; row padding 12px × 20px (8px × 16px in the overlay).

Below 768px the time and route columns hide and the grid collapses to translation plus status; the board drops its side padding to run edge to edge. Below 640px the from/to language selects stack. The picture-in-picture overlay shows only the last three rows, no header.

Settings live in a right drawer with 32px between groups; engine-specific panels are `flap` insets with 16px padding.

## Elevation & Depth

Board surfaces are flat. Depth comes from tonal steps (`board`, `bar`, `flap`, `flap-hi`, `tile`) and from the 3px board-black gaps between rows. No board element carries a shadow; HeroUI popovers and toasts keep their library defaults.

### Named Rules
**The Flat Board Rule.** Rows and tiles never take shadows, gradients or glows; the only gradient in the system is the seam line drawn through a tile.

## Shapes

Hard, near-square forms. Tiles are 2px, controls 2–4px (HeroUI small/medium/large = 2/3/4px), the settings drawer is square-edged, and rows themselves are unrounded full-width bands. Indicators are squares (8px listening dot is a square, not a circle). The favicon repeats the motif: two yellow flaps split by a dark seam.

## Components

### Buttons
- **Shape:** near-square (2px).
- **Primary (Start):** signage yellow fill, board-black text, semibold, min-width 128px, play icon. While listening it becomes **Stop**: red fill, square icon.
- **Bordered:** overlay toggle, settings icon button, clear/save: 2px HeroUI border on board, ink text.
- **Flat danger:** clear-key action only.
- **Focus:** HeroUI focus ring in signage yellow.

### Source Tabs
- **Style:** HeroUI tabs on a control-charcoal track; selected tab is a yellow fill with board-black text, each with a 16px line icon. Disabled (0.45 opacity) while listening.

### Inputs / Selects
- **Style:** HeroUI flat fields on control charcoal, 2px radius; select labels sit outside-left in 13px dim ink.
- **Error:** API-key field turns danger with a 13px message.

### Settings Drawer
- **Style:** right drawer, bar charcoal, 1px tile rule on the left, square edges; header in yellow signage. Groups are labelled by yellow sign-label radio-group titles.

### Flap Row (signature)
A charcoal band holding seamed tiles for time, route and status, with the translation and its dim source line between. The newest finished row lifts one tonal step and takes full subtitle size. Rows enter through `flap-in`: a 180ms rotateX(-88deg → 0) flip from the top edge in `steps(3, jump-none)`. When an AI refinement replaces a quick translation, the translation re-flips. Status tile tone: dim for pending/done, 75% yellow for refining, yellow for refined, blinking yellow for LISTEN.

### Seamed Tile (signature)
Tile charcoal face, 2px radius, 2px × 6px padding, a 1px seam-black line through its exact middle. Used only for time, route and status.

### Board Header
Yellow ARRIVALS title over a 2px yellow rule, with a listening status (yellow square blinking at 1.2s, `steps(1)`) on the right; yellow column heads beneath.

## Do's and Don'ts

### Do:
- **Do** put new board content in flap rows on the 3px-gap stack, newest on top.
- **Do** use seamed tiles for short fixed-width data (time, route, status) and nothing longer.
- **Do** use `steps()` timing for board motion (flip 180ms steps(3), blink 1.2s steps(1)) and drop all animation under `prefers-reduced-motion`.
- **Do** set every tracked signage style with a `th:tracking-normal` reset.
- **Do** use tabular numerals for times.

### Don't:
- **Don't** letter-space Thai text, ever.
- **Don't** use easing curves, springs or fades on board elements; the board moves mechanically.
- **Don't** use yellow for body text, row backgrounds or secondary buttons.
- **Don't** add shadows, glows or neon accents to rows or tiles.
- **Don't** render translations as chat bubbles.
- **Don't** round past 4px.

---
name: GloveBox
description: A little care. A longer road. One dark instrument cluster for a car's upkeep and trip costs.
colors:
  cluster-white: "#e9e7e2"
  plate-white-hover: "#ffffff"
  night-dash: "#0d0e0f"
  panel-graphite: "#151719"
  rail-shadow: "#111315"
  dimmed-legend: "#8b8a86"
  telltale-overdue: "#ff6a3d"
  telltale-overdue-text: "#ff8a63"
  telltale-due-soon: "#f2a815"
  telltale-due-soon-text: "#f5bd4a"
  telltale-ok: "#5fd0a0"
  telltale-ok-text: "#7fdcb3"
typography:
  readout:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "clamp(2.5rem, 6vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  display:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.6rem)"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.556
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  number:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.333
    fontFeature: "tnum"
  label:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.1em"
rounded:
  digit: "4px"
  control: "8px"
  inset: "12px"
  panel: "16px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cluster-white}"
    textColor: "{colors.night-dash}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.plate-white-hover}"
    textColor: "{colors.night-dash}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.cluster-white}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  field:
    backgroundColor: "rgb(0 0 0 / 0.4)"
    textColor: "{colors.cluster-white}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.panel-graphite}"
    rounded: "{rounded.panel}"
    padding: "20px"
  tile:
    backgroundColor: "{colors.panel-graphite}"
    rounded: "{rounded.panel}"
    padding: "16px"
  proposal-card:
    backgroundColor: "rgb(0 0 0 / 0.3)"
    rounded: "{rounded.inset}"
    padding: "16px"
  rail:
    backgroundColor: "{colors.rail-shadow}"
    width: "288px"
    padding: "24px"
  nav-item:
    textColor: "{colors.dimmed-legend}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  nav-item-current:
    backgroundColor: "rgb(255 255 255 / 0.07)"
    textColor: "{colors.cluster-white}"
  model-badge:
    textColor: "{colors.dimmed-legend}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: GloveBox

## Overview

**Creative North Star: "The Instrument Cluster"**

GloveBox is read the way a driver reads a dashboard: a glance, one urgent thing, and the numbers that back it. The whole app is a single dark cluster, dark in every system theme, with a rail one step darker than the panels so the car's identity, odometer and status counts sit behind the glass like a fixed bezel while the content area changes.

Numbers are the instrument. Every figure is set in a monospaced face with tabular digits; the odometer and the headline limits are drum-wheel readouts that roll to their value, and interval progress is a thin gauge meter. Prose is quiet and plain beside them. Colour is almost absent: a warm off-white foreground on near-black graphite, with three telltale hues that light up only to report status, exactly as warning lamps do in a car.

Density is moderate and phone-first. Surfaces are flat, separated by tone and hairline rings rather than shadows. Motion has one orchestrated moment (the ignition sweep, once per visit) and otherwise only answers the user.

**Key Characteristics:**
- Dark-only cluster: near-black base, graphite panels, a darker rail.
- Martian Mono for every number, tabular, often as a rolling drum wheel.
- Telltale colours (overdue, due soon, on track) carry status and nothing else.
- Foreground-white is the only action colour and the only "changed" and focus colour.
- Flat tonal layers with 1px translucent rings; no drop shadows.
- The single most urgent item is the page's h1, its limit the largest number on screen.

## Colors

A monochrome warm-graphite cluster with a three-lamp telltale set reserved for status.

### Primary
- **Cluster White** (#e9e7e2): the foreground for text and the face of the primary button plate. Also the focus outline, the text caret, range and checkbox accents, the selection tint (at 22% alpha), the current-tab mark, and the "Changed" ring on a tile. Its hover state brightens to **Plate White** (#ffffff) on pointer devices only.

### Secondary
The telltale set. Each lamp has a fill tone (dots, meter fills, tinted rings and backgrounds) and a lighter text tone tuned for legible text on graphite.
- **Overdue Amber-Red** (#ff6a3d fill, #ff8a63 text): overdue items, and errors (an error is a problem, so it borrows the overdue lamp, as a tinted 8% background with a 35% ring).
- **Due-Soon Amber** (#f2a815 fill, #f5bd4a text): items coming due.
- **On-Track Green** (#5fd0a0 fill, #7fdcb3 text): items in good standing.

### Neutral
- **Night Dash** (#0d0e0f): page background, and the text colour on the primary plate.
- **Panel Graphite** (#151719): every panel, tile and tool card.
- **Rail Shadow** (#111315): the rail, the phone strip and the tab bar; also the browser theme colour. One step darker than the panels.
- **Dimmed Legend** (#8b8a86): secondary text, units, captions, placeholders, inactive nav items, and the "History needed" status (unknown has no lamp).
- **Hairlines**: white at 5% (panel rings), 6 to 8% (dividers, rail and tab-bar edges), 10% (tile rings at rest, inset cards, meter tracks), 15% (quiet buttons, badges), 35% (field edges, holding 3:1 against the panel), 60% (focused field edge).

### Named Rules
**The Telltale Rule.** Status hues mean status only. Focus, selection, "changed", links and actions use Cluster White, never an overdue, due-soon or on-track hue.

**The Written Status Rule.** A status colour never stands alone: every tinted dot, ring or number sits beside the status written out in words.

**The Darker Rail Rule.** The rail is one step darker than the panels (#111315 against #151719), never lighter and never the same.

## Typography

**Display Font:** Instrument Sans (with system-ui, sans-serif)
**Body Font:** Instrument Sans (with system-ui, sans-serif)
**Label/Mono Font:** Martian Mono (with ui-monospace, monospace)

**Character:** A crisp, slightly technical grotesque for words and a wide, engineered monospace for every figure; the pairing reads like a printed legend beside illuminated digits.

### Hierarchy
- **Readout** (Martian Mono 400, clamp(2.5rem, 6vw, 3.75rem), line-height 1, tabular): the hero limit beside the Next up h1, tinted with its status text tone. The largest number on any screen.
- **Display** (500, clamp(1.75rem, 4vw, 2.6rem), tight leading, tracking -0.025em): the Next up item name, the dashboard's h1.
- **Headline** (500, 1.5rem, tracking -0.025em): page h1s on Service log, Trips and Car & settings; the trip verdict scales up to clamp(22px, 3vw, 30px).
- **Title** (500, 1.125rem): section h2s such as "Coming up"; tool-panel h2s run at 17px. Section titles may trail a muted 14px qualifier after a middot ("· soonest first").
- **Body** (400, 14px, line-height 1.6): all prose, helper text capped at 70ch, basis notes at 60ch. Captions and notes at 12px in Dimmed Legend.
- **Number** (Martian Mono 400, 1.5rem tile values, 18px calculation values, 14px in tables, always tabular-nums).
- **Label** (Martian Mono 400, 10 to 12px, letter-spacing 0.1 to 0.14em, uppercase): units ("MI"), status words on tiles, the model badge, pills and the GloveBox wordmark. These are cluster legends attached to a value or a control.

### Named Rules
**The Mono Numbers Rule.** Every number (miles, dates as readouts, counts, costs, percentages in data) is Martian Mono with tabular figures. Prose numbers inside sentences may stay in the body face.

**The Legend-Not-Kicker Rule.** Uppercase tracked mono is only a legend attached to a value, status or badge. It never sits above a heading as a section label.

## Layout

App shell: on wide screens (64rem and up) a two-column grid, a fixed 288px rail at full viewport height plus a content column capped at max-width 64rem (max-w-5xl) and centred. Below that, the rail collapses into a sticky top strip (wordmark, car name, compact odometer and counts) with a translucent backdrop blur, and navigation moves to a fixed four-tab bar at the bottom. Content pads with safe-area insets on all sides (minimum 16px horizontally, 32px from 640px), clears the tab bar with 112px bottom padding on phones, and scroll padding keeps focus clear of the strip and tab bar (9rem top, 5.5rem bottom; 1.5rem on desktop).

Rhythm: page sections stack 32px apart; panels pad 20px (24px from 640px), the Next up hero 24px (32px from 640px), tiles 16px; grids gap 12px. Tile grids go 1 column, 2 from 420px, 3 from 1280px. Form and calculation grids are auto-fit with minimum tracks of 11rem and 9rem. Controls hold a 44px minimum touch height; tabs 56px.

The first viewport always leads with the single most urgent item as the h1 with its limit as the readout, followed by its two actions.

## Elevation & Depth

Flat. Depth is tonal: Night Dash base, Panel Graphite surfaces, Rail Shadow bezel, and inset wells (fields, proposal cards, odometer digits, the trip verdict) darkened with black at 30 to 60%. Edges are 1px spread-only rings in translucent white, drawn with box-shadow or ring utilities, never offset or blurred shadows. The only glows are motion: the "lit" pulse on a changed tile.

### Shadow Vocabulary
- **Panel hairline** (`box-shadow: 0 0 0 1px rgb(255 255 255 / .05)`): every panel and tool card at rest.
- **Field edge** (`box-shadow: 0 0 0 1px rgb(255 255 255 / .35)`, `.6` on focus): inputs, selects, textareas.
- **Status ring** (ring at 40% overdue or 30% due-soon): tiles and the Next up panel in those states; on-track and unknown use the white 10% ring.
- **Changed ring** (`box-shadow: 0 0 0 1px var(--foreground)`, pulsing twice from a 6px 16% halo): a tile an applied proposal just moved.

### Named Rules
**The No-Drop-Shadow Rule.** Nothing floats. Surfaces separate by tone and a 1px ring; the rail and tab bar earn their separation from tone and a hairline border, plus backdrop blur when content scrolls beneath them on phones.

## Shapes

Soft, consistent corners scaled to the object: 4px on odometer digit tiles, 8px on buttons, fields and nav items, 12px on inset cards and messages, 16px on panels and tiles, fully round on status dots, meters and the model badge. Meters are 6px tall rounded tracks with a rounded fill that scales from the left. No sharp corners, no decorative borders, no side stripes.

## Components

### Buttons
Tactile plates: the primary reads as the lit foreground, everything else stays quiet.
- **Shape:** gently rounded (8px), 44px minimum height, 10px by 16px padding, 14px semibold, 8px icon gap.
- **Primary:** Cluster White plate with Night Dash text. Hovers to pure white on fine pointers.
- **Quiet:** transparent with a white 15% ring and medium weight; on hover a 5% white wash and a 30% ring.
- **Text button:** Dimmed Legend underlined text (4px offset), turning Cluster White on hover.
- **Press:** every enabled button scales to 0.96 on press over 150ms ease-out (when motion is allowed). Disabled at 40% opacity with a not-allowed cursor.

### Cards / Containers
- **Corner Style:** 16px for panels and tiles; 12px for inset cards.
- **Background:** Panel Graphite; inset cards black at 30% on top of a panel.
- **Shadow Strategy:** hairline rings only (see Elevation & Depth).
- **Border:** internal dividers are 1px white at 6%.
- **Internal Padding:** 20 to 24px panels, 24 to 32px hero, 16px tiles and inset cards.

### Inputs / Fields
- **Style:** black 40% well, 8px radius, white 35% 1px ring, 10px by 12px padding, Cluster White caret. Font size never below 16px so phones don't zoom.
- **Focus:** ring brightens to white 60%; keyboard focus also shows the global 2px Cluster White outline at 3px offset.
- **Error / Disabled:** errors are overdue-text messages; disabled fields drop to 50% opacity. Labels sit above in 14px Dimmed Legend; checkboxes and ranges take the foreground accent.

### Chips
- **Pill:** 6px radius, mono 11px tracked legend in Dimmed Legend on white 6% with a 10% ring.
- **Model badge:** fully round, mono 10px uppercase, white 15% ring, "Nemotron" muted with the tier name in Cluster White. Sample answers show plain muted text "Sample · not AI-generated" instead.

### Navigation
- **Rail (desktop):** stacked items, 44px tall, 8px radius, icon plus 14px label in Dimmed Legend; hover adds a 4% white wash and foreground text. The current item is foreground with a white 7% plate that slides between items on page change.
- **Tab bar (phone):** four equal columns, 56px tall, icon above an 11px label, Rail Shadow at 95% with backdrop blur and a white 8% top hairline. The current tab is foreground with a 2px rounded foreground mark at the top edge, which slides between tabs.
- **Icons:** one authored SVG set on a 20px grid, 1.5 stroke, round caps and joins, currentColor.

### Odometer and Rolling Readouts
The signature. Each digit is a drum wheel: a 1ch-wide window over a vertical strip of digits that translates to its value. The odometer shows six digit tiles (4px radius, black 60% well, white 5% ring) followed by a small muted "mi". Wheels and meters always render at their real value; on the first garage render of a visit (ignition) they sweep up from zero over 1100ms, and later changes roll in 520ms, both on the gauge ease `cubic-bezier(0.22, 1, 0.36, 1)`. With reduced motion they simply show the value.

### Item Tile and Meter
Name (14px medium) and the status legend at the top; the remaining limit as a 24px mono number with its unit legend; a 6px interval meter tinted with the status fill on a white 10% track (no track at all when there is no interval, so it never reads as 0% used); then a 12px muted line with the percent used and the interval's source. Re-ranked tiles slide to their new place (FLIP).

### Proposal Card
An inset card inside the drive-review panel: label, the date move in mono (old date muted and struck through), a muted reason, and Apply (primary) and Dismiss (quiet). Nothing changes until applied.

## Do's and Don'ts

### Do:
- **Do** keep the app dark in every system theme: Night Dash base, Panel Graphite surfaces, the rail one step darker (#111315).
- **Do** set every data number in Martian Mono with tabular figures, and make headline values roll as drum wheels.
- **Do** write status in words beside every status colour, and use the telltale text tones (#ff8a63, #f5bd4a, #7fdcb3) for tinted text.
- **Do** use Cluster White for focus (2px outline, 3px offset), selection, "changed" and the primary action.
- **Do** separate surfaces with tone and 1px translucent white rings; fields hold a 35% ring for 3:1 against the panel.
- **Do** keep controls at least 44px tall and inputs at least 16px text.
- **Do** gate hover styles to `(hover: hover) and (pointer: fine)` and keep all motion behind `prefers-reduced-motion: no-preference`, with values correct at first paint.

### Don't:
- **Don't** use an overdue, due-soon or on-track hue for focus, links, selection, decoration or "changed"; telltales report status only.
- **Don't** add drop shadows or offset shadows; depth is tonal.
- **Don't** put uppercase tracked labels (eyebrows, kickers) above headings; mono legends belong to values, statuses and badges.
- **Don't** mark notices or messages with a coloured side stripe; a notice is a neutral 4% wash with a 10% ring.
- **Don't** use Unicode glyphs as icons; use the authored 20px SVG set.
- **Don't** add a second orchestrated animation; ignition happens once per visit, and everything else answers the user.

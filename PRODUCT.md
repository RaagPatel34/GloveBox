# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: an everyday US car owner checking on their car between drives, often on a phone. Their job is to know what upkeep is due, record what was done, and decide whether a drive or a gas detour is worth it, without keeping receipts and reminders in their head.

Evaluating audience: Nebius x NVIDIA hackathon judges. They meet the app cold, usually on a laptop, and must reach a populated, working car in one click (Load demo car) within a sub-three-minute video.

## Product Purpose

GloveBox is a car co-pilot for upkeep and trip costs. You tell it what happened, and it tells you what's due, when to do it, and what the drive will cost. Success means the owner always knows the next thing their car needs and why, and nothing changes on their schedule without their approval.

## Positioning

Plain code does the math; the model does the reasoning. Every number (odometer estimate, due dates, fuel cost, detour savings) is computed by deterministic tools, never invented by the model. AI only proposes; the owner applies or dismisses each proposal, and every AI answer carries a model badge.

## Operating Context

- One garage, kept in the browser (localStorage key `glovebox.v1`). No account or login. An optional one-time copy to a cloud garage exists.
- A demo car (2019 Honda Civic, Buena Park, CA) loads in one click and resets on demand.
- AI runs on NVIDIA Nemotron (Nano / Super / Ultra) through Nebius Token Factory. Live AI can be paused, and a labeled Sample mode then works with no AI call.
- Live data: EPA fuel economy (fueleconomy.gov), Open-Meteo weather and air quality, EIA regional gas prices, Google Places/Routes, Tavily search. Several of these need credentials and can be unavailable.
- US only, imperial units.

## Capabilities and Constraints

- Four areas: Dashboard (car health), Service log (history, odometer, mileage forecast), Trips (route, fuel cost, gas-detour verdict), Car & settings (car setup, intervals and sources, backup and restore, cloud copy).
- Item statuses: Overdue, Due soon, On track, History needed (unknown).
- Out of scope: logins, notifications, metric units, native apps, EV charging, live GPS.
- Next.js 16 / React 19 / Tailwind 4, deployed on Vercel.

## Brand Commitments

- Name: GloveBox. Tagline: "A little care. A longer road."
- Honest, plain voice. Say what is estimated, sampled, illustrative or unverified ("Sample · not AI-generated", "History needed", "regional estimate, not a station quote"). Never overclaim what the AI or the data did.
- Model badge (Nano / Super / Ultra / Sample) on every AI answer.

## Evidence on Hand

- Demo car fixture: `src/lib/maintenance.ts` (`demoGarage`) and `src/lib/fixtures/`.
- No real users, testimonials or usage metrics exist; do not fabricate any.

## Product Principles

1. The next thing the car needs is always the first thing you see.
2. Nothing changes without the owner's approval; proposals wait.
3. Show the basis of every number and reminder: source, estimate, or sample.
4. Works without AI: every core flow has a non-AI path.
5. One car, one garage, one place to look.

## Accessibility & Inclusion

WCAG 2.2 AA: contrast, keyboard operation, visible focus, accessible names, reduced motion, and 200% zoom.

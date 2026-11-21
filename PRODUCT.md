# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + HeroUI v2 (user-specified), built with Vite and deployed as a static site on GitHub Pages (custom domain `nattapat2871.me/live-translate/`). No backend.

## Users

Gamers who play with foreign friends and can't follow what those friends say in voice chat. They run the page next to a game on a Windows PC, mostly while in a call on the Discord desktop app, in-game voice (Valorant, CS2, Roblox, etc.), or Discord in the browser. Their attention is on the game; they glance at subtitles, they don't read a page.

## Product Purpose

Turn a friend's voice into translated subtitles in near real time, free, with nothing to sign up for or configure. Success: the user understands a callout fast enough to act on it, without alt-tabbing.

## Positioning

Free and backend-less: audio is captured from the PC itself (screen/system audio or a chosen tab), transcribed by the browser, and translated client-side, so it works for anyone with Chrome or Edge and costs the author nothing to run. Subtitles float above the game in an always-on-top window.

## Operating Context

- Input sources: system audio via screen share with "share system audio" (Discord app, in-game voice), a single browser tab (Discord web), or the microphone.
- Output: a subtitle feed in the page plus a Document Picture-in-Picture overlay above borderless/windowed games.
- Session length: a whole gaming session; the page stays open for hours.

## Capabilities and Constraints

- Transcription: Web Speech API (`SpeechRecognition.start(MediaStreamTrack)`), Chrome/Edge only, needs internet.
- Translation tiers, all optional beyond the first:
  1. Google Translate (free, default, always on as the instant first pass), with the previous line attached as context.
  2. Chrome built-in AI (on-device, free, no key) for context-aware refinement when the browser supports it.
  3. The user's own Claude API key, stored only in that browser, for the best context-aware translation.
- The site never ships or holds an API key of its own. Any key field must say plainly that it is optional, belongs to the visitor, stays in their browser, and is sent only to the provider.
- UI language: Thai and English, switchable. Translation languages are separate settings.
- Limits: no speaker separation; exclusive-fullscreen games cover the overlay; not usable on mobile.

## Brand Commitments

- Name: Live Translate.
- Author credit: nattapat2871 (https://nattapat2871.me) appears in the code and site.

## Evidence on Hand

No testimonials, user counts, or benchmarks exist. Do not invent them.

## Product Principles

1. Free by default: the page works fully with zero setup.
2. Glanceable over readable: the newest translated line wins every layout decision.
3. Never surprise users about their data: say where audio and keys go.
4. Degrade gracefully: each optional tier falls back to the one below without breaking the session.

## Accessibility & Inclusion

Adjustable subtitle size; readable contrast on dark backgrounds over long sessions; full keyboard operation; status changes announced politely.

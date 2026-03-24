# UI Constitution

This file is the fixed UI constitution for all future Voxera front-end work. Frontend agents must read it before touching the first screen or any voice-first interaction surface.

## 1. Five Main Box Grouping (Google Expansion Pattern)

- The first screen must be organized into exactly five primary box groups.
- The five groups must feel expandable and operational, similar to a Google-style productivity workspace rather than a decorative landing page.
- Each box must own one durable job:
  - voice capture
  - transcript or context
  - destination or routing
  - execution state or history
  - next action or confirmation
- No orphan cards, floating widgets, or fragmented mini-panels are allowed outside those five groups.

## 2. Dark Theme And Real Brand Color Icons

- The default Voxera UI theme is dark.
- Destination icons must use real brand colors where the product integrates with real brands such as Google, Slack, Notion, or Sheets.
- Placeholder monochrome icons, fake gradients, and washed-out generic colors are not acceptable for production-facing destination surfaces.
- Layout chrome may stay restrained, but the iconography must clearly communicate the real platform the user is about to act on.

## 3. Zero-UI Voice Mic Transition

- When the user enters active voice capture, the interface must transition toward a zero-UI voice mode.
- Zero-UI means the screen collapses to the minimum trustworthy controls: mic state, remaining time, stop affordance, and execution-critical feedback only.
- Decorative controls, secondary panels, and non-essential copy should get out of the way during active capture.
- This rule does not override the backend and reducer truth:
  - AudioWorklet + PCM over WSS only
  - exact 15-second cutoff
  - synchronous `clientRequestId` duplicate lock
  - fixed 8-state reducer

## Enforcement

- Frontend work that violates any of these three rules is out of constitution and must be corrected before merge.

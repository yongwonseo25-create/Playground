# Warm Landing Revival - Visual PRD

## Brief Restatement
Rebuild the warm landing as a dark, centrally focused premium acquisition page with a Siri-like glass microphone core, breathing halo motion, and a VIP modal that feels like a blurred aura card rather than a flat popup.

## S.T.R.U.C.T

### S. Screen
- Theme: near-black dark mode with `bg-[#050505]`
- Bias: mobile-first hero that expands cleanly to desktop
- Ratio: tall marketing canvas with centered focal lockup
- Viewport mood: hypnotic premium spotlight with high contrast

### T. Tree
- Root shell
  - ambient background layer
  - centered max-width hero wrapper
    - eyebrow badge
    - hero headline group
    - glass microphone stage
    - proof chips row
    - primary CTA / secondary CTA cluster
  - floating VIP modal preview card
  - minimal footer note

### R. Relative
- Entire composition stays center-aligned around the mic stage
- Headline stack sits above the mic with generous negative space
- Proof chips float below the mic, then CTA cluster anchors the lower center
- VIP modal is shown as an offset overlay card slightly to the right of the primary axis
- Background aura radiates outward from the center, not from page edges

### U. Units
- Container: `max-w-md` on mobile, `max-w-5xl` desktop visual lock
- Spacing rhythm: spacious around the hero core, tighter for proof chips
- Section breathing room: 96px top/bottom hero breathing on desktop, compacted to 40-56px on mobile
- Text wrapping rule: all main Korean copy should use `break-keep`

### C. Components
- Eyebrow badge: premium signal label
- Headline: emotional high-end hook
- Supporting copy: concise performance/value line
- Glass microphone orb: main interaction magnet
- Pulse rings: breathing motion guide
- Glow shadow mass: luminous focus anchor
- Proof chips: trust snippets and concise social proof
- CTA buttons: free trial and concierge/demo path
- VIP modal card: premium blurred gradient card with offer and signup intent
- Footer note: low-noise assurance copy

### T. Theme
- Tone: luxurious, cinematic, dopamine-heavy
- Surface: glassmorphism with white translucent strokes and layered blur
- Hierarchy: high, centered around the microphone orb
- Motion mood: slow breathing pulse, soft shimmer, restrained floating depth
- Contrast: white/silver text against black void with foggy aura accents

## SVG Blueprint Intent
- Preserve a single dominant visual mass at center
- Show the mic orb, pulse rings, glow field, and VIP modal overlay clearly
- Keep annotation labels implementation-facing rather than decorative

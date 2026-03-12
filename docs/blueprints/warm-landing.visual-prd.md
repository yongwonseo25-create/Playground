# Visual PRD: warm-landing

## Screen Context
- Theme: Dark
- Surface: Mobile-first warm landing hero for short-form dopamine traffic
- Focus: Remove escape routes such as a menu bar and About Us links
- Aspect Ratio 16:9 translated into a vertically centered mobile-first viewport
- Visual Hierarchy: High headline, Medium interactive mic and CTA, Low trust bar

## Tree Hierarchy
- Root > Main Container > Section Wrapper
- Section Wrapper > Headline
- Section Wrapper > Interactive Mic Demo
- Section Wrapper > Single CTA Button
- Section Wrapper > Trust Bar
- Layout trigger: Flex Column/Row with a single centered stack

## Relative Layout
- Main stack is centered horizontally and vertically
- Content remains in one axis rather than using scattered absolute positioning
- Justify: Space-Between is intentionally reduced in favor of a centered conversion cluster
- No navigation chrome, no secondary exit links, no sidebar distractions

## Units & Spacing
- Main Container: `bg-[#0A0A0A] min-h-screen w-full flex flex-col items-center justify-center`
- Section Wrapper: `max-w-md mx-auto w-full px-6 flex flex-col items-center justify-center`
- Headline to Mic gap: fixed 40px
- Mic to CTA gap: fixed 48px
- Negative Space 30% around the central stack to keep the page breathable
- Max-width: 1200px, Centered at system level while the UI module stays `max-w-md`

## Components
1. Headline
- Text: "말하면, 업무가 완성된다"
- Style: `text-4xl font-bold text-white text-center text-balance break-keep tracking-tight`
- Visual Hierarchy: High

2. Interactive Mic Demo
- Type: circular trigger button
- Size: `w-[120px] h-[120px]`
- Style: `rounded-full bg-zinc-900 flex items-center justify-center cursor-pointer`
- Effect: `hover:shadow-[0_0_80px_rgba(255,255,255,0.2)]`
- Behavior: on click, toggle the Free Trial modal open state

3. Single CTA Button
- Text: "[🎤 지금 말해보기]"
- Role: secondary trigger to the same modal action
- Visual Hierarchy: Medium

4. Trust Bar
- Text: "1,247명이 오늘 이미 체험함"
- Visual Hierarchy: Low

## Theme & Style
- Color mode: Dark
- Tone: urgent, focused, premium, minimal
- Contrast: bright foreground on deep charcoal surfaces
- Motion mood: subtle hover emphasis only
- Sticky/Fixed Position is not required for this landing stack
- Grid 12-column system is not required inside the compact module, but the page still respects a centered max-width shell

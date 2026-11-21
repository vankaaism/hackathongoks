# DESIGN_BRIEF.md

Reference images live in `assets/reference/`. Interpret and adapt them, never copy literally. Do not reuse the Duolingo character or any chess.com or Grammarly branding.

## Mood
Dark, warm "night study room". Calm enough that blur and vignette effects read clearly. Rounded cards (12 to 16 px radius). One accent color per blunder category, used consistently across underline, graph dot, event icon and category strip.

| Category | Accent |
|----------|--------|
| Fluency | amber |
| Clarity | blue |
| Evidence | violet |
| Consistency | red |
| Composure | teal |

Severity is shown by fill intensity and graph dot color: red (3), orange (2), blue (1), green (great moment / recovery).

## Image 1 (Grammarly) -> LEFT panel
- Inline colored underlines on exact words; pink highlight block for the worst offender.
- Suggestion card: struck-out original, replacement in green, Got it / Dismiss, prev/next arrows.
- Collapsed issue rows with colored dot and short label.
- Bottom category bar with a colored strip per category.
- Changed: spoken-delivery categories; transcript never edited; "Accept" becomes "Got it".

## Image 2 (Duolingo call) -> CENTER panel
- Flat vector character, limited palette, dark rounded card.
- Expression carried by eyes, brows, mouth only. Skeptical state echoes the side-eye frame.
- Framing changes: wide, close-up, mid shot via scale/translate.
- Persistent green round button at the bottom (start / push-to-talk).
- Added: light-novel dialogue box with typed-out text, name tag, scene caption. Original character design.

## Image 3 (chess.com review) -> RIGHT panel
- Compact area graph on top with colored dots and a vertical playhead.
- Blunder card: title, one-line explanation, numeric penalty, Retry / Best / Next buttons.
- Scrollable event list with icons, tab bar (Live / Review / Details / History).
- Changed: y-axis is performance score; "Best" shows a model-answer outline; green recovery dots.

## Awareness Effect visuals
- Vignette: radial gradient overlay, pointer-events none, red tint.
- Blur/dim: apply `filter: blur()` and reduced opacity to the left and right panels only. The center stage keeps `filter: none` and a higher z-index.
- Level 3 breathing circle: centered SVG circle scaling over 4 s in / 4 s out, with text label.
- Transitions 200 to 300 ms ease-out on escalation, 600 ms on de-escalation. Respect `prefers-reduced-motion`.
- Use GPU-friendly properties (opacity, transform). Blur is expensive: animate opacity of a pre-blurred layer if frames drop.

## Typography and spacing
Pick one readable sans for UI and one distinct display face for the dialogue box (visual-novel feel). Transcript text 16 px, line-height 1.6. Keep generous padding so underlines stay readable.

## Accessibility
Contrast AA on the dark theme. Warnings always have text, never color only. No flashing above 3 Hz. Keyboard focus for suggestion cards and the green button. Offer Off / Gentle / Full.

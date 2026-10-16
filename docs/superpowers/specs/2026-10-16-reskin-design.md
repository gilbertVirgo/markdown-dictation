# Reskin: Bricolage + Garamond, sand and tangerine, desktop sidebar

Builds on PR #2's structure (always-editable doc, pinned toolbar, always-on voice panel, tap start/stop mic with level ring, pending text in accent). Replaces PR #2's look (three colours, 0.5px hairlines, rounded corners).

## Type

- UI: **Bricolage Grotesque** (Google Fonts, `opsz` axis, weights 500 + 800). Replaces Inter.
- Document body: **EB Garamond** (400, 400 italic, 600). Replaces Libertinus.
- Two UI sizes only:
  - **BIG**: Bricolage 800, `letter-spacing: -0.035em`, `line-height: 0.95`. Doc titles in list (desktop sidebar ~22px, mobile list ~36px), doc page title ~52px desktop / ~40px mobile.
  - **small**: Bricolage 500, 11px, uppercase, `letter-spacing: 0.08em`, muted colour. Status, labels, timestamps, menu items, picker chips, buttons.
- Doc headings: first H1 = the BIG title (Bricolage 800). H2/H3 also Bricolage 800, scaled down. Body, quotes, lists in Garamond. Size setting (small/medium/large) still scales the doc.

## Colour

Sand neutrals with a tangerine accent (hue ~30°, low saturation). Areas separated by fill colour, never lines. Orange appears only where it means something: live mic, level ring, pending text, + button, Delete, error status.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--c50` | `#F8F5F1` | `#161310` | page / editor |
| `--c100` | `#EEE7DF` | `#1F1B17` | sidebar, header, toolbar, picker strip |
| `--c200` | `#E0D4C6` | `#2C261F` | voice dock, selected doc, dialog |
| `--c300` | `#C9B49E` | `#4D4237` | loading bars, placeholder |
| `--ink` | `#2E241C` | `#F1EBE4` | text, selected chip fill, icon on `--hot` |
| `--mute` | `#665443` | `#A8998A` | small labels, interim transcript |
| `--hot` | `#F2701F` | `#F2701F` | fills: live mic, level ring, + button |
| `--hot-text` | `#B8500F` | `#F2701F` | text: pending chunk, Delete, error status |

Contrast (WCAG AA): `--mute` ≥ 4.9:1 on every panel in both modes. `--hot-text` 4.6:1 on light `--c50`, 6.3:1 dark. Icons on `--hot` use `--ink` (5.1:1), not white (2.9:1).

Selected state (block picker, text size, active toolbar mark) = solid `--ink` block with `--c50` text. `theme-color` meta follows `--c100`.

## Shape

- `border-radius: 0` everywhere, including mic button, level ring, + button, dialog, inputs.
- No borders or outlines. Blockquote marked by Garamond italic + `--c100` fill block instead of a rule. Focus ring: 2px `--hot` outline (accessibility, keep).

## Layout

- **Mobile (< 1024px)**: as PR #2. Header (`--c100`) → editor (`--c50`) → toolbar (`--c100`) → voice dock.
- **Desktop (≥ 1024px)**: two-column grid.
  - Left: permanent sidebar (~280px, `--c100`), "DICTATE" label + square + button, BIG doc titles with small timestamps, selected doc on `--c200`. The doc list route renders the same sidebar with an empty editor prompt.
  - Right: top row = formatting toolbar + save status + settings + ⋮ menu. Editor column max ~65ch, BIG title. Voice dock at bottom.
- **Voice dock (two tiers, all sizes)**:
  - Tier 1 (`--c200`): square mic (52px desktop / 60px mobile) left, then small status label ("LISTENING" / "TAP TO DICTATE" / error) over Garamond italic interim transcript, single line, ellipsis.
  - Tier 2 (`--c100`): "NEXT BLOCK" label + H1 H2 H3 Body Quote chips.
- Mic idle: `--c50` square with ink icon. Live: `--hot` square, level ring = `--hot` square at ~30% opacity behind it, scaled by audio level (transform only).

## Motion

- One curve: `cubic-bezier(.22, 1, .36, 1)`.
- Entrance: `opacity 0 → 1`, `translateY(10px) → 0`, ~400ms. Doc list rows stagger 60ms. Editor content fades up on doc switch.
- Menu ~220ms, settings dialog ~360ms, both translateY + opacity.
- Status swaps ("Saving…" → "Saved") rise in like a ticker.
- `prefers-reduced-motion: reduce` → no animation.
- CSS keyframes only, no library.

## Loading states

- Doc list: three `--c300`-stepping bars (`steps()` cycle through c100/c200/c300) + "FETCHING" with letters hopping (staggered translateY).
- Saving: "SAVING" with three hopping dots.
- Pending (Claude refining): word-by-word opacity wave over the `--hot-text` pending text; refined text rises in.
- Mic connecting: square breathes between `--c300` and `--hot` until live.

## Out of scope

New features, data changes, icon redesign beyond squaring.

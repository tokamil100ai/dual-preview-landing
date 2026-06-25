# Design System: CleanShot X

Source: https://cleanshot.com/
Extracted: 2026-06-24

---

```yaml
---
name: cleanshot-x
version: alpha
description: Product-led minimal design for a Mac power-user tool — high trust, no clutter, blue CTA as the only accent color
colors:
  primary: "#000000"           # headings, primary text, dark UI elements
  secondary: "#333333"         # body paragraphs, descriptive copy
  tertiary: "#0669FF"          # CTA buttons, badge text, interactive accents — only blue on the page
  neutral: "#FFFFFF"           # page background, nav background
  surface-alt: "#F6F6F6"       # alternate section background, secondary button fill
  surface-footer: "#FAFAFA"    # footer background
  on-primary: "#FFFFFF"        # text on blue CTA button
  on-neutral: "#000000"        # text on white background
  muted: "#666666"             # secondary / de-emphasized text
  blue-tint: "#E2EEFF"         # badge/tag background on blue-text elements
  success: "#2CCB89"           # checkmark icons, success states
  border: "#E9E9E9"            # input field border
  error: "#FF3B30"             # unconfirmed — approximate
typography:
  display:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "48px"
    fontWeight: "700"
    lineHeight: "60px"
    letterSpacing: "normal"
  h1:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "48px"
    fontWeight: "700"
    lineHeight: "60px"
  h2:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "48px"
    fontWeight: "700"
    lineHeight: "60px"
  h3:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: "700"
  body-md:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: "400"
    lineHeight: "32px"
  body-sm:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: "400"
  label:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: "700"
    letterSpacing: "normal"
  caption:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: "700"
  badge:
    fontFamily: "Inter, \"Inter UI\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: "700"
spacing:
  xs: "4px"
  sm: "12px"
  md: "25px"
  lg: "40px"
  xl: "60px"
  2xl: "110px"
rounded:
  none: "0px"
  sm: "20px"
  md: "28px"
  full: "9999px"
layout:
  maxWidth: "1224px"
  columns: 3
  gutter: "60px"
  horizontalPadding: "~204px"  # computed padding inside max-width container
  breakpoints:
    mobile: "768px"             # unconfirmed — approximate
    tablet: "1024px"            # unconfirmed — approximate
    desktop: "1224px"
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"       # 20px — pill-adjacent but not full pill
    padding: "0px 25px"
    height: "40px"
    fontWeight: "700"
    fontSize: "14px"
    transition: "background 0.15s"
  button-primary-hover:
    backgroundColor: "#0558E0"    # unconfirmed — approximate darker blue
  button-secondary:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"       # 28px — fuller pill
    padding: "0px 40px"
    height: "56px"
    fontWeight: "700"
    fontSize: "16px"
  badge:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.sm}"
    padding: "4px 12px 5px"
    fontSize: "12px"
    fontWeight: "700"
  input:
    backgroundColor: "{colors.neutral}"
    borderColor: "{colors.border}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"       # 28px — pill input
    padding: "0px 25px"
    shadow: "rgba(0, 0, 0, 0.05) 0px 3px 7px 0px"
    focusBorderColor: "{colors.tertiary}"
  nav:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    activeColor: "{colors.tertiary}"
    height: "87px"
    shadow: "none"
    borderBottom: "none"
---
```

---

## Section 1 — Visual Theme & Atmosphere

CleanShot X uses **product-confidence minimalism** — a design tradition where the UI exists purely to give the product screenshots maximum presence. The page is almost entirely white with black type; the only accent color (blue #0669FF) appears exclusively on CTAs and badges. There are no illustrations, no gradients, no decorative geometry. The design communicates "this was made by engineers who know what designers need" — authoritative, no-nonsense, no fuss.

The emotional response is: **trust, clarity, focus**. This is the design of a tool that knows it's good and doesn't need to yell. Every element earns its place by either labeling something or showing the product.

**Key aesthetic descriptors:** product-confident, editorially spare, typographically assertive, high-trust, macOS-native
**Target audience impression:** speaks to Mac power users and professionals who value tools over aesthetics — the design signals reliability over delight
**Design signature:** massive 48px black headings paired with large product screenshots — type and product, nothing else

---

## Section 2 — Colors

CleanShot's palette is a near-monochrome system with a single blue accent. The white background (#FFFFFF) and black headings (#000000) create maximum contrast, while the body text uses a slightly softened black (#333333) to reduce fatigue. Blue #0669FF appears *only* on interactive elements — CTAs and badges — making every occurrence feel clickable. The pale blue tint (#E2EEFF) as badge background keeps the accent cohesive without visual weight.

- **Primary (#000000):** jet black — all headings, all structural text, dark UI chrome
- **Secondary (#333333):** dark charcoal — body paragraphs, descriptive copy, icon labels
- **Tertiary (#0669FF):** pure strong blue — CTA button fill, badge text, the only color on the page besides black/white
- **Neutral (#FFFFFF):** pure white — page surface, nav background, card backgrounds
- **Surface-alt (#F6F6F6):** light grey — alternating section backgrounds, secondary button fill
- **Surface-footer (#FAFAFA):** off-white — footer area, visually separates bottom from body
- **On-primary (#FFFFFF):** white — text inside blue CTA buttons
- **Muted (#666666):** medium grey — secondary labels, metadata, attribution text
- **Blue-tint (#E2EEFF):** light blue — badge/pill background paired with #0669FF text
- **Success (#2CCB89):** medium green — checkmark icons, confirmed feature indicators
- **Border (#E9E9E9):** light grey — input field border, subtle structural separation

**Color temperature:** cool-neutral
**Contrast approach:** high-contrast for headings and CTAs; soft for body text
**Dark mode:** absent

---

## Section 3 — Typography

The entire site runs on Inter (falling back to SF Pro Display on macOS, then Helvetica). There are no external font files loaded — the stack leans on system fonts, which gives instant load and native feel on Mac. The type scale is intentionally sparse: one size for all major headings (48px/700), one for body (20px/400), and 14px labels. The aggressive jump from 20px body to 48px headings creates clear visual hierarchy with very few levels.

- **Display / Headlines (H1, H2):** Inter 700 — 48px, line-height 60px — bold, assertive, no letter-spacing adjustment. Same size used for H1 and all section H2s: every section has equal typographic weight.
- **H3:** Inter 700 — 20px — same size as body but bold, distinguishes sub-sections within features
- **Body (body-md):** Inter 400 — 20px, line-height 32px, color #333333 — large and comfortable, avoids the cramped feel of 16px body
- **Labels / button text:** Inter 700 — 14px — smaller than body but bold, used in primary CTA
- **Badge / caption:** Inter 700 — 12px — uppercase-weight feel from bold weight, not text-transform
- **Nav links:** Inter 400 — 16px — lighter than headings, clear but not dominant

**Scale approach:** Aggressive binary scale — 48px headings, 20px body. Almost nothing in between.
**Weight range:** 400 (body, nav) and 700 (headings, buttons, badges). No 500 or 600.
**Distinctive treatments:** Bold weight used as the only hierarchy signal — no italic, no tracking, no uppercase. Heaviness = importance.
**Loading strategy:** System font stack — no external font loading detected. Inter used if installed on system (common on macOS), SF Pro as fallback.

---

## Section 4 — Layout & Spacing

The layout breathes through aggressive section padding (110px top and bottom) and a constrained 1224px max-width container with substantial horizontal padding (~204px each side). This creates a focused reading column that never stretches to screen edges on large monitors. Whitespace is the primary design element — sections don't have borders or dividers, they're separated by space alone.

**Grid:** 3 columns for feature grids, 2 columns for large feature sections, max-width 1224px
**Spacing unit:** ~25px base (button padding), scaling to 40px, 60px, 110px for section padding
**Whitespace philosophy:** section-based contrast — generous vertical breathing room, tight within sections
**Section rhythm:** 110px top/bottom padding on primary sections; alternating white (#FFF) and light grey (#F6F6F6) backgrounds instead of dividers
**Vertical density:** low — each feature section typically has one heading, one paragraph, one media element
**Responsive behavior:** Nav collapses (menu-overlay element present but hidden); 3-col grid likely stacks on mobile

---

## Section 5 — Elevation & Depth

CleanShot uses targeted, purposeful shadows — not on cards or UI containers, but on media elements (screenshots, video) and subtle form inputs. This keeps the page surface visually flat while making product screenshots appear to "float" above the page, drawing attention exactly where needed.

**Depth strategy:** shadow-based on media only; flat on containers
**Shadow values:**
- Media/video: `rgba(0, 0, 0, 0.25) 0px 24px 50px 0px` — large, soft, used on screenshots
- Input field: `rgba(0, 0, 0, 0.05) 0px 3px 7px 0px` — barely perceptible, adds form depth
- Feature icons: `rgba(0, 0, 0, 0.08) 0px 16px 24px 0px` — medium, lifts icon badges
**Layer model:** background (#FFF / #F6F6F6) → content text → product screenshots (with shadow)
**Flat alternatives:** Section backgrounds alternate between #FFF and #F6F6F6 to create rhythm without borders or shadows on containers

---

## Section 6 — Shapes & Borders

The corner language is paradoxical: buttons and inputs are strongly rounded (pill-ish), while all content containers are completely flat (0px radius). This creates a clear affordance signal — if it's round, it's clickable or interactive. If it's rectangular, it's content. The pill aesthetic on CTAs feels friendly and approachable against the otherwise serious black-type-on-white layout.

**Corner philosophy:** pill for interactive, sharp for content
**Primary button radius:** 20px — not a full pill, slightly squared, reads as "premium Mac app button"
**Secondary button radius:** 28px — fuller pill on the larger "How it works" button
**Badge radius:** 20px — pill-shaped, consistent with primary button
**Input radius:** 28px — full pill input, clean and modern
**Card/container radius:** 0px — all content sections are perfectly rectangular
**Border usage:** input field only — 1px solid #E9E9E9, very light
**Decorative shapes:** none — no clip-paths, no SVG blobs, no diagonal dividers

---

## Section 7 — Motion & Interaction

Motion is deliberately minimal — a single transition on the primary button hover state. The design relies on static product screenshots rather than animation to communicate value.

**Motion philosophy:** subtle-functional
**Default transition:** `background 0.15s` — button background color only, no easing specified (defaults to ease)
**Hover treatments:** CTA button background darkens on hover (transition: background 0.15s); no hover effects on cards or containers
**Entrance animations:** Not detected
**Scroll behavior:** Standard scroll, no parallax, no reveal animations detected

---

## Section 8 — Components

**Primary button ("Buy now"):** Blue pill (#0669FF, radius 20px, height 40px, font 14px/700). Compact and decisive. Used in nav and hero. On hover, background darkens (0.15s transition). No border, no shadow — pure filled pill.

**Secondary button ("How it works"):** Grey pill (#F6F6F6, radius 28px, height 56px, font 16px/700, color #000). Noticeably taller than primary — used to give a "soft CTA" option alongside the primary. No border, no shadow. Acts as a ghost alternative without being transparent.

**Badge/Tag ("Apple Silicon ready", "Pro"):** Blue-on-blue-tint pill (#0669FF text on #E2EEFF bg, radius 20px, padding 4px 12px 5px, font 12px/700). Used to call out compatibility status or feature tier. Never used decoratively.

**Navigation:** White background (#FFF), 87px tall, no bottom border, no shadow. Logo left, links center-right, CTA button right. Nav links are 16px/400 in default browser link color (overridden in production to #000 or #333 — computed showed default blue due to no explicit override on inspected elements). Primary CTA button appears in nav.

**Input field ("Newsletter"):** White fill, 1px #E9E9E9 border, 28px radius (full pill), subtle shadow `rgba(0,0,0,0.05) 0px 3px 7px 0px`, 16px font, padding 0 25px. Sits alongside a primary button CTA in the newsletter section.

**Feature sections:** Two-column layout — text left (heading + paragraph), product screenshot right (with large shadow). No card wrapping. No background on the feature block. Content floats on the white page.

**Small features grid:** 3-column grid, 60px gap, no cards. Icon + heading + paragraph only. Clean list, no visual decoration.

**Alternating section backgrounds:** Every other major section uses #F6F6F6 background instead of white, creating rhythm without borders.

---

## Section 9 — Do's and Don'ts

**Do:**
- Use #0669FF exclusively for interactive elements — CTAs, badge text, links. Never use it decoratively.
- Apply 48px/700 to all section headings (H1 and H2 equally) — no hierarchy variation within headings.
- Use 110px top and bottom padding on every primary section — the whitespace is the design.
- Give all interactive pill elements (buttons, badges, inputs) rounded corners (20–28px); give all content containers 0px radius.
- Use body text at 20px/400 with line-height 32px and color #333333 — not 16px, not black, not tighter.
- Add `rgba(0, 0, 0, 0.25) 0px 24px 50px 0px` shadow to product screenshots and video elements to lift them off the page.
- Use #F6F6F6 as the alternate section background instead of borders or dividers.
- Keep the 3-column grid gap at 60px — never tighter.

**Don't:**
- Don't use any decorative colors beyond the core palette — no gradients, no tints, no illustration colors.
- Don't add border-radius to content containers, cards, or section wrappers — only interactive elements get rounded corners.
- Don't use font weights between 400 and 700 — the design uses only regular and bold, nothing in between.
- Don't add box-shadows to layout containers or cards — shadows appear only on media (screenshots, icons) and form inputs.
- Don't reduce section padding below 80px vertically — breathing room is structural, not decorative.
- Don't use more than two font sizes for body-level text (20px and 16px max) — the scale is intentionally sparse.
- Don't add borders or dividers between sections — background color alternation (#FFF / #F6F6F6) does the separating.
- Don't add animations beyond the 0.15s button hover — the design is deliberately static.

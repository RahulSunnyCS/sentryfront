---
name: VibeSafe
colors:
  bg: "#FAFAF8"
  surface: "#FFFFFF"
  surface-variant: "#F0F0EC"
  on-surface: "#111110"
  on-surface-variant: "#4A4A46"
  on-surface-tertiary: "#9B9B94"
  border: "#E4E4E0"
  border-light: "#F0F0EC"
  accent-teal: "#0D9488"
  accent-teal-light: "#CCFBF1"
  accent-teal-dark: "#0F766E"
  accent-indigo: "#4F46E5"
  accent-indigo-light: "#E0E7FF"
  accent-indigo-dark: "#3730A3"
  accent-violet: "#7C3AED"
  accent-violet-light: "#EDE9FE"
  accent-violet-dark: "#5B21B6"
  grade-a: "#059669"
  grade-a-bg: "#ECFDF5"
  grade-b: "#0D9488"
  grade-b-bg: "#F0FDFA"
  grade-c: "#CA8A04"
  grade-c-bg: "#FEFCE8"
  grade-d: "#EA580C"
  grade-d-bg: "#FFF7ED"
  grade-f: "#E11D48"
  grade-f-bg: "#FFF1F2"
  severity-critical: "#E11D48"
  severity-critical-bg: "#FFF1F2"
  severity-critical-border: "#FECDD3"
  severity-high: "#EA580C"
  severity-high-bg: "#FFF7ED"
  severity-high-border: "#FED7AA"
  severity-medium: "#CA8A04"
  severity-medium-bg: "#FEFCE8"
  severity-medium-border: "#FEF08A"
  severity-low: "#2563EB"
  severity-low-bg: "#EFF6FF"
  severity-low-border: "#BFDBFE"
  severity-info: "#6B7280"
  severity-info-bg: "#F9FAFB"
  severity-info-border: "#E5E7EB"
  code-block-bg: "#1a1a2e"
  code-block-text: "#e2e8f0"
  white: "#FFFFFF"
  nav-blur: "rgba(250, 250, 248, 0.85)"
typography:
  display-xl:
    fontFamily: system-ui
    fontSize: clamp(32px, 5vw, 56px)
    fontWeight: "800"
    lineHeight: 1.1
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: system-ui
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-md:
    fontFamily: system-ui
    fontSize: 20px
    fontWeight: "700"
    lineHeight: 1.3
  title-lg:
    fontFamily: system-ui
    fontSize: 18px
    fontWeight: "700"
    lineHeight: 1.3
  title-md:
    fontFamily: system-ui
    fontSize: 17px
    fontWeight: "800"
    lineHeight: 1.3
    letterSpacing: -0.01em
  title-sm:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 1.3
  body-lg:
    fontFamily: system-ui
    fontSize: 19px
    fontWeight: "400"
    lineHeight: 1.6
  body-md:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 1.6
  body-sm:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.6
  label-lg:
    fontFamily: system-ui
    fontSize: 15px
    fontWeight: "700"
    lineHeight: 1.2
  label-md:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: "600"
    lineHeight: 1.2
  label-sm:
    fontFamily: system-ui
    fontSize: 12px
    fontWeight: "700"
    lineHeight: 1.2
    letterSpacing: 0.06em
    textTransform: uppercase
  label-xs:
    fontFamily: system-ui
    fontSize: 11px
    fontWeight: "700"
    lineHeight: 1.2
    letterSpacing: 0.04em
    textTransform: uppercase
  mono-md:
    fontFamily: ui-monospace
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.6
  mono-sm:
    fontFamily: ui-monospace
    fontSize: 12.5px
    fontWeight: "400"
    lineHeight: 1.6
  mono-xs:
    fontFamily: ui-monospace
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 1.3
rounded:
  xs: 0.25rem
  sm: 0.375rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.25rem
  xxl: 1.5rem
  pill: 1.25rem
  full: 9999px
spacing:
  unit: 8px
  xs: 2px
  sm: 4px
  md: 6px
  base: 8px
  lg: 12px
  xl: 14px
  xxl: 16px
  section: 20px
  card: 24px
  container: 32px
  hero: 40px
  nav-height: 56px
shadows:
  sm: 0 1px 2px rgba(0, 0, 0, 0.05)
  md: 0 4px 12px rgba(0, 0, 0, 0.08)
  lg: 0 8px 24px rgba(0, 0, 0, 0.10)
motion:
  duration-fast: 150ms
  duration-normal: 200ms
  duration-slow: 300ms
  duration-progress: 1200ms
  easing-standard: cubic-bezier(0.4, 0, 0.2, 1)
  easing-in: ease-in
  easing-out: ease-out
components:
  button-primary:
    backgroundColor: "{colors.accent-teal}"
    textColor: "{colors.white}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.lg}"
    padding: 12px 28px
  button-primary-hover:
    backgroundColor: "{colors.accent-teal-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    border: 1px solid {colors.border}
    padding: 7px 14px
  button-secondary-hover:
    backgroundColor: "{colors.surface-variant}"
  button-icon:
    backgroundColor: transparent
    textColor: "{colors.on-surface-tertiary}"
    rounded: "{rounded.md}"
    padding: 6px 12px
    border: 1px solid {colors.border}
  nav-bar:
    backgroundColor: "{colors.nav-blur}"
    height: "{spacing.nav-height}"
    backdropFilter: blur(12px)
    borderBottom: 1px solid {colors.border-light}
    padding: 0 24px
  input-url:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    border: 2px solid {colors.border}
    padding: 16px 12px
    boxShadow: "{shadows.lg}"
  card-elevated:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xxl}"
    border: 1px solid {colors.border}
    padding: "{spacing.container}"
    boxShadow: "{shadows.lg}"
  card-bordered:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    border: 1px solid {colors.border}
    padding: 14px 16px
  card-flat:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.lg}"
    border: 1px solid {colors.border}
    padding: 14px 16px
  severity-badge-sm:
    typography: "{typography.label-xs}"
    rounded: "{rounded.xs}"
    border: 1px solid
    padding: 2px 6px
  severity-badge-md:
    typography: "{typography.label-xs}"
    rounded: "{rounded.xs}"
    border: 1px solid
    padding: 3px 8px
  severity-badge-lg:
    typography: "{typography.label-xs}"
    rounded: "{rounded.xs}"
    border: 1px solid
    padding: 4px 10px
  badge-pill:
    backgroundColor: "{colors.accent-teal-light}"
    textColor: "{colors.accent-teal}"
    typography: "{typography.label-md}"
    rounded: "{rounded.pill}"
    padding: 6px 16px
  code-block:
    backgroundColor: "{colors.code-block-bg}"
    textColor: "{colors.code-block-text}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.md}"
    padding: 14px 16px
  grade-ring:
    size: 140px
    strokeWidth: 8px
    animationDuration: "{motion.duration-progress}"
  copy-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    border: 1px solid {colors.border}
    padding: 6px 12px
  copy-button-active:
    backgroundColor: "{colors.accent-teal}"
    textColor: "{colors.white}"
  feature-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    border: 1px solid {colors.border}
    padding: "{spacing.card}"
  pricing-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xxl}"
    border: 1px solid {colors.border}
    padding: "{spacing.container}"
    boxShadow: "{shadows.md}"
  pricing-card-highlighted:
    backgroundColor: "{colors.accent-teal-light}"
    border: 2px solid {colors.accent-teal}
    boxShadow: "{shadows.lg}"
  progress-bar:
    backgroundColor: "{colors.border-light}"
    accentColor: "{colors.accent-teal}"
    rounded: "{rounded.xs}"
    height: 6px
  scan-module-item:
    rounded: "{rounded.md}"
    padding: 8px 12px
  scan-module-item-active:
    backgroundColor: "{colors.accent-teal-light}"
---

## Brand & Style

VibeSafe is a **security scanner for AI-built websites**—designed for developers who build with Lovable, Bolt, v0, Cursor, or Replit. The brand personality is technical yet approachable, professional yet unpretentious. It embodies the philosophy of "security made simple": complex vulnerability analysis presented with clarity and actionable precision.

The design system centers on a **Clean Technical** aesthetic. It utilizes a warm neutral palette with carefully calibrated grays that feel modern without being cold. The interface prioritizes information density without clutter—every element serves a functional purpose. Visual hierarchy is achieved through weight, size, and subtle tonal shifts rather than heavy borders or dramatic shadows.

The emotional tone is **confident and trustworthy**. Security tools often feel intimidating or overly complex; VibeSafe counters this by using generous whitespace, clear typography, and progressive disclosure patterns. The user should feel empowered, not overwhelmed.

## Colors

The color strategy is built around **semantic precision** and **theme flexibility**. The base palette uses warm neutrals (off-white backgrounds, charcoal text) to create a comfortable, approachable foundation that doesn't fatigue the eyes during extended analysis sessions.

**Neutral Foundation:**
- **Background (`#FAFAF8`):** A subtle warm off-white that reduces screen glare compared to pure white
- **Surface (`#FFFFFF`):** Pure white for elevated cards and containers
- **Text Hierarchy:** Three levels of gray ensure clear information architecture without relying on bold weights alone

**Accent System:**
The design employs a **themeable accent** pattern with three pre-configured options (Teal, Indigo, Violet), allowing users to personalize their experience. Each accent includes three shades (main, light, dark) used consistently:
- **Main:** Primary actions, links, progress indicators
- **Light:** Backgrounds for highlighted content, badges, active states
- **Dark:** Hover states, darker interactive elements

**Semantic Colors:**
Security findings use a five-tier **severity palette** that maps directly to industry standards (CRITICAL, HIGH, MEDIUM, LOW, INFO). Each severity level includes three values:
- **Color:** Text and icons
- **Background:** Badge fills, card highlights
- **Border:** Subtle edge definition

Grade ratings (A-F) use a **traffic light progression** from emerald green (excellent) through teal, amber, orange, to rose (failing). These colors are carefully calibrated to remain accessible while providing instant visual feedback.

**Code Evidence:**
All code snippets use a **dark syntax theme** (`#1a1a2e` background with `#e2e8f0` text) to provide high contrast and developer familiarity, even within the light interface.

## Typography

VibeSafe uses **system font stacks** for optimal performance and native OS integration. The primary stack resolves to San Francisco on macOS/iOS, Segoe UI on Windows, and Roboto on Android—ensuring familiar, platform-optimized rendering.

**Hierarchy & Scale:**
The type system employs a **modular scale** with clear semantic naming:
- **Display XL:** Hero headlines with fluid sizing (`clamp(32px, 5vw, 56px)`) for responsive hero sections
- **Headlines:** Three sizes (lg, md, sm) for section headers and card titles
- **Body Text:** Two sizes (md, sm) with generous 1.6 line-height for readability
- **Labels:** Four weights for UI elements, buttons, and metadata

**Weight Strategy:**
Hierarchy is achieved primarily through **weight variation** rather than size alone. Display and headline styles use 700-800 weights; labels use 600-700 for affordance; body text remains at 400 for comfortable reading.

**Monospace Application:**
Technical content (URLs, code evidence, file paths) uses a **monospace stack** (`ui-monospace` → SF Mono → Consolas) to maintain alignment and developer familiarity. Monospace text is rendered at slightly smaller sizes (12-14px) to match the perceived size of proportional text.

**Letter Spacing:**
Tight tracking (`-0.02em` to `-0.01em`) is applied to large display text to improve optical balance. Small labels use positive tracking (`0.04em` to `0.06em`) with uppercase transformation for clarity and visual separation.

## Layout & Spacing

The layout follows a **content-first** model with a strict 8px base grid. All spacing values are multiples of the base unit, creating a consistent vertical rhythm and predictable component sizing.

**Spatial Hierarchy:**
- **Container Padding:** 32px for major content blocks
- **Card Padding:** 24px for elevated cards
- **Section Margins:** 40px vertical spacing between major sections
- **Component Gaps:** 12-16px for related elements

**Responsive Strategy:**
The system uses **fluid sizing** for typography and **max-width containers** for content. The hero input component uses `clamp()` for typography to scale smoothly across viewports without breakpoint jumps. Cards use `auto-fit` grids with minimum widths rather than fixed columns.

**Whitespace Philosophy:**
VibeSafe employs **generous negative space** to combat the inherent density of security reports. Finding cards include substantial internal padding (14-16px) and inter-card gaps (20-28px) to create breathing room and reduce cognitive load.

## Elevation & Depth

Depth is achieved through **subtle shadows** and **tonal layering** rather than dramatic drop shadows. The system uses three shadow levels, all with warm, diffused blur:

**Shadow System:**
- **Small (`sm`):** Minimal lift for subtle interactive feedback (1px offset, 2px blur)
- **Medium (`md`):** Standard cards and modals (4px offset, 12px blur)
- **Large (`lg`):** Hero elements and focal points (8px offset, 24px blur)

All shadows use **low opacity black** (5-10%) to maintain subtlety. Heavy shadows are avoided to preserve the clean, technical aesthetic.

**Surface Layers:**
The interface operates on three elevation planes:
1. **Background (`#FAFAF8`):** The base canvas
2. **Surface (`#FFFFFF`):** Elevated cards, modals, input fields
3. **Nav Overlay (`rgba(250, 250, 248, 0.85)`):** Fixed navigation with backdrop blur

**Blur Effects:**
The navigation bar uses `backdrop-filter: blur(12px)` to create a frosted glass effect, allowing content to show through while maintaining legibility. This reinforces the sense of layering without requiring solid backgrounds.

## Shapes

The shape language is defined by **soft, approachable curves** that balance professionalism with accessibility. Border radii are calibrated to feel modern without appearing toy-like.

**Radius Scale:**
- **Extra Small (`4px`):** Badges, small pills, progress bars
- **Default/Medium (`8-12px`):** Buttons, input fields, standard cards
- **Large/Extra Large (`16-24px`):** Hero containers, modal dialogs, pricing cards
- **Pill (`20px`):** Badge elements, status indicators
- **Full (`9999px`):** Circular icons, avatars, dot indicators

**Component Application:**
- **Hero URL Input:** Uses `14px` radius to feel substantial and inviting
- **Finding Cards:** Use `12px` for a professional, containerized appearance
- **Buttons:** Primary actions use `10px`; secondary use `8px` for subtle differentiation
- **Severity Badges:** Use minimal `4px` radius to feel compact and data-focused

**Icon Treatment:**
All icons use **rounded line caps** (24px stroke icons with 2px weight) to harmonize with the soft geometric language of the interface.

## Motion & Animation

Animation is used **sparingly and purposefully** to provide feedback and guide attention. All motion follows consistent timing and easing curves.

**Duration System:**
- **Fast (150ms):** Micro-interactions, hover states, button presses
- **Normal (200ms):** Standard transitions, color changes
- **Slow (300ms):** Screen transitions, complex state changes
- **Progress (1200ms):** Grade ring animation, data visualization

**Easing Curves:**
- **Standard (`cubic-bezier(0.4, 0, 0.2, 1)`):** Most transitions use Material Design's standard curve
- **Ease-out:** Screen entrance animations
- **Ease-in:** Exit animations

**Purposeful Animation:**
1. **Grade Ring:** Animated stroke-dashoffset creates a satisfying reveal of the security grade
2. **Screen Entrance:** Fade-in with 8px upward translation for page transitions
3. **Progress Bar:** Smooth width transitions during scan execution
4. **Copy Feedback:** Background color shift and icon swap on successful copy

**Performance Constraints:**
All animations use GPU-accelerated properties (`transform`, `opacity`) and avoid layout-triggering changes for 60fps performance.

## Components

### Buttons & Interactive Elements

Buttons employ a **two-tier hierarchy** (primary and secondary) with distinct visual treatments:

**Primary Button:**
- Solid accent background with white text
- 12-28px padding for substantial click target
- 10px border radius for soft, approachable feel
- Hover state uses the darker accent variant

**Secondary Button:**
- White background with 1px border
- Accent or muted text color
- Smaller padding (7-14px) for lighter visual weight
- Hover shifts to light gray background

**Copy Button:**
- Specialized component with two states
- Inactive: Bordered white with muted text
- Active: Solid accent with white text and checkmark icon
- 2-second auto-reset after successful copy

### Cards & Containers

Cards come in three style variants (elevated, bordered, flat) to support different UI contexts:

**Elevated Card:**
- Pure white background
- 1px border with medium shadow
- Used for hero report header, pricing cards

**Bordered Card:**
- White or surface background
- Border color can be semantic (severity-specific)
- No shadow, used for finding cards

**Flat Card:**
- Background-tinted surface
- Minimal border, no shadow
- Used for secondary content blocks

### Finding Cards

The core component for displaying security vulnerabilities includes:
- **Collapsible header** with severity badge, title, and location
- **Expandable detail sections:** Evidence (code block), explanation, impact, fix instructions
- **Tabbed fix interface:** Toggle between manual steps and AI prompt
- **Semantic border option:** Border color matches severity for visual scanning

### Input Fields

The hero URL input is a **compound component** combining:
- Icon prefix (globe icon in muted color)
- Text input with transparent background
- Integrated primary action button
- 2px border with large shadow for visual prominence
- 14px border radius for substantial, welcoming feel

### Severity Badges

Small, dense components with three size variants (sm, md, lg). All badges include:
- Uppercase label text with positive letter-spacing
- Semantic background, text, and border colors
- Minimal 4px border radius
- Compact padding (2-4px vertical, 6-10px horizontal)

### Grade Display

The signature component appears in three style variants:
1. **Ring (default):** Animated circular progress indicator with centered letter grade
2. **Shield:** Security badge icon with overlaid grade
3. **Letter:** Circular badge with solid background

All variants use the semantic grade colors and include a text label ("Excellent", "Good", "Fair", "Poor", "Failing").

### Progress & Status Indicators

**Progress Bar:**
- 6px height with 3px border radius
- Light gray background with accent fill
- Smooth width transitions (300ms)

**Module Status Icons:**
- Checkmark (success, green)
- Alert circle (findings detected, severity-based color)
- Spinner (active scan)
- Dot (pending, gray)

**Status Badges:**
- Pill-shaped with accent background
- Used for "Passive scan" and feature callouts
- 6-16px padding with 20px border radius

### Navigation Bar

Fixed-position component with:
- 56px height (consistent touch target)
- Frosted glass effect (backdrop blur + translucent white)
- 1px bottom border for subtle separation
- Left-aligned logo, right-aligned actions
- 24px horizontal padding

### Code Blocks

Technical evidence display with:
- Dark background (`#1a1a2e`) for high contrast
- Light text (`#e2e8f0`) for readability
- Monospace font stack
- 14-16px padding
- 8px border radius
- Syntax wrapped (`pre-wrap`) for mobile

## Accessibility

**Color Contrast:**
All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text). Severity colors are calibrated to maintain legibility against their paired backgrounds.

**Focus States:**
Interactive elements include visible focus indicators using the accent color with appropriate contrast.

**Motion Respect:**
Animations honor `prefers-reduced-motion` where critical (implementations should add this in production).

**Semantic Structure:**
Components use appropriate HTML5 semantic elements and ARIA attributes where needed (buttons are `<button>`, links are `<a>`, etc.).

## Design Philosophy

VibeSafe's design system embodies **clarity through simplicity**. Every token, component, and pattern serves the core mission: making security findings understandable and actionable for developers who may not be security experts.

The system prioritizes **information architecture** over decoration. Colors carry meaning (severity, grade, status); typography establishes hierarchy; spacing provides rhythm and breathing room. Ornamental elements are avoided in favor of functional precision.

The **themeable accent system** acknowledges that developers have preferences, allowing personalization without compromising the core information design. The system remains consistent and professional regardless of accent choice.

Finally, the design respects the **developer's mental model**. Monospace code blocks, familiar syntax highlighting, and industry-standard severity terminology create a sense of trust and competence—this tool was built by developers, for developers.

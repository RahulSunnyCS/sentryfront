# VibeSafe Design System Documentation

This directory contains the complete design system specification for **VibeSafe**, a security scanner for AI-built websites.

## 📁 Files Overview

### `DESIGN.md` (Main Specification)
The canonical design system file following the [design.md spec](https://github.com/google-labs-code/design.md) by Google Stitch.

**Structure:**
- **YAML Frontmatter** (lines 1-294): All design tokens in machine-readable format
  - Colors (neutrals, accents, grades, severity, code)
  - Typography (14 text styles with full properties)
  - Border radii (8 sizes)
  - Spacing (12 levels)
  - Shadows (3 elevations)
  - Motion (durations & easing)
  - Components (30+ component specs)

- **Markdown Documentation** (lines 295-567): Comprehensive design narrative
  - Brand & Style philosophy
  - Color strategy & usage
  - Typography system & hierarchy
  - Layout & spacing principles
  - Elevation & depth techniques
  - Shape language
  - Motion guidelines
  - Component patterns
  - Accessibility standards
  - Design philosophy

### `DESIGN_SUMMARY.txt` (Quick Reference)
Plain text summary optimized for quick scanning and copy/pasting. Contains:
- Brand identity overview
- Complete color palette with hex values
- Typography scale
- Layout measurements
- Shadow values
- Component specifications
- Design principles
- Technical implementation notes

### Interactive Diagrams
Two Mermaid diagrams visualizing the design system structure:
1. **System Architecture**: Shows the hierarchy from foundation → patterns → components → themes
2. **Color System**: Maps the relationship between neutrals, accents, grades, and severity levels

## 🎨 Design System Summary

### Core Philosophy
**"Security made simple"** — Technical precision without intimidation

### Aesthetic
**Clean Technical** — Professional, approachable, developer-focused

### Color Strategy
- **Neutrals**: Warm grays on off-white canvas (#FAFAF8)
- **Themeable Accents**: Teal (default), Indigo, Violet
- **Semantic Colors**: 
  - Grades A-F (traffic light progression)
  - 5 severity levels (CRITICAL → INFO)
  - Dark code blocks for technical content

### Typography
- **Font Stack**: System UI fonts for native feel
- **Scale**: 14 defined styles from 11px labels to fluid 56px displays
- **Monospace**: Dedicated stack for code, URLs, file paths

### Spacing
- **Base Grid**: 8px unit system
- **Key Values**: 
  - Container: 32px
  - Card: 24px
  - Section: 40px
  - Nav: 56px height

### Components
30+ fully-specified components including:
- Buttons (primary, secondary, icon)
- Cards (elevated, bordered, flat)
- Finding cards (collapsible, tabbed)
- Grade display (ring, shield, letter)
- Severity badges (3 sizes)
- Navigation bar (frosted glass)
- Code blocks (dark theme)
- Progress indicators

## 🔧 Usage

### For Designers
1. **Read** `DESIGN.md` for complete context and rationale
2. **Reference** YAML tokens for exact values
3. **Use** component specs as Figma/Sketch blueprints

### For Developers
1. **Import** design tokens from YAML frontmatter
2. **Map** to CSS custom properties (already implemented in `src/app/globals.css`)
3. **Reference** component specs for implementation details

### For Stakeholders
1. **Review** `DESIGN_SUMMARY.txt` for quick overview
2. **View** interactive diagrams for visual understanding
3. **Read** design philosophy section in `DESIGN.md`

## 🎯 Key Decisions

### Why System Fonts?
Performance and native OS integration. Users get familiar, platform-optimized rendering.

### Why Themeable Accents?
Developers have preferences. Three accent options provide personalization without compromising consistency.

### Why Warm Neutrals?
Pure white (#FFFFFF) fatigues eyes during extended use. Off-white background (#FAFAF8) reduces glare while maintaining professionalism.

### Why Semantic Colors?
Security findings require instant visual feedback. Color-coded severity levels (CRITICAL=red, INFO=gray) leverage universal mental models.

### Why Dark Code Blocks?
Developers expect dark syntax highlighting. Even in a light interface, code snippets use dark theme for familiarity and contrast.

### Why Generous Spacing?
Security reports are inherently dense. Whitespace creates breathing room, reduces cognitive load, and maintains premium feel.

## 📊 Design Token Stats

- **Colors**: 49 semantic tokens
- **Typography**: 14 text styles
- **Spacing**: 12 levels
- **Radii**: 8 sizes
- **Shadows**: 3 elevations
- **Components**: 30+ specifications
- **Motion**: 4 durations, 3 easings

## 🔗 References

- **Spec Format**: [design.md by Google Stitch](https://stitch.withgoogle.com/docs/design-md/overview/)
- **Implementation**: See `src/app/globals.css`, `tailwind.config.ts`, and component files in `src/components/`
- **Examples**: Color usage in `src/lib/data.ts`, component patterns throughout `src/`

## 📝 Maintenance

This design system is **living documentation**. Update when:
- Adding new components
- Introducing color variants
- Changing typography scale
- Modifying spacing system
- Updating motion patterns

**Process:**
1. Update YAML tokens in `DESIGN.md`
2. Update narrative sections if philosophy changes
3. Regenerate `DESIGN_SUMMARY.txt` if major changes occur
4. Keep implementation (CSS) in sync with tokens

---

**Last Updated**: 2026-05-10  
**Version**: 1.0  
**Maintained By**: VibeSafe Team

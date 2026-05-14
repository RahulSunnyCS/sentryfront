# Design mockups

This directory holds **standalone HTML reference designs**. They are *not* shipped code — the running application is in `src/app/`.

These files exist as design fidelity targets — single-page HTML that captures the visual + interaction intent of a feature before it's built (or rebuilt) in Next.js. When the corresponding React page in `src/app/` diverges from the mockup, the mockup is the source of truth for the design intent, not the React code's current state.

## Files

| File | Corresponding shipped route | Notes |
|------|------|------|
| `vibesafe-demo.html` | `/` (landing) and `/report/[id]` (report view) | The big one. 4,000+ lines covering the marketing hero, feature blocks, and a full sample report layout. The shipped landing in `src/app/landing-hero.tsx` and the report view in `src/app/report/[id]/report-view.tsx` derive from this. |
| `verify-domain.html` | `/verify` | Reference for the domain-verification flow. The shipped flow is `src/app/verify/verify-flow.tsx`. |
| `report-design.html` | The generated PDF (not a page) | Print-styled mockup for the PDF a user downloads from `/report/[id]`. Paginated A4 layout with running header/footer, cover page, executive summary, scope, full findings, passed checks, next steps, glossary, and attestation. Sample data is a C-grade scan of the fictional `taskflow.app`. Drives the print CSS in `src/app/globals.css` and the document structure rendered by the report view when printed. |

## Editing rules

- **Mockups are reference, not source of truth for the running app.** If a mockup and the React code disagree, file an issue describing which one is correct, then update the other to match.
- **Don't link to these files from the running app.** They're not served — Next.js only serves `/public/`. If you need to view one, open the file directly from your editor or via `file://`.
- **No customer data.** These are design files; sample data should be fictional (e.g. `taskflow.app`).

## History

These files were checked into the repo root from an earlier design phase. Moved into `/design/` on 2026-05-14 as part of `BUILD_PHASE.md` Phase 2.5 §2.5.2 (artifact integrity).

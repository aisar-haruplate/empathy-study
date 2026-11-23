# Empathy Study Workspace Typography & Reading Scale Upgrade

Upgrade the typographic pairing, reading scale, line spacing, empty-state presentation, and Blush/Rose button hierarchy across the Empathy Study workspace body, transcripts, coding cards, and synthesis views while leaving the top navigation header and its handwritten tagline untouched.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> All Phase 1 typographic preferences have been confirmed and lock the exact font pairing, scale floor, and line spacing below.

- **Confirmed Body Font Pairing**: Pair **Outfit** (`600`–`700`, tight `-0.02em` tracking) for workspace headings with **Inter** for high-legibility body copy, transcripts, coding cards, empty states, and data tables.
- **Confirmed Workspace Scale Floor**: Apply **16px** (`text-base`) uniformly across body copy, transcripts, queue items, coding cards, and synthesis tables, paired with **18px–20px** lead/empty-state prompts and a **13px minimum** (`text-[13px]`) for all readable labels, metadata chips, and action buttons.
- **Confirmed Line Spacing**: Enforce a relaxed **1.65 line-height** (`leading-[1.65]` / `leading-relaxed`) on transcripts, research notes, coding card quotes, and descriptions for comfortable long-form reading.
- **Top Header Freeze**: Preserve the existing top header bar, navigation tabs, and `"human stories, thoughtfully decoded"` handwritten script tagline (`Reenie Beanie`) with zero layout or font changes.

---

### 1. Overview & Core Concept

- **What It Does**: Establishes a two-font editorial reading system inside the Empathy Study workspace—combining crisp **Outfit** section/card headings with **Inter** 16px body prose and 1.65 line spacing—while raising all readable micro-labels to at least 13px and confirming clean sans-serif rendering on every empty state.
- **Target Audience / Persona**: Qualitative nutrition researchers reading lengthy multilingual interview transcripts, verifying ADKOTM coding evidence, and scanning cross-analysis synthesis tables for extended sessions.
- **Key Value**: Eliminates visual fatigue from cramped `12px–14px` transcript lines and sub-13px micro-labels, creates immediate hierarchy between Outfit titles and Inter prose, and keeps the top studio header familiar and untouched.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Header & Navigation**: Entering any workflow step (`1. Transcribe`, `2. Clean Text`, `3. Decode Themes`, `4. Cross-Analysis`) shows the exact existing top bar, active charcoal pill, AI Copilot button, and `"human stories, thoughtfully decoded"` tagline in its original `Outfit` + `Reenie Beanie` styling.
  2. **Intake & Transcript Cleaning**: Session cards, upload prompts, raw/cleaned transcript panes, and inline transcript editors display `Outfit` headings and `16px / 1.65` `Inter` dialogue turns, with `13px+` badges and `tabular-nums` timestamps/word counts.
  3. **Review Workspace & Copilot Coding Sheet**: The triage queue, highlighted transcript viewer, floating crop/edit popovers, and coding cards render in `16px / 1.65` `Inter` (with `18px` clean sans-serif empty-state prompts such as *"No transcript text available for this record yet"* and *"Let AI stage ADKOTM parameters with verbatim evidence quotes"*), anchored by **Blush Pink (`#F6BEBA` / `#292524`)** primary CTAs (`Auto-Tag All`, `Run Copilot Draft`, `Verify & Next Interview`).
  4. **Synthesis Analytics & Cross-Analysis**: ADKOTM breakdown cards, theme insight cards, summary tables, Klang Valley map drawers, and cross-analysis formula workspaces use `Outfit` card headers, `16px` table/card prose, `13px+` legend/axis labels, and `tabular-nums` metrics.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Warm Tactile Editorial Studio—calm paper surfaces with generous vertical breathing room for dense qualitative transcripts.
  - *Color Palette & Mood*: Warm paper canvas (`--bg-canvas: #FDFCF8`), pure card surfaces (`#FFFFFF`), warm stone header strips (`#F7F5F0`), hairline borders (`#EAE6DF`), Soft Charcoal primary ink (`#292524`), Warm Slate secondary ink (`#57534E`), **Blush Pink (`#F6BEBA`)** with `#292524` ink for primary CTAs, and **Deeper Rose (`#D97A75`)** for destructive/error states (`Delete Session`, failed transcription banners).
  - *Typography & Hierarchy*:
    - **Top Header (Frozen)**: Retains `Outfit` UI labels and `Reenie Beanie` (`font-hand`) tagline unchanged.
    - **Workspace Headings (`--font-heading`)**: `Outfit` (`600`–`700`, `tracking-[-0.02em]`) across step titles (`20px–24px`), card/panel headers (`18px–20px`), and modal titles.
    - **Workspace Body & Transcripts (`--font-sans`)**: `Inter` at `16px` (`text-base`, `leading-[1.65]`) across transcripts, queue items, coding card values/quotes, table cells, and instructions; `18px–20px` (`text-lg`) for empty-state/lead prompts; `13px` (`text-[13px]`) strict floor for readable labels, badges, and buttons; `tabular-nums` on numeric counters and timestamps.
  - *Component Styling & Layout*: Maintain rounded studio containers (`rounded-2xl` / `rounded-3xl`), hairline borders, zero-pill restraint on long labels, and `whitespace-nowrap shrink-0` on action buttons and tabs so larger 13px–16px typography never clips or wraps awkwardly.

- **Interactive Feedback & Motion**:
  - Preserve existing hover highlights on transcript spans, focus rings (`#528BCA`), span-cropping handle feedback, and loading spinners with larger, clearer status messages and non-cursive empty states.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Header-Isolated Font Scoping vs. Global CSS Token Swap**
  - *Chosen Approach*: Load `Inter` alongside `Outfit` and `Reenie Beanie`, assign `--font-sans` to `Inter` and `--font-heading` to `Outfit` for the workspace and modals, and explicitly bind the `<header>` region to `Outfit` (keeping `.font-hand` intact on the tagline).
  - *Why*: Guarantees the top header renders identically without editing the header markup, while every workspace view, drawer, and modal inherits the `Outfit` + `Inter` pairing automatically.
  - *Alternatives Considered*: Keeping `Outfit` as `--font-sans` and manually adding `font-inter` to dozens of components—rejected because modals, inputs, and nested views could easily miss the override.

- **Decision 2: Strict 13px Label Floor & 16px Uniform Body Scale**
  - *Chosen Approach*: Upgrade all sub-13px readable body labels (`text-[10px]`, `text-[11px]`, `text-xs` / `12px`) inside workspace views and modals to at least `13px` (`text-[13px]`), and standardize prose, queue rows, coding card content, and table cells to `16px` (`text-base`) with `1.65` line-height.
  - *Why*: Directly fulfills the confirmed legibility preference across dense cards and queues without needing multi-tier exceptions; paired with slightly roomier card padding and `whitespace-nowrap shrink-0` guards on compact toolbars/queues so nothing overflows.
  - *Alternatives Considered*: Restricting `16px` only to transcripts—rejected per the confirmed uniform `16px` body choice.

- **Decision 3: Clean Sans-Serif Empty States & Blush/Rose Hierarchy Audit**
  - *Chosen Approach*: Audit every empty-state block and action button across all four modules and modals to verify zero cursive/script (`font-hand`) remains in the body, ensure empty states use `18px–20px` clean `Inter` copy, and confirm `#F6BEBA` / `#292524` Blush CTAs and `#D97A75` Rose error/destructive actions are consistent everywhere.
  - *Why*: Eliminates lingering micro-text or stark red accents in secondary drawers/modals that are easy to overlook during partial sweeps.

---

### 4. Technical Architecture & Data Strategy

- **Typography Scoping & View Hierarchy**:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Document Root (Google Fonts: Outfit + Inter + Reenie Beanie)         │
├──────────────────────────────────────────────────────────────────────┤
│ <header> [FROZEN]                                                    │
│  ├─ Explicitly bound to Outfit + Reenie Beanie tagline               │
│  └─ Zero markup or styling changes                                   │
├──────────────────────────────────────────────────────────────────────┤
│ Workspace Canvas & Sibling Modals / Drawers                          │
│  ├─ Base Body Font: Inter (16px / line-height 1.65)                  │
│  ├─ Heading Utility & h1–h4: Outfit (600–700, tracking -0.02em)      │
│  ├─ Minimum Readable Label / Chip Floor: 13px (tabular-nums metrics) │
│  ├─ Lead & Empty-State Prompts: 18px–20px clean Inter                │
│  └─ Action Tokens: Blush Pink (#F6BEBA) CTAs · Rose (#D97A75) Alerts│
└──────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**: Purely presentational typographic, CSS token, and layout refinement—zero changes to interview record schemas, ADKOTM decoding state, Firebase persistence, or API routes.
- **Interactive Component & State Mapping**:
  - *Step 1 Intake & Cards*: Upgrade session headers (`Outfit`), audio/transcript text (`16px / 1.65 Inter`), duplicate/error alerts (`#D97A75`), and metadata labels (`>= 13px`).
  - *Step 2 Data Cleaning*: Upgrade raw/cleaned transcript panels, cleaning rule toggles, and pronoun badges to `16px / 1.65 Inter` with `Outfit` headers and `>= 13px` labels.
  - *Step 3 Review & Synthesis*: Upgrade triage queue items, interactive transcript span viewer, crop/edit popovers, Copilot coding cards, empty states, and ADKOTM analytics/tables/maps to `Outfit` headings, `16px / 1.65` prose, `>= 13px` chips, and `#F6BEBA` CTAs.
  - *Step 4 Cross-Analysis & Modals*: Upgrade formula cards, insight evaluations, summary tables, AI Assistant drawer, and all secondary modals (`>= 13px` minimum label floor, `16px` body copy, `Outfit` titles).
- **Verification Plan**: After implementation, audit the workspace via codebase search to confirm zero `font-hand` occurrences and zero `< 13px` readable body text outside the frozen header, and verify clean TypeScript compilation and lint checks.

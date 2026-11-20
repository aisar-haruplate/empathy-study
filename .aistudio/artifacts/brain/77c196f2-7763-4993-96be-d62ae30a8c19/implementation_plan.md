# Unified ADKOTM Dimension Breakdown Plan

## Goal
Simplify **ADKOTM Dimension Breakdown** into a single consolidated view by removing the `Consolidated` vs. `Average per Recording` toggle, adding distinct interview coverage metrics (`in X/N interviews`) to every dimension card and detail panel, and keeping narrow stacked bar segments legible.

---

## Layout & Component Structure

```
+----------------------------------------------------------------------------------+
| %  ADKOTM Dimension Breakdown  [ADKOTM Taxonomy]              [ Theme Insights ->]|
|    Consolidated distribution across all {S} empirical qualitative signals from   |
|    {N} verified interviews.                                                      |
+----------------------------------------------------------------------------------+
| [ O 34.4%       ][ A 25.6%   ][ K 11.1% ][ D 10.0% ][ 7.8% ][ 11.1% ]  (100% Bar)|
|   >= 8%: "O 34.4%" | 4%..8%: "7.8%" | < 4%: hidden inline (full hover tooltip)   |
+----------------------------------------------------------------------------------+
| +---------------+ +---------------+ +---------------+ +-----------+ +----+ +---+ |
| | O Objects...  | | A Activities..| | K Knowledge.. | | D Demo... | | T  | | M | |
| | 34.4%         | | 25.6%         | | 11.1%         | | 10.0%     | | .. | | ..| |
| | (31 signals)  | | (23 signals)  | | (10 signals)  | | (9 sigs)  | |    | |   | |
| | [in 6/10 int] | | [in 8/10 int] | | [in 4/10 int] | | [in 5/10] | |    | |   | |
| +---------------+ +---------------+ +---------------+ +-----------+ +----+ +---+ |
+----------------------------------------------------------------------------------+
| [Core Ratio] Object (O: 34.4%) vs Activity (A: 25.6%) — ...                      |
+----------------------------------------------------------------------------------+
| Active Dimension Deep Dive                                                       |
| Objects & Products (34.4% of all pooled signals)   31 Signals • 6/10 Interviews  |
+----------------------------------------------------------------------------------+
```

---

## Design & Functional Changes

### 1. Unified Header & Cleanup
- Remove the `Consolidated` | `Average per Recording` segmented toggle from the top-right header while keeping the **Theme Insights →** button aligned on the right.
- Standardize the subtitle to: `Consolidated distribution across all {totalSignals} empirical qualitative signals from {totalInterviews} verified interviews.`
- Remove all unused average-mode state variables and per-recording averaging calculations so the breakdown runs on a single consolidated dataset.

### 2. Distinct Interview Coverage Calculation & 6-Card Grid
- For each dimension (`O`, `A`, `K`, `D`, `T`, `M`), compute the distinct count of verified interviews containing at least one signal in that dimension (`interviewCount / totalInterviews`).
- Update all six dimension cards to display:
  - **Primary metric:** `{pct}%` alongside `({count} signals)` in `tabular-nums`.
  - **Secondary coverage pill:** A subtle pill badge (`in {interviewCount}/{totalInterviews} interviews`) positioned directly beneath the primary metric.

### 3. Stacked Bar Threshold Labels & Hover Tooltip
- Enforce clean segment labeling on the horizontal 100% stacked bar:
  - `>= 8%`: render `{code} {percentage}%`
  - `4%` to `< 8%`: render compact `{percentage}%`
  - `< 4%`: hide inline text to prevent clipping
- Provide full context on hover tooltip for every segment: `{Dimension Name} [{code}] • {percentage}% ({signalCount} signals across {interviewCount}/{totalInterviews} interviews)`.

### 4. Core Ratio Callout & Detail Panel Sync
- Keep the **Core Ratio** summary banner updated with consolidated Object vs. Activity share, signal counts, and interview coverage counts.
- Sync the selected dimension detail panel below to show `{Dimension Full Name} ({pct}% of all pooled signals)` paired with `{signalCount} Signals • {interviewCount}/{totalInterviews} Interviews`.

---

## Verification Plan
- **Calculation Tests:** Update unit tests to verify consolidated pooled signal shares and distinct interview coverage counts across dimensions.
- **Build & Type Check:** Run production compilation and TypeScript validation with zero warnings or errors.
- **Visual Verification:** Inspect the header, stacked bar segment thresholds (`>= 8%`, `4–8%`, `< 4%`), 6 dimension coverage pills, Core Ratio callout, and detail panel alignment.

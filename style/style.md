# style — build good, non-generic, usable UI

A comprehensive, reusable set of design principles and UX patterns for building highly functional, intuitive web applications. These principles are **brand-agnostic** and applicable to any domain.

> Throughout, **"the prompter"** = the person directing the build (you, or your user).

> **Relationship to your brand guide:** This guide governs *how* to build good UI —
> interaction patterns, behaviors, structure, spacing, motion mechanics, and
> light/dark plumbing. It does **not** choose colors, fonts, or logos. Wherever this
> guide says "accent," "primary color," "display font," etc., pull the actual value
> from your own brand skill. Never invent or substitute a brand's palette or
> typefaces — that decision belongs to the brand.

OBJECTIVE: Generate distinctive, high-quality, and non-generic frontend interfaces.
CORE PHILOSOPHY: Fight "Model Collapse" and "AI Slop." Do not converge on average, safe, or generic designs. Prioritize creativity, surprise, and the active brand's specific aesthetic intent over safe defaults.

## Table of contents

- [0. Mandatory operational rules](#0-mandatory-operational-rules)
- [1. Data entry & editing patterns](#1-data-entry--editing-patterns)
- [2. Auto-save & state persistence](#2-auto-save--state-persistence)
- [3. Tables & data display](#3-tables--data-display)
- [4. Navigation & layout](#4-navigation--layout)
- [5. Feedback & system status](#5-feedback--system-status)
- [6. Forms & validation](#6-forms--validation)
- [7. Media & file handling](#7-media--file-handling)
- [8. Empty states & edge cases](#8-empty-states--edge-cases)
- [9. Accessibility & usability defaults](#9-accessibility--usability-defaults)
- [10. Visual hierarchy & consistency](#10-visual-hierarchy--consistency)
- [11. Filters & search](#11-filters--search)
- [12. Links & external resources](#12-links--external-resources)
- [13. Multi-select & assignment](#13-multi-select--assignment)
- [14. Progressive disclosure](#14-progressive-disclosure)
- [15. Responsive design](#15-responsive-design)
- [16. Generated documents & exports](#16-generated-documents--exports)
- [17. Dates & times](#17-dates--times)
- [18. Export & copy-to-clipboard actions](#18-export--copy-to-clipboard-actions)
- [Applying this guide](#applying-this-guide)

---

## 0. Mandatory operational rules

1. **Universal Theming:** ALL outputs MUST implement a functional Light/Dark mode toggle. Use CSS variables for all color tokens, sourcing the actual values from your own brand skill.
2. **Creative Formatting:** Never output bare-bones HTML. Every element must be styled intentionally to match the brand's aesthetic.
3. **Single-File Architecture:** (If applicable to the specific framework requested) Keep code self-contained.
4. **Avoid annoyance:** The experience and the look-and-feel should never take away from the content. Constant animations, flashing lights, challenging contrast, etc., should never be used.
5. **Mobile:** Everything should be responsive and work equally well on mobile and desktop. Ensure text isn't truncated, input fields are legible, and labels are visible.
6. **Delight:** While the focus must be on delivering value to the end user, we should include moments of delight that permeate the product. This could be color, imagery, typeface, iconography, voice/style, animation, or other aspects.
7. **Share:** Great products deserve to be seen! Make sure there are the necessary OpenGraph tags so that a link to the site expands properly with a description and an image, across all major sharing platforms (Facebook, Twitter, LinkedIn, Bluesky, Threads, Slack, Discord).

## 1. Data entry & editing patterns

### Inline Editing Over Modal Forms

- Make data cells directly editable by clicking on them. Avoid forcing users into a separate "edit mode" or "edit page" for simple field changes.
- Display the current value as static text. When clicked, transform the display into an input. When focus leaves the field (blur) or the user presses Enter, commit the change.
- Pressing Escape always cancels the edit and reverts to the previous value.
- Never require a separate "Save" button for individual field edits in table/list contexts.

### Input Type Specialization

- Provide purpose-built input experiences per data type:
  - **Text**: Click-to-edit div that becomes an input on focus. Display state allows text wrapping; edit state is single-line.
  - **Number**: Numeric input with optional prefix display (currency symbol), min/max constraints, and decimal precision control. Provide tactile feedback (shake animation) for invalid values.
  - **Select**: Hidden native select overlaid by a custom display component. Show the styled output (badges, icons) while retaining native accessibility.
  - **Checkbox**: Toggle icon (checkmark/dash) that responds to a single click. No label needed when context is provided by a column header.
  - **Member/Entity Select**: Portal-positioned dropdown with avatars and names. Auto-detect available screen space (up vs. down) to avoid clipping.

### Keyboard-First Editing

- Enter commits edits across all input types.
- Escape cancels edits and restores prior value.
- Tab moves to the next editable field (use native browser behavior).
- For dropdowns and selects, support arrow key navigation.

### Edit Affordances

- Show a subtle bottom border on hover to signal editability without cluttering the default view.
- Use cursor changes (pointer on hover, text on focus) to communicate interaction states.
- For entity icons and images, overlay a pencil/edit icon on hover with a semi-transparent backdrop.

---

## 2. Auto-save & state persistence

### Debounced Background Persistence

- Auto-save changes after a short debounce delay (400-600ms of inactivity). Never require the user to manually trigger a save for inline edits.
- Batch rapid consecutive edits into a single persistence call.
- Provide a `flushPending()` mechanism that triggers an immediate save on blur or component unmount to prevent data loss.

### Save State Feedback

- Display a non-intrusive save indicator with three states:
  - **Idle**: Hidden (default state; nothing to communicate)
  - **Saving**: Spinner with "Saving..." text
  - **Saved**: Checkmark with "Saved" text, auto-reverts to idle after ~1.2 seconds
- Place the save indicator near the editing context (inside modals/drawers, adjacent to form sections).
- Never block the UI during save operations.

### Refetch After Mutations

- After create, update, or delete operations, refetch the relevant data to ensure UI consistency with server state.
- For operations where immediate feedback matters (image upload, title change), update local state optimistically while refetching in the background.

---

## 3. Tables & data display

### Sortable Column Headers

- Make all data columns sortable by clicking the column header.
- Show a clear directional indicator (chevron up/down) next to the active sort column.
- Show a neutral indicator (up-down chevrons) on sortable but inactive columns.
- Toggle sort direction on repeated clicks of the same column. Clicking a different column resets direction to ascending.
- Default sort order should reflect the most useful view: newest-first (Created descending) for activity-driven data; alphabetical for reference data.

### Sectioned/Grouped Tables

- Support user-defined sections (groups) within tables. Each section has a collapsible header.
- Allow sections to be renamed inline, deleted (items move to "unsectioned"), and created on demand.
- Show empty sections with placeholder styling so users remember they exist.
- When sorting is active, flatten sections and sort all items together.

### Drag-and-Drop Reordering

- Use an explicit grip handle (drag icon) to initiate reordering. Never allow drag on the entire row to prevent accidental reordering.
- Require mousedown on the grip handle before a drag event is recognized.
- Show visual feedback during drag: reduced opacity on the dragged item, a colored insertion line at the drop target.
- Support cross-section drops: highlight the target section header when dragging over it.
- Calculate new sort positions using fractional values (midpoint between neighbors) to avoid rewriting all positions.

### Column Width Strategy

- Use content-aware column sizing: measure actual content widths (sampling up to 200 items) and size columns accordingly.
- Set minimum widths to prevent columns from collapsing on empty data.
- Allow text in name/title columns to wrap naturally rather than truncating with ellipsis.
- For numeric and date columns, use fixed widths since their content is predictable.
- Provide horizontal scroll on the table container for mobile/narrow viewports.

### Footer Rows

- Display aggregate data (totals, counts) in a visually distinct footer row with a heavier top border.
- Align footer values with their respective columns.

---

## 4. Navigation & layout

### Responsive Shell

- Use a sidebar layout on desktop (>1024px) and a bottom navigation bar on mobile.
- On desktop, the sidebar should be collapsible but visible by default.
- On mobile, provide a slide-out drawer accessible from a hamburger menu.
- Persist the sidebar collapse state across sessions.

### Top Bar

- Keep a persistent top bar with: navigation toggle (left), app identity/name (left-center), user controls (right).
- User controls: theme toggle, current user identity with dropdown for switching.
- Load secondary data (like member lists for switching) lazily on dropdown open, not on page load.

### Page Hierarchy

- Structure routes as: list pages at root level, detail pages one level deep, edit/create pages via modals or nested routes.
- Internal navigation uses client-side routing. External links open in new tabs with a visual external-link indicator.

### URL-Addressable Views & the Back Button

- Every distinct view or step has its own URL. Multi-step flows (wizard steps, sub-tabs, view vs. edit, a confirm step) must be addressable so the browser Back/Forward buttons, refresh, and shareable links all work.
- Drive the visible step from the URL (path segment or query param), not component state alone. Push a history entry per step so Back returns to the previous step, not out of the flow entirely.
- Treat each addressable view as a real page: fire a page-load/analytics event when it opens.

### Close vs. Back Affordances

- An "×" means "dismiss this overlay" — use it only for modals, dialogs, drawers, or dismissible cards layered over content.
- On a full page or route, don't use an "×" (it implies a modal that isn't there). Use a labeled **Back** link or breadcrumb that navigates to the parent URL.
- Never show both an "×" and a "Back" for the same view; pick the one that matches whether it's an overlay or a page.

### Session & Identity Management

- Support multi-user identity on shared devices via an identity selection screen (not traditional auth).
- Store the active session in local storage for persistence across page reloads.
- Track user activity (clicks, keystrokes) and show an inactivity confirmation after a reasonable timeout (~60 seconds for shared-device apps).
- The inactivity modal should offer "Continue as [current user]" and "Switch user" options.

---

## 5. Feedback & system status

### Loading States

- Show a centered spinner (animated icon) during initial data fetch.
- Use page-level loading for full-page data dependencies; inline loading for secondary data.
- Apply a fade-in animation to prevent flash-of-content on fast connections.

### Error States

- Display errors as inline banners (not modals) with: error icon, descriptive message, and a retry button.
- Use a semi-transparent colored background (red/warning) that integrates with the page flow rather than overlaying content.
- Never show raw error messages to users; provide human-readable descriptions.

### Empty States

- When a list or table has no items, show a centered empty state with: a relevant icon in a circular background, a title ("No items found"), optional description, and a primary action button to create the first item.
- Apply fade-in animation for smooth appearance.
- Use the same empty state component pattern across all list views for consistency.

### Confirmation Dialogs

- Use a confirmation dialog only for destructive or irreversible actions (delete, remove).
- Style the confirm button in the danger color for destructive actions.
- Provide clear cancel and confirm options with descriptive labels ("Delete Item" not just "OK").
- Never use confirmation for non-destructive actions like saving or editing.

---

## 6. Forms & validation

### Modal Forms for Creation

- Use centered modals for creating new entities. Keep the form focused on required fields only.
- Label format: uppercase, small text, muted color, positioned above the input.
- Disable the submit button until all required fields have values.
- Provide Cancel (secondary) and Create (primary) buttons at the bottom.
- Close on Escape key press.

### Drawer Forms for Detailed Editing

- Use a slide-in drawer (side panel) for editing entity details that have many fields.
- Drawers maintain page context (user can still see the list behind).
- Auto-save individual fields within drawers rather than requiring a single form submission.

### Field Layout

- Stack labels above inputs for clarity.
- Use grid layouts with responsive column counts for multi-field forms.
- Group related fields logically (identity fields together, status fields together, dates together).

### Input Styling

- All inputs share a consistent base style: rounded borders, subtle background, visible focus ring in the brand's accent color.
- Focus ring should use the brand accent color, not browser defaults.
- Placeholder text in muted color for empty fields.

---

## 7. Media & file handling

### Image Upload

- Provide both drag-and-drop and click-to-browse upload methods.
- Show a dashed border upload zone with an icon and instructional text.
- Display a loading spinner during upload processing.
- After upload, show a thumbnail preview with a remove button (X icon) that appears on hover.
- Support modern image formats (HEIC/HEIF) with client-side conversion when needed.

### Image Display Hierarchy

- For entity representations, use a fallback chain: uploaded image > emoji > default icon.
- Provide multiple size variants (xs through 2xl) of the same component for different contexts (list items, detail pages, avatars).

### Image Galleries

- Support multiple images per entity with a designated "title image" that serves as the primary visual.
- Show gallery images in a grid with the ability to set any image as the title image or remove it.

---

## 8. Empty states & edge cases

### Consistent Empty Patterns

- Every list view must have a defined empty state. Never show a blank page.
- Empty states should guide users toward the primary action (creating their first item).
- When filters produce no results, distinguish between "no data exists" and "no data matches your filters."

### Placeholder Values

- Show a dash ("-") or muted placeholder text for empty optional fields in tables.
- Use muted text color for placeholder values to distinguish them from real data.
- For member/assignee fields, show "Unassigned" in muted styling rather than leaving blank.

### Section Persistence

- Keep empty sections visible (with a collapsed state) so users don't lose their organizational structure.
- When all items are removed from a section, preserve the section header as a drop target for reordering.

---

## 9. Accessibility & usability defaults

### Keyboard Accessibility

- All interactive elements must be keyboard-accessible (focusable and activatable).
- Modals trap focus and close on Escape.
- Inline edits commit on Enter and cancel on Escape.
- Dropdowns support arrow key navigation.

### Semantic Elements

- Use `<button>` for all clickable actions, never `<div>` with click handlers.
- Use native `<select>` elements (even if hidden) to maintain accessibility for custom select UIs.
- Provide `aria-label` attributes on icon-only buttons and toggles.

### Contrast

- Ensure sufficient contrast ratios (minimum 4.5:1 for body text, 3:1 for large text).
- Verify every new text/background pairing against WCAG AA before shipping. (Your brand skill should document the contrast results for its own palette pairings.)

### Portal Positioning

- Dropdowns and popovers should render in a portal at the document root to escape overflow:hidden ancestors.
- Calculate available space above and below the trigger to determine dropdown direction.
- Reposition on scroll if necessary.

---

## 10. Visual hierarchy & consistency

> **Note on colors and fonts:** This section defines *structure* — hierarchy, scale,
> spacing, states, and the token tiers your theme needs. The specific colors and
> typefaces that fill those tiers come from your own brand skill, never from this
> document. Where a value is named below (accent, display font, etc.), read it from
> the brand.

### THE "ANTI-SLOP" PROTOCOL (STRICT PROHIBITIONS)

You are explicitly forbidden from using the following "generic AI" patterns. Usage of these results in failure:

- **FORBIDDEN FONTS:** Inter, Roboto, Open Sans, Arial, Helvetica, system-ui, sans-serif defaults. Use the brand's approved typefaces instead — never fall back to a generic default.
- **FORBIDDEN COLORS:** The "Startup Purple" gradient (purple-to-blue on white), low-contrast pastels without borders, pure \#000000 or \#FFFFFF (always use off-blacks/off-whites). Pull real colors from the brand palette.
- **FORBIDDEN LAYOUTS:** Bootstrap-style grids, generic "Hero Section with two buttons," standard Material Design cards with drop shadows.
- **FORBIDDEN VIBES:** "Corporate Memphis," generic SaaS landing page aesthetics.

### Typography Scale

- **Page titles**: Largest weight, display font, primary text color.
- **Section headings**: Medium weight, display font, primary text color.
- **Body text**: Regular weight, standard size (14-16px), primary or secondary color.
- **Labels**: Small, uppercase, letter-spaced, muted color.
- **Metadata**: Small size, muted color (dates, counts, secondary info).
- Limit to 2-3 font weights maximum across the entire application.
- **Scaling:** Use strong size contrast — large, confident headings against small, quiet metadata.
- *Which* typefaces fill the "display" and "body" roles is set by your brand skill, not here.

### Color & Depth

- **Palette discipline:** Work from the brand's palette. Lead with one dominant color and reserve a sharp accent for primary actions and highlights; avoid timid, evenly distributed palettes. (Your brand skill specifies which color leads and which accents.)
- **Backgrounds:** Never plain white/gray. Use subtle atmosphere — mesh gradients, noise textures, dot patterns, or grid lines — built from brand-adjacent tones.

### Color Token System

Define a comprehensive token system with CSS custom properties, then fill the values from your brand skill:

- **Backgrounds**: Primary, secondary, card surfaces
- **Text**: Primary, secondary, muted (three hierarchy levels)
- **Accent**: Primary brand/action color
- **Borders**: Subtle separators
- **Semantic**: Success (green), warning (gold), danger (red), info (blue)
- **Status palette**: 5-6 distinct hues for categorical data (badges, tags)

Apply colors exclusively through CSS variables so theme switching is automatic.

### Spacing System

- Use a consistent spacing scale based on an 8px base unit:
  - Page-level gaps: 24px between major sections
  - Component gaps: 16px between form elements
  - Internal gaps: 8px, 12px for flex containers
  - Padding: 16px for cards, 12px for dense/table contexts
- Apply the same spacing values consistently across all similar contexts.

### Interactive States

- **Default**: Normal appearance
- **Hover**: Subtle background change or border reveal; slight lift/scale for cards
- **Focus**: Visible ring/outline in the brand accent color
- **Active/Selected**: Accent background with contrasting text for toggles and filters
- **Disabled**: Reduced opacity, no pointer events
- **Dragging**: Reduced opacity (0.4) on the source element

### Card Design

- Cards use: rounded corners, subtle shadow, surface background color, and a slight hover elevation.
- Maintain consistent border-radius and shadow values across all card instances.

### Button Hierarchy

- **Primary**: Filled with the accent color, slight lift on hover. Used for the single most important action. (Ensure label text meets AA contrast against the accent fill — see your brand skill's contrast table.)
- **Secondary**: Bordered/outlined, transparent background, fills on hover. Used for supporting actions.
- **Ghost**: No border or background, just text. Used for tertiary actions and inline links.
- **Danger**: Danger-color styling, used only within confirmation dialogs for destructive actions.

### Motion & Interaction

- **Philosophy:** "One Big Moment" > "Many Tiny Moments."
- Keep transitions short (200-300ms) with ease-out curves.
- Use `animation-delay` to stagger the entrance of elements (list items, cards, headings).
- Prioritize CSS transitions for hover states (transform, filter); avoid JS animations unless complex physics require them.
- Use subtle entrance animations (fade-in, slide-up) for *appearing* content only — never animate content already visible on screen.
- Provide brief, non-disruptive feedback animations (e.g. shake for errors).
- Respect `prefers-reduced-motion` for anything beyond micro-interactions.

### Theme Support (Light/Dark Mechanics)

- Implement light and dark themes using CSS custom properties.
- Toggle by adding/removing a `dark` class (or equivalent) on the root element.
- The theme toggle should be accessible from the top bar at all times.
- Store theme preference in local storage and apply it on page load **before render** to prevent a flash of the wrong theme.
- All components read from tokens, so dark mode needs no per-component overrides. The one exception is logos: always provide both color and white variants and swap them with the theme.
- Test every component state in both themes.

---

## 11. Filters & search

### Filter Bar Design

- Place filters in a horizontal bar above the data table/list.
- Use pill-shaped toggle buttons for binary filters (active = accent color fill, inactive = bordered).
- Use native dropdowns for categorical filters with many options.
- Place a search input with a leading search icon for text-based filtering.

### Filter Behavior

- Filters are applied immediately (no "Apply" button needed).
- Multiple filters combine with AND logic.
- Show active filter count or clear visual distinction for active filters.
- Provide sensible defaults: hide completed/archived items by default with a toggle to reveal them.

### Search

- Search across multiple relevant fields simultaneously (name, status, assignee, etc.).
- Filter as the user types (no submit needed).
- Case-insensitive matching.
- Clear button or empty-on-escape for the search field.

---

## 12. Links & external resources

### Link Management Interface

- Provide an inline interface for adding URL links to entities (not a modal).
- Two fields: Label and URL, with an "Add" button.
- Display existing links as editable rows with blur-to-save behavior.
- Show a delete button on hover for each link.
- External links display with a visual indicator icon (arrow pointing out of a box).

### Link Display

- In read-only contexts, render links as clickable text that opens in a new tab.
- Always show the external link icon for URLs that leave the application.
- Truncate long URLs visually while keeping the full URL as the href.

---

## 13. Multi-select & assignment

### Member/Entity Assignment

- Use a dropdown with checkboxes for multi-select scenarios.
- Show selected items as removable chips/tags below or beside the trigger.
- Reveal a remove (X) button on each chip only on hover to reduce visual noise.
- Position the dropdown via portal with smart direction detection.

### Single Assignment

- For single-entity assignment (one assignee), use a dropdown with avatar + name rows.
- Show the current assignment as an avatar + name display.
- Include a "clear" option to unassign.
- "Unassigned" placeholder in muted styling when no assignment exists.

---

## 14. Progressive disclosure

### Reveal Complexity Gradually

- Show primary actions and data by default. Secondary actions appear on hover or in overflow menus.
- Section management controls (rename, delete) hide behind a menu icon until needed.
- Edit affordances (borders, icons) appear on hover rather than being always visible.
- Detail fields that don't fit in a table row are accessible via a detail view (drawer/page).

### Modal vs. Inline

- Use inline editing for single-field changes in list/table contexts.
- Use modals for creating new entities that require multiple fields.
- Use drawers for editing entity details with many fields while maintaining list context.
- Never nest modals inside modals.

---

## 15. Responsive design

### Breakpoint Strategy

- Define a single primary breakpoint (1024px) for the desktop/mobile layout shift.
- Desktop: sidebar navigation + full table display.
- Mobile: bottom navigation bar + horizontally scrollable tables + stacked form layouts.

### Content Priority

- On mobile, hide secondary information (less critical columns, metadata) while keeping primary data visible.
- User identity display collapses to icon-only on mobile.
- Card grids shift from multi-column to single-column on mobile.

### Touch Considerations

- Ensure tap targets are at least 44px for mobile interactions.
- Drag handles should be generously sized on touch devices.
- Dropdowns should be large enough to tap options without error.

---

## 16. Generated documents & exports

When the app produces a document (Google Doc, Word, PDF, Markdown, or any rendered export), spacing and hierarchy matter as much as on screen — a wall of tightly packed paragraphs reads as low quality, even if the content is good. Defaults:

- **Space after paragraphs and headings** (~10pt, or one blank line). Never let body paragraphs run together at single line-height; they need breathing room between them.
- **Keep list items tight** (~2pt between bullets) so a list reads as one group, not scattered lines.
- **Add a larger gap *before* a section that follows a list** (~12pt above the heading), so the section break is visible and the heading doesn't collide with the last bullet. (A list's last item against the next heading is the most common "too tight" complaint.)
- **HTML→Google Doc import packs everything tight by default.** Don't trust the import for spacing — set it explicitly afterward via the Docs API (`updateParagraphStyle` with `spaceAbove`/`spaceBelow`, walking the body and giving bullets vs. paragraphs different values).
- **Mirror the on-screen hierarchy in the export:** headings bold and larger, labels distinct, consistent indentation for nested items. The exported file should feel like the same product, not a raw dump.

## 17. Dates & times

- Render timestamps in the **viewer's local timezone**, never the server's. A server on UTC will otherwise show the wrong time to every user. Format on the client (`new Date(iso).toLocaleString()`); for server-rendered views, pass an ISO string and localize after mount with a clear fallback (e.g. show "… UTC" until hydrated). Use `suppressHydrationWarning` on the element so the server/client difference doesn't warn.
- Prefer relative time ("2 hours ago") for recent activity where the exact moment doesn't matter, but keep the absolute local time available on hover/`title`.
- **Never offer past times.** Don't show dates or time slots that have already passed. For *today*, filter out slots earlier than now (and trim a partially-past window up to the next valid increment), computing "now" in the same timezone the slots are expressed in. A picker offering 10:30am at noon reads as broken.
- **Match the action to the moment.** Only surface an action that makes sense for *when* the user is. A "Join meeting" button on a confirmation for a meeting days out is wrong — show manage/reschedule instead, and reveal "Join" only when the meeting is imminent or live. (Keep the join link in the calendar invite, where it belongs for the actual time.)

## 18. Export & copy-to-clipboard actions

When a view holds content the user will want to take elsewhere (a generated document, a report, a table, code), give them a first-class way to **export** and **copy** it. Don't bury it, and never make them select-all-and-copy by hand.

### The export control
- Place an **Export** control in a consistent, predictable spot for the view (e.g. top-left of the content/document area), not hidden in an overflow menu.
- Use a **dropdown** listing the supported formats, each labeled with its file type — "Markdown (.md)", "Word (.docx)", "Plain text (.txt)", "PDF", "Google Doc", etc.
- **Group Copy-to-clipboard in the same cluster** as Export. They're the same intent ("get this content out"), so keep them adjacent rather than scattered across the screen.

### Per-format behavior
- Most formats **download a file**: trigger it client-side from the response blob and take the filename from the server's `Content-Disposition`.
- Some targets **don't download** — e.g. a Google Doc is created in Drive and **opened in a new tab**. Flag the odd one out with a small inline note ("opens in Drive") so the missing download isn't a surprise.
- Convert heavy formats (`.docx`, `.pdf`) **server-side**; show a brief per-item busy state and disable the menu while it works. Never block the whole UI.
- Use a **meaningful, filesystem-safe filename** (not "export-1"), derived from the content (e.g. "{name} - {doc type} - {subject}").

### Copy to clipboard
- A single button that copies the content (usually the markdown / plain-text form) via `navigator.clipboard.writeText`.
- Give **immediate transient feedback**: swap the icon/label to a checkmark + "Copied" for ~1.5s, then revert.
- **Handle failure** — clipboard access can be blocked by the browser; catch it and show a short inline note rather than failing silently.

### Instrumentation
- **Track which export format was chosen** (and copy events) in analytics. It tells you how people actually consume the output and which formats are worth maintaining. Log it server-side where the export is produced, so it's reliable.

### Accessibility
- The trigger is a real `<button>` with `aria-haspopup`/`aria-expanded`; options use `role="menuitem"`; the menu closes on click-outside and Escape and is fully keyboard-operable.

## Applying this guide

When asked to make a UI good, usable, polished, responsive, or accessible:

- Honor every **MANDATORY OPERATIONAL RULE** above (functional light/dark toggle via CSS variables, full responsiveness, accessible contrast, OpenGraph/share tags, no "AI-slop" generics).
- Match interaction patterns, spacing, motion, and component *behavior* to this guide rather than inventing generic defaults.
- This guide names structural roles (accent, primary, display font, etc.) but does **not** pick the values — pull actual colors, fonts, and logo from whatever brand is active. Use your own brand skill if you have one; if no brand is specified, ask which to use or choose tasteful values that satisfy the anti-slop rules.
- Preserve existing functionality and content; this is a UX/usability pass.
- After applying, briefly summarize what changed and call out any rule the current stack can't satisfy yet.

This guide is brand-agnostic. For the actual brand identity (colors, type, logo) use your own brand skill; for copy in a specific voice use your own voice skill. The concerns are independent and combine well — e.g. apply this style pass for the UX, then dress it in your brand.

---

*Part of the [AI Build Skills](../README.md) collection · CC BY 4.0.*

# Portal Widget Authoring Experience — Implementation Plan

> Status: **Phase A done (deployed to the dev scratch org, not yet committed to git). Phases 0–3 approved, not started.**
> Recorded so context survives a session reset.
> Created: 2026-10-14. Dev org: `UST-Alumni-Digital-Experience-Site__dev` (CCI alias `dev`), expires 2026-10-27.

## Goal

Give portal admins a purpose-built authoring layout for `UST_Portal_Widget__c` (replacing the classic
page layout) with a rich text editor that behaves like the Experience Builder one, plus the things
clients actually need in widget content: **call-to-action buttons**, **personalization data tags**,
and later a **hero image widget** backed by the S3 upload tool.

Guiding decision: **structured data beats markup in the rich text.** Buttons are JSON on the record and
rendered by our component (not HTML/classes inside Quill). That removed the need for a custom Quill
build and for a per-paragraph class list.

---

## Phase A — DONE: Editor layout, headings, widget style class

Built, browser-verified in the dev org, 67 Jest tests passing, Apex tests passing.

| Piece | File(s) |
|---|---|
| Record-page layout (Widget Setup / Content / Audience Filters, live preview) | `lwc/ustWidgetRecordEditor/` |
| Rich text editor with Paragraph + Heading 2–5 dropdown, char counter, H1/H6 warning | `lwc/ustRichTextEditor/` |
| Renders content; applies allowlisted widget style class | `lwc/ustStaticContent/` |
| Widget style picklist (Callout Panel, Purple Banner, Centered, Muted) | `fields/Content_CSS_Class__c` |
| Record page, set as the View override | `flexipages/UST_Portal_Widget_Record_Page`, `UST_Portal_Widget__c.object-meta.xml` |
| Admin permission set (new fields are invisible without FLS) | `permissionsets/UST_Portal_Widget_Admin` |
| DTO carries `contentCssClass` | `PortalWidgetController`, `ustWidgetZone` |
| Apex tests | `force-app/tests/default/classes/PortalWidgetController_TEST.cls` |

Also done in the same session: API version bumped to **68.0** everywhere (`sfdx-project.json`,
`cumulusci.yml`, all `*-meta.xml`); `WITH SECURITY_ENFORCED` (removed in API 68) replaced with
`WITH USER_MODE` in four controllers; Code Analyzer High findings fixed.

### Gotchas learned (do not re-discover)

- **`lightning-input-rich-text` limits.** Allowed formats include header/link/image/code/blockquote/
  script/direction/table, but toolbar buttons exist only for bold/italic/underline/strike, lists,
  indent, left/center/right align, link, image, clear. `setFormat()` only accepts align, background,
  bold, code, code-block, color, font, header (1–6), italic, link, size, strike, underline. No access to
  the Quill instance, modules, registries, or selection events. `class` attributes cannot round-trip.
- **`getFormat()` steals focus.** It refocuses the editor, closing the heading dropdown and the Link
  dialog. Cursor-sync handlers are on a wrapper around only the rich text, and toolbar clicks
  (clientY < `TOOLBAR_HEIGHT_PX`) pause tracking for 8 s (`TOOLBAR_PAUSE_MS`). `composedPath()` does not
  expose `.ql-editor`, so geometry is the only way to tell toolbar from text.
- **Combobox `change` bubbles out of the child component** and was mistaken for a content change
  ("h3" replaced the body). Both handlers call `event.stopPropagation()`.
- **The editor textbox only exists after a real mouse click in the editor area** (lazy init) — matters
  for Playwright tests.
- **Stale Lightning bundles after a JS-only deploy.** Clear localStorage/sessionStorage, IndexedDB and
  Cache Storage, reload, wait ~20 s, reload again (repeat once if needed).
- **`cci task run deploy` can say "Succeeded" and deploy nothing** (new field was missing). Use
  `sf project deploy start --source-dir ...` and verify with a query.
- **New fields need FLS.** Admin sees nothing until `UST_Portal_Widget_Admin` is assigned.
- **Apex tests in the scratch org:** ~80 pre-existing failures are environmental (Network is
  `UnderConstruction`; `Alumni Community User` profile and `ETL User` missing → "List index out of
  bounds"; Alumni_Business record type unavailable to admin). Not caused by code changes. Finish the
  `config_dev` flow to make them meaningful.
- **Jest + base component stubs:** `field-name`/`label` are properties, not attributes — query all
  elements and filter on the property.

### Base-editor caveat to resolve

The toolbar **Image** button stores pictures in Salesforce (`rtaImage`) rather than S3. Untested whether
those render for **guests** on the portal, and they are not fast/public like S3. Decide in Phase 4:
hide it, or confirm it works.

---

## Decisions (confirmed 2026-10-14)

| Topic | Decision |
|---|---|
| Editor | Stay on the **base `lightning-input-rich-text`**. Full Quill (static resource) only if per-paragraph classes or inline images become a real requirement. |
| Buttons | JSON on the widget record, rendered by our component. Placement **Above or Below** the text (default Below). **No limit** on count. |
| Button types | **External URL** and **Portal link** (site menu item or typed relative path). Relative paths required so content migrates sandbox → prod. |
| Button sizing | **Handled by the widget content CSS class**, so buttons stay consistent. No per-button size field. |
| Data tags | `{{Tag}}` syntax, **sourced from `Alumni_Directory__c` only**, usable in header, body, button labels and button URLs. |
| Tag fallback | `{{First_Name\|Alum}}` — text after `\|` is used when the value is blank (and for guests). |
| Sensitive tags | Excluded (email, phone, birthdate, address) **except Banner ID**, which is allowed — including in URLs. |
| Page-name mismatch | We fix it (Phase 0). |

---

## Phase 0 — Fix the `Page_Context__c` / page-name mismatch

**Problem.** `ustWidgetZone` derives the page context from `CurrentPageReference` (`attributes.name`,
lowercased). `Page_Context__c` values are `all, home, giving, events, profile, directory, news`.
Actual LWR page API names (from `sfdc_cms__route`): `Home`, `alumni_directory__c`,
`Alumni_Event_Creation__c`, `alumni_notes__c`, `business_directory__c`, `lawyer_search__c`,
`my_account__c`, `My_Business__c`, `News_Detail__c`, plus system pages (Login, Register, Error…).
Only `home` matches; targeting a widget at "Directory" likely never matches.

**Plan.**
1. Confirm the mismatch in the dev org with a widget on a non-home page (expect no render).
2. Make `Page_Context__c` values the **lowercased real page API names** (keep `all`), with friendly
   labels (e.g. `alumni_directory__c` → "Alumni Directory"). Keep old values active during migration.
3. Migrate existing records (dev + EDA-Staging): `directory` → `alumni_directory__c`, etc.; document the
   mapping. Decide what to do with `giving`, `events`, `profile`, `news` (no matching route today —
   either map to the right page or retire).
4. Update `PortalWidgetController_TEST`, `WIDGET-CATALOG.md`, `MAIN_GUIDE.md`.
5. Single source of truth for page names: reuse this list for the **Portal link** picker in Phase 3.

---

## Phase 1 — Spikes (≈ half a day, before building)

1. **Insert at cursor.** Does `lightning-input-rich-text.insertTextAtCursor()` (documented as "reserved
   for internal use") reliably insert plain text `{{First_Name}}` at the cursor in the dev org? If not,
   fallback = append at end, or copy-to-clipboard.
2. **Portal link resolution in the LWR site.** Relative path + `@salesforce/community/basePath`
   (already used by header/footer) vs `NavigationMixin.GenerateUrl` with `comm__namedPage`. Confirm base
   path handling and that links work in Experience Builder preview and live.
3. **Page picker source.** Site pages are **not** queryable at runtime (`DigitalExperience` is not
   supported in SOQL; routes exist only in metadata). `NavigationMenuItem` **is** queryable
   (7 InternalLink items in dev: `/my-account`, `/alumni-directory`, `/alumni-notes`, `/lawyer-search`,
   `/business-directory`, `/my-business`, `/alumni-event-creation`). Confirm the menu-item query works
   for the navigation set bound to the site (note `sync_navigation_menu` handles per-org set names).

---

## Phase 2 — Data tags

### Tag registry (single source of truth, Apex)

| Tag | Source | Allowed in URLs |
|---|---|---|
| `First_Name` | `Nickname__c`, else `First_Name_Text__c` | no |
| `Last_Name` | `Last_Name_Text__c` | no |
| `Class_Year` | `Class_Year_Text__c` | no |
| `Employer` | `Employer_Text__c` | no |
| `Job_Title` | `Occupation_Text__c` | no |
| `St_Thomas_Degree` | `St_Thomas_Degree_text__c` | no |
| `City_State` | `City_State__c` | no |
| `Contact_Id` | `Contact_ID__c` (formula) | **yes** |
| `Banner_ID` | `Contact_Banner_ID__c` (formula) | **yes** |

Excluded on purpose: email, phone, mobile, birthdate, mailing street/postal code/country, middle name.
Registry is exposed via an `@AuraEnabled` method (label, token, sample value) so the editor dropdown and
the Apex resolver cannot drift.

### Behavior

- Syntax `{{ Name }}` or `{{ Name|fallback }}`. Case-insensitive; spaces ≡ underscores (matches the
  existing EASY/VF behavior in `ApplicationUtilities.replaceDataTags`).
- Strict pattern that tolerates editor formatting inside a tag (`{{First_<b>Name</b>}}`): match
  `\{\{((?:[^{}<]|<[^>]*>)+?)\}\}`, strip tags from the capture, then parse name/fallback.
- Blank value → fallback if given, else empty string. **Guests and users with no directory record get
  blanks/fallbacks.** Unknown tags are left literally in the text (and flagged to admins in the editor).
- **HTML-escape every substituted value.** (The VF implementation inserts values unescaped; alumni can
  edit these fields themselves.) Header and button labels are plain text. Fallback text is escaped too.
- In **URLs**: only tags marked "allowed in URLs" resolve, values are URL-encoded; other tags in a URL
  resolve to empty.
- Resolve **server-side** in `PortalWidgetController` for the current user's `Alumni_Directory__c`
  (`Contact__c = running user's ContactId`), using a **separate system-mode query of only the whitelisted
  fields**. Do *not* add fields to the existing `WITH USER_MODE` directory query — a missing FLS on any new
  field would break the whole widget zone for portal users.
- Applies to: `Static_Content_Header__c`, `Static_Content__c`, button labels and button URLs (and hero
  text later).

### Editor UX

- "Insert data tag" dropdown beside Paragraph style (rich text) and beside the header input (plain
  input → `setRangeText`, which is straightforward).
- Live warnings for unknown tag names.
- Preview resolves tags with **sample values** from the registry.
- Stretch: "Preview as" a chosen Alumni Directory record.

### Tests

Apex: parsing (formatted/split tags, case, spaces), fallback, blank, guest, escaping (`<script>` in a
value), URL encoding, URL-disallowed tags, unknown tags. Jest: insert dropdown, unknown-tag warning.

---

## Phase 3 — Call-to-action buttons

### Data model

- `Buttons_JSON__c` — Long Text Area (32,768) on `UST_Portal_Widget__c`.
- `Button_Placement__c` — picklist: `Below` (default), `Above`.
- Add both to `UST_Portal_Widget_Admin` and `Alumni_Portal_Guest_User` permission sets.

### JSON shape (versioned)

```json
{
  "version": 1,
  "buttons": [
    {
      "id": "b1",
      "label": "Give today, {{First_Name|friend}}",
      "type": "external",
      "url": "https://example.edu/give?id={{Contact_Id}}",
      "newTab": true,
      "style": "brand",
      "align": "left",
      "icon": "utility:heart"
    },
    { "id": "b2", "label": "Alumni Directory", "type": "portal", "url": "/alumni-directory", "style": "outline-brand", "align": "left" }
  ]
}
```

Styles carried over from EASY Widget Button: `text_link, brand, outline-brand, destructive,
text-destructive, neutral, success`. Alignment: `left, center, end`. Icon is optional and validated.
**No per-button size** — sizing comes from the widget content CSS class.

### Link rules (enforced at save AND at render; Apex re-validates)

- External: `https:` only (plus `mailto:` / `tel:`). Reject `javascript:`, `data:`, etc. New tab →
  `rel="noopener noreferrer"`.
- Portal: must start with a single `/` (reject `//`); site base path is added at render time, so the same
  JSON works in sandbox and prod. Picker suggestions come from the site navigation menu; free typing of
  any relative path is allowed (covers `/news/<id>`).
- Render real `<a>` elements (not `<button>`), visible focus, decorative icons, unique labels.

### Components

- `ustWidgetButtonEditor` (child of `ustWidgetRecordEditor`): add / **edit** / reorder / delete, saves
  with the record's Save (EASY writes immediately and cannot edit). Uses stable ids, not array index.
  Section shown for widget types that support buttons (extend `COMPONENT_SECTIONS`).
- `ustWidgetButtons` (shared renderer): used by `ustStaticContent` now and the hero widget later.
- Apex: parse/validate/sanitize JSON, drop invalid entries, resolve tags in label/url, return a clean list
  on `PortalWidgetDto`.
- Widget content CSS classes get button-size rules so buttons stay consistent. **Open item:**
  `Content_CSS_Class__c` is single-select; if a widget needs e.g. "Callout panel" *and* "wide buttons",
  add a second picklist (e.g. `Button_Size_Class__c`) rather than multi-selecting.

### Tests

Apex: JSON sanitization, scheme allowlist, relative path rules, tag resolution in labels/URLs. Jest:
editor add/edit/reorder/delete, renderer placement above/below, unsafe URL rejection.

---

## Phase 4 — Later: hero image widget + S3

Not started; design notes only.

- New widget type `ust_hero_banner` (add to `Component_Name__c` picklist, `WIDGET_REGISTRY`, and a
  `lwc:elseif` block in `ustWidgetZone.html` — see AGENTS.md "adding a widget").
- Fields: image URL, **alt text (required)**, overlay text (reuse `ustRichTextEditor`), buttons (reuse
  `ustWidgetButtons`), overlay scrim for contrast.
- Image upload: embed the existing **`awsS3DirectoryImage`** LWC (dependency repo
  `UniversityOfSaintThomas/Salesforce-LWC-S3-Integration`, already in `cumulusci.yml`) in a new
  "Hero" section of `ustWidgetRecordEditor`, using the widget's own record Id and image field;
  `fileNameSuffix` allows desktop/mobile variants.
- Suggested changes to the S3 tool: canvas output is always PNG (`toDataURL()` with no type) → use JPEG
  ~0.85 for photos; stored URL has no cache-buster so replaced images can look stale; consider
  CloudFront and a second smaller size. Base64-through-Apex is fine at hero sizes but not large files.
- Setup needed per org: real bucket URL on the Named Credential **and** the CSP Trusted Site
  (`img-src`), AWS keys on the External Credential principal, republish the site, and assign
  `AWS_S3_Directory_Image` to widget admins.
- Open questions: full-width vs fixed banner height / aspect ratios, text position (left/center/
  configurable), mobile image.
- Inline images in Static Content are **not** a fit for the S3 tool as-is (one image per record+suffix,
  writes a field, base editor cannot insert an image programmatically). Revisit with full Quill only if
  needed.

---

## Deployment & verification checklist (every phase)

1. `sf project deploy start --source-dir <paths> --target-org UST-Alumni-Digital-Experience-Site__dev`
   (verify with a query — do not trust `cci` "Succeeded").
2. `npx jest` (all green) and `sf apex run test --class-names ...` for touched classes.
3. Code Analyzer (Java is installed): `sf code-analyzer run --workspace force-app --target <paths>`;
   High = zero. IntelliJ MCP `lint_files` also works (refresh Illuminated Cloud metadata first or it
   reports false "Cannot resolve symbol" for new fields).
4. Browser-verify in the dev org (Playwright). Clear Lightning caches after JS-only deploys.
5. Republish the Experience site after changing guest-visible access or CSP.
6. Update `WIDGET-CATALOG.md` / `MAIN_GUIDE.md`; keep this plan's phase checklist current.
7. Nothing is committed yet — the working tree also contains unrelated in-progress changes (staged
   renames of test classes into `force-app/tests/default/classes/`, `.agentbridge` deletions, etc.).

## Progress

- [x] Phase A — editor layout, headings, widget style class, API 68.0, lint fixes, link-dialog fix
- [ ] Phase 0 — page-name mismatch
- [ ] Phase 1 — spikes (insert-at-cursor, portal link resolution, page picker source)
- [ ] Phase 2 — data tags
- [ ] Phase 3 — buttons
- [ ] Phase 4 — hero widget + S3 (design only)

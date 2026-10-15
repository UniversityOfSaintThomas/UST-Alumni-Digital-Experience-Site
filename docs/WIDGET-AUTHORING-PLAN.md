# Portal Widget Authoring Experience — Implementation Plan

> Status: **Phases A and 0 done (deployed to the dev scratch org, not yet committed to git). Phases 1–3 approved, not started.**
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

## Phase 0 — Page context: fix the mismatch and keep it current (design agreed 2026-10-15)

**Problem.** `ustWidgetZone` derives the page context from `CurrentPageReference` (`attributes.name`,
lowercased). `Page_Context__c` values are `all, home, giving, events, profile, directory, news`.
Actual LWR page API names (from `sfdc_cms__route`): `Home`, `alumni_directory__c`,
`Alumni_Event_Creation__c`, `alumni_notes__c`, `business_directory__c`, `lawyer_search__c`,
`my_account__c`, `My_Business__c`, `News_Detail__c`, plus system pages (Login, Register, Error…).
Only `home` matches; targeting a widget at "Directory" likely never matches.

**Platform facts (verified in dev org).** Site pages cannot be listed at runtime: `DigitalExperience` is
not queryable, no Tooling object exposes routes, `NetworkPageOverride` covers standard pages only. Only
`NavigationMenuItem` is queryable (menu pages only). So the list must be built by the site itself.

**Where zones live today (from the repo bundle).** `body` and `sidebar` are in individual page views
(`Home`: body + sidebar; `Alumni_Directory`: sidebar). `banner` and `above_footer` are in the **theme
layout** `scopedHeaderAndFooter`, i.e. on every page using that layout.

### Design: self-registering zone placements

1. New object **`UST_Portal_Zone_Placement__c`**: `Page_Name__c` (lowercased page API name, or `*` for
   "all pages"), `Zone__c`, `Scope__c` (`Page` / `Layout`), `Page_Label__c` (admin-editable friendly
   label), `Last_Seen__c`, `Hidden__c`; unique external-id key `Page|Zone`.
2. **Layout-level zones (decided 2026-10-15): no bundle change.** `banner` and `above_footer` live in the
   `scopedHeaderAndFooter` theme layout (layout type `Inner`, used by 14 views; only the two error pages
   use `snaThemeLayout`). That layout also holds the built-in LWR navigation components and
   `ustAlumniTheme`, so content placed there already appears on every page — keep using those zones for
   "every page" content. A zone cannot detect by itself whether it is in a shared layout, so the registry
   has an admin-editable `Scope__c` (`Page` / `Layout`). **Seed `banner` and `above_footer` as `Layout`
   (`Page_Name__c = *`)** from this verified fact; admins can flip the flag for any future layout zone.
   (Optional later: a `zoneScope` builder property on `ustWidgetZone` so the builder sets it
   automatically — would require editing/redeploying the theme layout file; not needed now.)
3. **Registration happens only in Experience Builder** (`state.app === 'commeditor'`, already detected in
   `ustWidgetZone`). The zone calls a non-cacheable Apex method that upserts the placement. Live visitors
   and guests never write; Apex also refuses unless the user can create the object. Zero overhead for the
   public site. A zone whose existing placement is `Layout`-scoped keeps `*` and is not duplicated per
   page when an admin visits different pages.
4. **Editor behavior** (`ustWidgetRecordEditor`):
   - Zone is chosen first; the page picker lists only pages that have that zone, plus `All pages`.
   - Changing the zone **auto-removes known pages that lack the new zone**, with a notice and Undo
     ("Removed Directory — no Sidebar zone on that page").
   - Pages not yet registered are kept with a warning (lets admins pre-configure before a page exists).
   - "Appears on: Home, Alumni Directory" coverage line; warning when a widget would appear nowhere.
   - Free-text escape hatch for unregistered page names.
5. `Page_Context__c` becomes an **unrestricted** multi-select picklist so `INCLUDES` keeps working while
   the custom editor can save any page name. (Verify in the spike that the API/LWC accepts values not in
   the list.)
6. **Seed** the registry once from the 16 routes/views in the current bundle (script or CCI task), and
   add a one-time data migration for existing widget records: `directory` → `alumni_directory__c`, etc.
   **`giving`, `events`, `profile`, `news` are left as-is for now** (no matching route in the dev bundle;
   owner to check whether those pages exist in EDA-Staging before mapping or retiring them).
7. The same registry feeds the **Portal link** picker for buttons (Phase 3).

### Limits to remember
- A zone removed in the builder is not detected (nothing runs). Show `Last_Seen__c`, flag stale entries,
  allow `Hidden__c`; do not delete automatically.
- The registry reflects the *builder* state, which can be ahead of the *published* site.
- Editor checks are advisory; records changed by data loader are not validated, and a mismatch simply
  means the widget does not render.
- Unverified until built: that Apex DML works from the builder session, and unrestricted multi-select
  behavior.

### Steps
1. Confirm the mismatch in the dev org (widget on a non-home page → expect no render).
2. Build the object, permission sets (admin: create/edit; no guest access), registration Apex, seed of the
   layout zones, and tests (Apex: guest/non-admin cannot register, upsert idempotent, `*` handling; Jest:
   builder-only registration).
3. Editor page/zone picker, auto-remove with Undo, coverage line.
4. Picklist change, migration, seed, docs (`WIDGET-CATALOG.md`, `MAIN_GUIDE.md`, `PortalWidgetController_TEST`).

---

## Phase 0 — as built (2026-10-15)

Verified in the dev org, including Experience Builder: deleting the seeded Home rows and opening
Builder re-created `home|body` and `home|sidebar`; switching to the Alumni Directory page created
`alumni_directory__c|sidebar` (server response `created`).

**Live evidence for the original bug.** Network capture in Builder shows the widget query is sent with
`pageContext = home` and `pageContext = alumni_directory__c` — so the old picklist value `directory` never
matched the Alumni Directory page. Real page-name strings are the lowercased route API names. The site's
URL path prefix is `/alumni/` (e.g. `/alumni/alumni-directory`), useful for the Phase 3 portal-link work.

| Piece | Where |
|---|---|
| Registry object, fields, tab, list view | `objects/UST_Portal_Zone_Placement__c/`, `tabs/UST_Portal_Zone_Placement__c` |
| Registration + read + seed Apex (98% coverage, 8 tests) | `classes/PortalPageRegistry.cls`, `tests/default/classes/PortalPageRegistry_TEST.cls` |
| Zone registers itself in Builder only; new `zoneScope` property | `lwc/ustWidgetZone/` (7 Jest tests) |
| Theme-layout zones marked `zoneScope: Layout` (deployed and verified by retrieving the bundle) | `unpackaged/.../sfdc_cms__themeLayout/scopedHeaderAndFooter/content.json` |
| Page/zone-aware picker: filter by zone, auto-remove with Undo, coverage line, warnings, typed pages | `lwc/ustPageContextPicker/` (15 Jest tests), wired into `ustWidgetRecordEditor` |
| `Page_Context__c` now unrestricted (verified: unlisted values save and `INCLUDES` still matches) | `fields/Page_Context__c` |
| CCI tasks: `assign_ust_portal_widget_admin_permset` (config_dev 1.5), `seed_zone_placements` (config_dev 1.6), `migrate_widget_page_context` (manual, idempotent) | `cumulusci.yml` |

**To do in other orgs (for example eda-staging):** deploy, assign `UST_Portal_Widget_Admin`, run
`cci task run seed_zone_placements --org <org>` and `cci task run migrate_widget_page_context --org <org>`,
then open each page in Experience Builder once so the registry fills in; republish the site.

**Needs the permission set.** Registration is silently skipped for anyone without create/edit on
`UST_Portal_Zone_Placement__c`, so admins must have `UST_Portal_Widget_Admin` for pages to register.

**Not changed (by decision):** `giving`, `events`, `profile`, `news` page values are left as-is until the
EDA-Staging site is checked. Existing `directory` values are migrated to `alumni_directory__c` by the task.

**Known follow-ups:** `registerPlacement` has cyclomatic complexity 15 (Code Analyzer, Moderate) — could be
split; Builder-state vs published-state caveat and stale-entry handling are as described above.

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
- [x] Phase 0 — page context: fix mismatch + self-registering zone placements (done 2026-10-15; see "Phase 0 — as built")
- [ ] Phase 1 — spikes (insert-at-cursor, portal link resolution, page picker source)
- [ ] Phase 2 — data tags
- [ ] Phase 3 — buttons
- [ ] Phase 4 — hero widget + S3 (design only)

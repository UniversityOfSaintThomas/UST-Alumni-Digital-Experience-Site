# Portal Widget Authoring Experience — Implementation Plan

> Status: **Phases A, 0–3 done. Phase 4 (hero widget + S3) is built; real uploads await the S3 credential.** (Phases 0–2 committed by the owner; Phases 3–4 not yet committed.)
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

## Phase 1 — Spikes — DONE 2026-10-15

All three answered against the dev org (spike component was temporary and has been removed).

### 1. Insert text at the cursor — works (with one caveat)

`lightning-input-rich-text.insertTextAtCursor(text)` (documented as "reserved for internal use"):

| Scenario | Result |
|---|---|
| Caret in the middle of text | Inserted at the caret |
| Focus moved to another control first (the real "Insert data tag" dropdown case) | Still inserted at the last caret position |
| Text selected | Selection is **replaced** |
| After insertion | Editor fires `change` with the new HTML, so our wrapper, preview and save all see it; works inside a heading too |

Decision: use it for the rich-text "Insert data tag" dropdown, **feature-detected**
(`typeof editor.insertTextAtCursor === 'function'`). Caveat: it is an internal-use API Salesforce could
change. Fallback if it ever disappears: append the tag at the end of the content and tell the admin.
The plain header field uses the supported `lightning-input.setRangeText()`.

### 2. Portal link resolution in the LWR site

Observed in Experience Builder's live preview of the Alumni site (`basePath` = `/alumni`):

| Input | `NavigationMixin.GenerateUrl` result |
|---|---|
| `standard__webPage` `/alumni-directory` | `/alumni/alumni-directory` (base path added) |
| `standard__webPage` `/alumni/alumni-directory` | `/alumni/alumni-directory` (not double-prefixed) |
| `standard__webPage` `/news/abc?x=1#top` | `/alumni/news/abc?x=1#top` (query and hash kept) |
| `standard__webPage` `/` | `/alumni/` |
| `standard__webPage` `https://www.stthomas.edu` | unchanged |
| `standard__webPage` `//evil.example.com/x` | **unchanged — protocol-relative, an open-redirect risk** |
| `standard__webPage` `javascript:`, `mailto:`, `tel:` | **mangled** to `/alumnijavascript:...`, `/alumnimailto:...` |
| `comm__namedPage` `My_Business__c`, `Home`, `alumni_directory__c` | resolves to the page |
| `comm__namedPage` `my_business__c`, `home` (lowercase) | **fails silently**: redirects to `/alumni/?redirectPageContext=...` (home) |
| `comm__namedPage` unknown page | same silent redirect — no error |
| Raw `<a href="/alumni-directory">` | points at the domain root, **would 404** — not usable |

Page names for `comm__namedPage` are case-sensitive and our registry stores them **lowercased**, so they
cannot be used to build links. (Not tested: clicking, because the Builder overlay intercepts clicks, and a
published site; `Navigate` uses the same resolution as `GenerateUrl`.)

Decisions for Phase 3:
- **Portal links are stored as relative paths** (`/alumni-directory`, `/news/abc`), resolved with
  `GenerateUrl({ type: 'standard__webPage', attributes: { url } })`. The base path is added at render time,
  so the same JSON works in sandbox and prod even if the prefix differs. Do not use `comm__namedPage`.
- Render a real `<a href={generatedUrl}>` and call `Navigate` on click for single-page navigation.
- **Validation (save-time in the editor, re-checked in Apex, and again at render):** portal path must match
  `^/(?!/)[^\s]*$` — starts with exactly one `/`, no scheme, no whitespace. Reject `//`.
- **`mailto:` and `tel:` must not go through `GenerateUrl`** — render them as plain `href` after allowlisting.
  External links: `https:` only.

### 3. Page picker source

- Site pages cannot be listed at runtime (confirmed earlier). `NavigationMenuItem` **can** be queried via
  SOQL and is scoped by `NavigationLinkSet.NetworkId`.
- Columns of interest: `Label`, `Type` (`InternalLink` = page with a path, `MenuLabel` = group heading,
  `NavigationalTopic` = skip), `Target` (relative path such as `/alumni-directory`), `Status`
  (`Draft` or `Live` — this dev site is unpublished, so rows are `Draft`; a published site has both), and
  `AccessRestriction` (`LoginRequired` or `None`, a useful hint for guest-visible buttons).
- Link set names differ per org (`Default_Navigation2` here; `sync_navigation_menu` handles that), so scope
  by the site's network, not by developer name.
- The zone registry cannot supply link paths (it stores page API names, not URL paths).

Decision: the Portal-link picker offers **site menu pages** (deduplicated by `Target`, preferring Live,
labelled with a "login required" note) plus **free typing of any relative path**. Implement as a small
Apex method (`getPortalLinkSuggestions`) that finds the network by name (`Alumni`, the same name
`sync_navigation_menu` uses; make it configurable) and returns `[{label, path, loginRequired}]`.

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
- **Escape every substituted *value*.** (The VF implementation inserts values unescaped; alumni can edit
  these fields themselves.) Body = HTML-escaped; header and button labels = plain text (no escaping, the LWC
  template escapes on render); URLs = URL-encoded. **Fallback text is inserted as-is** (URL-encoded in
  URLs): the admin wrote it in the same format as the surrounding text and the editor has already
  HTML-encoded it, so escaping it again would double-encode characters such as `&`.
- In **URLs**: only tags marked "allowed in URLs" resolve, values are URL-encoded; other tags in a URL
  resolve to empty.
- Resolve **server-side** in `PortalWidgetController` for the current user's `Alumni_Directory__c`
  (`Contact__c = running user's ContactId`), using a **separate system-mode query of only the whitelisted
  fields**. Do *not* add fields to the existing `WITH USER_MODE` directory query — a missing FLS on any new
  field would break the whole widget zone for portal users.
- Applies to: `Static_Content_Header__c`, `Static_Content__c`, button labels and button URLs (and hero
  text later).

### Editor UX

- "Insert data tag" dropdown beside Paragraph style (rich text; uses `insertTextAtCursor`, feature-detected —
  Phase 1 spike 1) and beside the header input (plain input; see "as built" for why it splices the value).
- Live warnings for unknown tag names.
- Preview resolves tags with **sample values** from the registry.
- Stretch: "Preview as" a chosen Alumni Directory record.

### Tests

Apex: parsing (formatted/split tags, case, spaces), fallback, blank, guest, escaping (`<script>` in a
value), URL encoding, URL-disallowed tags, unknown tags. Jest: insert dropdown, unknown-tag warning.

---

## Phase 2 — as built (2026-10-15)

Server and editor verified in the dev org (browser + anonymous Apex), Jest 126/126, Apex org-wide failures
unchanged at 80 (environmental), Code Analyzer: no High findings.

| Piece | Where |
|---|---|
| Resolver, tag allowlist (9 tags), directory lookup, `@AuraEnabled getTagDefinitions()` (94% coverage, 15 tests) | `classes/PortalDataTags.cls`, `tests/default/classes/PortalDataTags_TEST.cls` |
| `getWidgetsForZone` now returns body/header with tags already resolved for the signed-in user; the lookup is skipped when no widget on the page uses a tag (3 new controller tests) | `classes/PortalWidgetController.cls` |
| Shared JS: parsing, unknown-tag detection, sample preview, append fallback (mirrors the Apex rules; 16 tests) | `lwc/ustDataTags/` |
| Insert data tag list + unknown-tag warning in the rich text editor | `lwc/ustRichTextEditor/` |
| New header field with the same list and warning | `lwc/ustDataTagInput/` (replaces the `lightning-input-field` for `Static_Content_Header__c`) |
| Preview with sample values, plus a "Preview as a guest" switch (fallbacks only) | `lwc/ustWidgetRecordEditor/` |
| `UST_Portal_Widget_Admin` now also grants Apex class access to `PortalDataTags` and `PortalPageRegistry` (needed by non-sysadmin widget admins) | `permissionsets/UST_Portal_Widget_Admin` |

**Resolution modes** (`PortalDataTags.Mode`): `HTML_CONTENT` (escape values), `PLAIN_TEXT`, `LINK_URL`
(identifier tags only, URL-encoded). `LINK_URL` is built and unit-tested but not wired to anything until
Phase 3 buttons. The enum constants are not named `HTML`/`URL` because those clash with Apex system types.

**Verified.**
- Header insert at the caret, replacing a selection, and focus returns; body insert via
  `insertTextAtCursor` keeps focus in the editor; unknown tag (`{{Fist_Name}}`) shows a warning;
  preview shows `Jordan` / `Summit Health` as samples and `friend` / empty as a guest.
- Saving stores the **raw** tags, not sample values.
- Anonymous Apex: guest-like user gets fallbacks; a user with a directory record gets their data; a
  nickname containing `<b>x</b>` is escaped in the body.
- Live site response headers for the widget call (signed in): `cache-control: no-cache,must-revalidate,
  max-age=0,no-store,private` and `x-sfdc-edge-cache: none` — personalized content is not cached by shared
  caches. (Worth re-checking on a published site and for guests, who can be cached.)

**Findings that shaped the build (do not rediscover).**
- **LWC reserves property names starting with `data`.** The tag list property is `tagDefinitions`
  (attribute `tag-definitions`), not `dataTags`.
- **`lightning-input` has no `setRangeText` method** in this API version (the Phase 2 plan assumed it), but it
  does report `selectionStart` / `selectionEnd`, which survive the field losing focus to the list. The
  component splices the tag into the value itself, replacing any selection.
- **Apex is case-insensitive**: a parameter named `mode` shadowed the `Mode` enum (`Mode.LINK_URL` became a
  field access) — hence `renderMode`. Also `inner` is a reserved word.
- Combobox options only render in the DOM when the list is opened (matters for browser tests).
- Jest base-component stubs expose `name` / `type` as properties, not attributes: filter on the property.

**Known follow-ups.** Banner ID and Contact Id are the only tags allowed in URLs (Phase 3). The existing
`Content_CSS_Class__c` list and tag list are both small enough to stay in code. `replacementFor` and
`getWidgetsForZone` are over the Code Analyzer complexity thresholds (Moderate); not changed.

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

### Link rules (enforced at save AND at render; Apex re-validates) — updated by Phase 1 spike 2

- **External:** `https:` only. New tab → `rel="noopener noreferrer"`.
- **Email / phone:** `mailto:` and `tel:` are allowed but rendered as plain `href`s (never through
  `GenerateUrl`, which mangles them).
- **Portal:** stored as a **relative path** (`/alumni-directory`, `/news/abc?x=1`), validated with
  `^/(?!/)[^\s]*$` (exactly one leading `/`, no scheme; `//host` is rejected as an open redirect).
  Resolved at render with `NavigationMixin.GenerateUrl` using `standard__webPage`, which adds the site base
  path (`/alumni` here) — so the JSON is portable between sandbox and prod. **Never** use `comm__namedPage`
  (case-sensitive, fails silently) or a raw `href="/path"` (would 404 at the domain root).
- Picker suggestions come from the site menu (`NavigationMenuItem`, see Phase 1 spike 3); any relative path
  can also be typed.
- Render real `<a>` elements (not `<button>`), call `Navigate` on click for single-page navigation, visible
  focus, decorative icons, unique labels.

### Components

- `ustWidgetButtonEditor` (child of `ustWidgetRecordEditor`): add / **edit** / reorder / delete, saves
  with the record's Save (EASY writes immediately and cannot edit). Uses stable ids, not array index.
  Section shown for widget types that support buttons (extend `COMPONENT_SECTIONS`).
- `ustWidgetButtons` (shared renderer): used by `ustStaticContent` now and the hero widget later.
- Apex: parse/validate/sanitize JSON, drop invalid entries, resolve tags in label/url, return a clean list
  on `PortalWidgetDto`.
- Button size is its own picklist, `Button_Size__c`, **separate from `Content_CSS_Class__c`**, so a panel
  style and a button size can be combined (resolved during the build; see "as built").

### Tests

Apex: JSON sanitization, scheme allowlist, relative path rules, tag resolution in labels/URLs. Jest:
editor add/edit/reorder/delete, renderer placement above/below, unsafe URL rejection.

---

## Phase 3 — as built (2026-10-15)

Verified in the dev org: editor (browser), real Experience Builder render of the Home page (links, base path,
click behaviour), server cleaning for signed-in vs guest (anonymous Apex), Jest 228/228, Apex registry/tags/
buttons/controller all green, org-wide Apex failures unchanged at 80 (environmental), Code Analyzer: no High
findings in shipped code.

| Piece | Where |
|---|---|
| Fields `Buttons_JSON__c` (32k long text), `Button_Placement__c` (Below default / Above), `Button_Size__c` (`ust-buttons-wide` / `ust-buttons-full`), in the admin and guest permission sets | `objects/UST_Portal_Widget__c/fields/` |
| Server cleaning + link allowlist + tag resolution + portal-link suggestions (98% coverage, 18 tests incl. `javascript:`, `//host`, backslash, tag-smuggling) | `classes/PortalButtons.cls`, `tests/default/classes/PortalButtons_TEST.cls` |
| Controller returns `buttons`, `buttonPlacement`, `buttonSize`; a widget with only buttons still renders; tag lookup also triggers on button tags | `classes/PortalWidgetController.cls` |
| Shared rules (options, validation, JSON format, preview resolution), mirrors Apex | `lwc/ustButtonRules/` |
| Renderer: real `<a>` links, base path via `GenerateUrl`, safe new-tab, rows by alignment, size classes | `lwc/ustWidgetButtons/` |
| Placement above/below the text | `lwc/ustStaticContent/`, `lwc/ustWidgetZone/` |
| Editor: add / edit / reorder / delete, validation, site-page picker, open-draft guard | `lwc/ustWidgetButtonEditor/`, wired into `lwc/ustWidgetRecordEditor/` (preview uses `preview-mode`) |
| `ustDataTags` gained `MODE_URL` + `urlEncode` (matches Apex `EncodingUtil.urlEncode`) | `lwc/ustDataTags/` |

**How it behaves.** Buttons are stored as versioned JSON and rewritten by Apex on every read: tags resolved
(links: identifier tags only, URL-encoded), invalid buttons silently dropped, unknown style/alignment/icon fall
back to defaults, label capped at 80 characters, portal links never open a new tab, only `https:` links do.
The editor and the server enforce the same rules, but the server never trusts the editor.

**Findings that shaped the build (do not rediscover).**
- **`lightning-record-edit-form` only returns fields it is asked for** (an input field on the form) or that are
  on the page layout. `Buttons_JSON__c` has no input, so after a reload the editor showed no buttons even
  though they were saved. Fix: an always-present hidden `lightning-input-field` for it in
  `ustWidgetRecordEditor.html`. Any future field edited by a custom component needs the same.
- **`NavigationMixin.GenerateUrl` must not run before the component is connected.** The parent assigns `buttons`
  before attaching the child, so resolving in the setter silently failed and the portal link had no `href` in
  the real site (the editor preview could not show this because preview mode skips resolution). The renderer now
  resolves from `connectedCallback` and when buttons change afterwards. Two Jest tests fail against the old code.
- **Jest: mocking `lightning/navigation` with `{ virtual: true }` makes the mock unreliable when the whole suite
  runs** (passes alone, fails in the full run). Omit `virtual: true` for that module.
- **Jest:** base-component stubs expose `name` / `type` as properties, not attributes (filter on the property).
- **Link regexes with control characters** are built from strings (`new RegExp`) so no inline ESLint disable is
  needed; the generated pattern was checked against tab, DEL, U+0001, and backslash cases.
- The page-picker list shows 8 entries in the dev org (Home + the 7 menu pages) with a "login required" note;
  suggestions are only returned to users who can edit widgets, so portal users never see site structure.

**Known limits / follow-ups.**
- Buttons sit above or below the text only, not inside a paragraph.
- Only external https/mailto/tel and portal paths exist as types (no event-registration or giving types yet).
- The portal link menu comes from `NavigationMenuItem` for the network named `Alumni`
  (`PortalButtons.SITE_NETWORK_NAME`); change it there if the site is renamed. Pages not in the menu can be
  typed in by path.
- Not tested: a published site with real guest traffic (caching of personalized buttons), and keyboard/screen
  reader behaviour beyond the semantics built in (real links, assistive "opens in a new tab" text, focus ring).
- `PortalWidgetController.getWidgetsForZone` and a few helpers exceed Code Analyzer complexity thresholds
  (Moderate); not changed.

---

## Phase 4 — Hero image widget + S3 (built 2026-10-15; open questions answered with defaults, not yet reviewed by the owner; **uploads not yet tested end to end**)

### Org state found at the start (dev scratch org)

- `AWS_S3_Directory_Image` **Named Credential still has the placeholder URL**
  (`https://REPLACE_WITH_YOUR_BUCKET.s3.REPLACE_WITH_REGION.amazonaws.com`). Apex reports the same value. Until
  it is set to the real bucket, uploads cannot work and the tool would store placeholder addresses.
  The External Credential (`AwsSv4`, named principal) exists; keys were not inspected.
- CSP trusted sites: `AWS_S3_Directory_Image` = the prod bucket `stthomas-salesforce-directory-images-prod.s3.us-east-1.amazonaws.com`
  (img-src only) and `UST_AWS_S3` = `https://static.aws.stthomas.edu` (img/connect/font/style).
- The bucket name says **prod**: no test objects are uploaded from scratch orgs without an explicit go-ahead.

### How the S3 tool really behaves (read from the deployed source; do not rediscover)

- File key = `md5(orgId + recordId) + fileNameSuffix + extension`. **A null suffix becomes the literal text
  `null`** (verified in Apex), and the later lookup searches `hash.` and never finds it, so the editor
  **always passes a suffix**: `-hero` (desktop) and `-hero-mobile` (mobile).
- It writes the image URL to the record field **itself** (its own Apex update, in user mode, needs Read/Edit
  FLS on that field) and then fires a `RefreshEvent` (`lightning__refresh`). It never reports the URL to the
  parent. So the hero URL fields are **not inputs on the record form** (a later Save would overwrite the fresh
  URL with the form's stale copy); the editor reads them with `getRecord` and refreshes with
  `notifyRecordUpdateAvailable` when the refresh event arrives.
- Resizing happens in the browser (canvas) with `image-max-width` / `image-max-height` and `image-mode`
  `crop` or `resize`; output is always PNG. It needs an existing record (a new, unsaved widget has no Id).
- Only users with the dependency's `AWS_S3_Directory_Image` permission set can upload. Our permission set
  cannot include it (it lives in the dependency), so widget admins need both. `config_dev` already assigns it
  to System Administrators.
- The dependency component is **not in this repo**; it must be installed in an org before our templates that
  reference `c-aws-s3-directory-image` will deploy (CumulusCI does this through `cumulusci.yml` dependencies).

### Decisions (defaults chosen to keep moving; all are single-line changes)

| Topic | Decision |
|---|---|
| Content | Reuses the Static Content fields: **headline** = `Static_Content_Header__c`, **overlay text** = `Static_Content__c` (tags, headings, links), buttons + placement + size from Phase 3. |
| Width | Fills its zone (the zone decides width). Image is `object-fit: cover`. |
| Height | `Hero_Height__c`: Short (12rem), **Medium (20rem, default)**, Tall (30rem). `min-height`, so long text never clips. Smaller on phones. |
| Text position | `Hero_Text_Position__c`: **Left (default)**, Center, Right; vertically centered. |
| Overlay | `Hero_Overlay__c`: Light, **Medium (default for a new widget)**, Strong, or blank (--None--) for **no overlay at all**. Changed 2026-10-16: it was first built with no "none" so white text always had contrast; the owner expected --None-- to show the picture as it is, and blank was silently becoming Medium. Blank now means none in Apex, the banner, and the editor preview; an unknown value still falls back to Medium. Help text warns that white text can be hard to read on light pictures. |
| Mobile image | Optional second upload (`-hero-mobile`); shown with `<picture>` below 48em. |
| No image yet | Solid brand purple, so text is still legible and the widget works before S3 is configured. |
| Alt text | Required in the editor once an image exists; an image without alt text is rendered as decorative (`alt=""`). |
| Image sizes | Desktop crop **1600x600**; mobile crop **800x640**. |
| Cache | The server appends `?v=<widget SystemModstamp ms>` so a replaced image is not served stale (S3 key never changes). |
| Image URL safety | Server accepts `https:` only, no whitespace/quotes/angle brackets/commas/backslash; the browser CSP (`img-src`) is the second wall. |
| Class access | `UST_Portal_Widget_Admin` was missing `PortalButtons` (called directly by the Phase 3 editor): added in this phase. |

### Known limitation

Links inside the rich text on a hero keep the browser's default link color because `lightning-formatted-rich-text`
cannot be styled from outside; use a button for calls to action on a hero.

### Phase 4 — as built

| Piece | Where |
|---|---|
| Fields `Hero_Image_URL__c`, `Hero_Mobile_Image_URL__c` (Url), `Hero_Alt_Text__c`, `Hero_Height__c` (short/**medium**/tall), `Hero_Text_Position__c` (**left**/center/right), `Hero_Overlay__c` (light/**medium**/strong); `Component_Name__c` value `ust_hero_banner`; admin (edit) and guest (read) permission sets | `objects/UST_Portal_Widget__c/fields/` |
| Image-address allowlist, cache-busting `?v=`, defaults, alt text; `getHeroImages` for the editor (100% coverage, 10 tests) | `classes/PortalHero.cls`, `tests/default/classes/PortalHero_TEST.cls` |
| Controller adds `hero` to the DTO for hero widgets only; headline, text, and buttons use the existing tag and button handling | `classes/PortalWidgetController.cls` |
| Banner renderer: picture + optional mobile `<picture>` source, dark layer, text position, brand-colour fallback, load-error fallback (16 tests) | `lwc/ustHeroBanner/` |
| "Over a picture" styling (white text, readable outline buttons) added to the shared renderers | `lwc/ustStaticContent/`, `lwc/ustWidgetButtons/` (`overImage`) |
| Zone registry entry and template branch | `lwc/ustWidgetZone/` (3 render tests) |
| Editor: Hero section with the two S3 uploaders, alt text, height, position, overlay, hero preview, alt-text gate; Reset now also restores the header | `lwc/ustWidgetRecordEditor/` (15 new tests) |
| Jest stand-in for the uploader dependency (outside `force-app`, never deployed) and its `moduleNameMapper` | `jest-stubs/awsS3DirectoryImage/`, `jest.config.js` |
| `UST_Portal_Widget_Admin` also grants `PortalButtons` (missed in Phase 3) and `PortalHero` | `permissionsets/` |

**Verified in the dev org.** Real Experience Builder render of the Home page with a sample picture (served from a
temporary scratch-only CSP entry that was removed again): picture loaded, `object-fit: cover`, mobile `<source>` for
`max-width: 767px`, alt text, white 40px headline with the tag resolved, both buttons legible (solid + outline),
portal link `/alumni/alumni-directory`. Editor on the record page: both uploaders are the real dependency component
with the right suffix and crop size, no image-URL field is on the form, labels read Headline and Overlay text, the
panel style is hidden, and **Save leaves the two image addresses untouched** (changed the overlay, saved, queried).
Jest 272/272; Apex hero/buttons/tags/registry/controller tests green; org-wide Apex failures unchanged at 80
(environmental); Code Analyzer: no High findings. The test widget was restored to its exact original values.

**NOT verified: an actual upload.** The dev org's `AWS_S3_Directory_Image` Named Credential still has the
placeholder URL, and the uploader returns `AWS S3 request failed: received status 503`. The bucket is named "prod",
so no test objects were uploaded. Remaining checks once the credential points at a bucket you are happy to test in:
upload a desktop and a mobile picture, confirm both addresses appear in the preview and on the record, replace one
and confirm the new picture shows (cache-busting), delete one, and confirm the `?v=` address works against the real
bucket policy.

**Findings that shaped the build (do not rediscover).**
- **LWC reserves property names starting with `on`** (LWC1108), like `data`; the "shown over a picture" property is
  `overImage`.
- **The uploader needs a saved widget** (it uses the record Id). A new, unsaved widget shows "Save the widget first".
- **The uploader's `lightning__refresh` event bubbles and would reload the record page** (losing unsaved edits); the
  editor stops it at its own boundary and re-reads only the two addresses (`PortalHero.getHeroImages`, not
  cacheable).
- **Mock call history leaks between Jest tests** unless cleared; the new tests clear `getHeroImages` in `beforeEach`.
- **The Salesforce CLI mangles JSON in `--values`** for `sf data update record`; use anonymous Apex for such updates.
- The hero reuses the Static Content fields for headline, text, and buttons, so the existing "Preview as a guest"
  switch, tags, and button rules all work on a hero without extra code.

**Setup per org before pictures can be uploaded** (cannot be automated: secrets and environment-specific):
1. Set the Named Credential `AWS S3 Directory Image` **Url** to the bucket (`https://<bucket>.s3.<region>.amazonaws.com`).
2. Set the CSP trusted site `AWS_S3_Directory_Image` to the same bucket URL with **img-src** checked (and any other
   host that will serve the pictures, such as a CloudFront domain).
3. Enter the AWS Access Key and Secret on the External Credential principal (Named Principal).
4. Assign `AWS_S3_Directory_Image` (from the dependency) **and** `UST_Portal_Widget_Admin` to widget admins. `config_dev`
   already assigns both to System Administrators.
5. Republish the site after changing CSP or permission sets, and give each hero widget a Hero Image Field FLS (done in
   `UST_Portal_Widget_Admin` and the guest set).

**Bug found and fixed after Phase 4: switching a widget to Hero Banner showed no Hero section.** Reported as "the S3
upload and options are missing". Opening a widget that was *already* a Hero Banner worked, which is all the Phase 4
browser checks covered; changing the type on an existing widget did not. Cause: `lightning-record-edit-form` fires
`load` again whenever its field list changes (here, when the hero fields join the form), and each repeat reports the
**saved** values. `handleLoad` copied them over the editor, so the Component Name dropdown still showed the new choice
while the editor state snapped back to Static Content (any other unsaved edit was exposed the same way). Fix: the
editor initialises once per record (`_initialisedRecordId`) and ignores repeat loads; `handleReset` and `handleSuccess`
now also restore/track the widget type. Five Jest tests added (three fail without the fix). Verified in the browser by
switching the Static Content `TEST` widget to Hero Banner. Lesson for later phases: test the *change* path in a real
browser, not only the load path; Jest's single synthetic `load` could not show this.

**Editor layout (2026-10-16).** Each part of the form is its own card, in a fixed order: Widget Setup, Content,
Call-to-action buttons, Hero Banner (hero widgets only), Preview, Audience Filters. Content is always directly below
Widget Setup and Preview is always directly above Audience Filters (pinned by tests for Static Content, Hero Banner,
types with no content, and after switching type). Card titles are 20px bold with a UST-purple underline. The button
editor no longer draws its own heading (the card title names it). To move the Hero Banner card, move its one
`<template lwc:if={showHeroSection}>` block in `ustWidgetRecordEditor.html`.

**Signed-in portal users: permission set, sharing set, and sample users (2026-10-16).** Signed-in alumni on the LWR
site had no access to any portal Apex or to the directory fields. The old `Alumni Community User` profile belonged to
the earlier Aura site and is not used here, so access is granted by two things, both proven by a test that runs as a real
Customer Community user (`Alumni_Portal_User_TEST`, 4 tests):
- **`Alumni_Portal_User` permission set** (`force-app`): the 6 controllers a portal page calls, read on the directory,
  business directory, news and widget objects with only the fields those controllers read (no email, phone, birthdate, or
  street address; found by running the controllers as the user and adding what each missing field broke), the
  `Alumni_Business` record type, and edit on the person's own profile fields. The public business directory
  (`AlumniBusinessDirectoryController`) now runs in system mode because guests read it, so it needs no field grants: only
  9 `Professional_Directory__c` fields remain, for the profile and connected-profile pages. The guest set
  `Alumni_Portal_Guest_User` also grants that controller and the `Alumni_Business` record type, because the record type
  lookup is per user even in system mode. In system mode the controller's SELECT list and WHERE clause are the only gates on
  what a guest sees, so review them when they change. Favorites stay in `Alumni_Favorites_User`.
  Assign both to portal users; this is the grant for production too, not just scratch orgs.
- **Sharing Set `Alumni Directory Edit Own`** (`unpackaged/config/portalSharing`, task
  `create_community_portal_sharing_set`, `config_dev` step 5.8): maps `Alumni_Directory__c.Contact__c` to the user's own
  Contact with Edit. Without it a portal user can read but **cannot edit their own profile** (`UserRecordAccess
  edit=false`, every update fails with INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY, even from a `without sharing`
  class). A permission set cannot fix that. It applies to the `Customer Community Login User` profile. For EDA-Staging or
  production, check whether an equivalent sharing set exists by hand and deploy this one if not.
- **Sample users** (`config_dev` steps 90 to 92): the alumni dataset loads the people, `create_sample_portal_users`
  makes users smp1 to smp4 and assigns both permission sets, `link_sample_portal_users` sets `Contact.Portal_User__c`
  and `Alumni_Directory__c.Community_Profile__c`. Idempotent. The Alumni network stays `UnderConstruction` in a dev org
  until published, so the proof is the Apex test, not a browser login.

**Existing gaps found on the way (not caused by this work).** `Contact.Community_Address_Range__c` (a city and state formula
used by the news search) and `Contact.Degree_s_Formatted__c` (business directory) were added to the repo on 2026-10-16.
`Alumni_Portal_User_TEST` now calls the public directory and runs a news search as a signed-in user; the search failed for
every portal user until `Alumni_Portal_User` granted `Contact.Community_Address_Range__c`. The **Academic Majors widget filter
does not work**: the controller lines that load the user's majors are commented out (they referenced a `Contact.Academic_Majors__c`
that does not exist), so any widget using that filter is shown to nobody. The data is on `Alumni_Directory__c.Academic_Major_s__c`
(same `Academic_Majors` value set). `Contact.Job_Title__c` exists in the org but not in the repo source. Three older test suites
(business directory, connected profile, my profile) fail in any scratch org because the Admin profile cannot use the
`Alumni_Business` record type; the cause is the profile, not a missing field. The `Alumni_Directory__c` record type and field sets behind EDA-Staging may differ.

**Record sharing (added after Phase 4).** `UST_Portal_Widget__c` has an external default of Private, so signed-in portal
users and the site guest could not read widget records directly (only through the `without sharing` controller).
There are now two rules, both Read-only and both limited to `Is_Active__c = true`:
- `ShareActiveWidgetsWithPortalUsers` shares with All Customer Portal Users (signed-in portal users). Lives in
  `force-app/main/default/sharingRules/UST_Portal_Widget__c.sharingRules-meta.xml`.
- `ShareActiveWidgetsWithAlumniGuest` shares with the Alumni site guest user (community nickname `Alumni`). Lives in
  `unpackaged/config/guestSharing/` and is deployed by the task `create_community_guest_sharing` (`config_dev` step
  5.7), **not** with `force-app`. A guest rule fails to deploy ("Specify a guest user's nickname for the guestUser
  field", reproduced) until the site and its guest user exist, and `force-app` is deployed before `create_community`;
  keeping it in `force-app` would have broken every fresh `cci flow run dev_org`. The folder is raw metadata format
  (`package.xml` plus `sharingRules/<Object>.sharingRules`, no `-meta.xml`). For EDA-Staging or production, deploy that
  folder after the site exists.

Why: widgets are published content, and the pictures a Hero Banner points at must load for guests. Widgets hold no
personal data: data tags (`{{First_Name}}` and so on) are stored as plain text and only resolved per viewer at render
time, so a viewer who reads the record directly (for example through an Aura endpoint) sees the tag, not anyone's
data. Do not type real personal details into widget text. Turning a widget off removes the share; turning it on adds it
(checked in the dev org: 18 active widgets, 18 shares per rule, 0 for the inactive one, and a toggle added then removed
both rows). Field access is still limited by the `Alumni_Portal_Guest_User` permission set.

**Known limits / follow-ups.**
- Links typed inside the overlay text keep the browser link colour (use a button for calls to action).
- The S3 tool always saves PNG (large files for photos), keeps the same file name when replacing (handled here with
  `?v=`, but not for other uses of the tool), and has no responsive sizes or CDN. Candidate changes in the tool repo:
  JPEG ~0.85 for photos, a versioned file name, and a second size.
- Inline images in Static Content are still not supported (see the decision above).
- A hero is as wide as its zone; full-bleed width depends on where the zone sits in the page template.
- The alt-text rule blocks Save when a picture exists; a "decorative image" option could be added if needed.

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
- [x] Phase 1 — spikes (insert-at-cursor works; portal links = relative paths via GenerateUrl; picker = site menu + typed path)
- [x] Phase 2 — data tags (done 2026-10-15; see "Phase 2 — as built")
- [x] Phase 3 — buttons (done 2026-10-15; see "Phase 3 — as built")
- [x] Phase 4 — hero widget + S3 built and verified except real uploads (blocked on the S3 credential; see "Phase 4 — as built")

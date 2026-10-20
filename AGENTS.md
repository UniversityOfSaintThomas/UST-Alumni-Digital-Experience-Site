# AGENTS.md — UST Alumni Digital Experience Site

Personalized alumni portal on **Salesforce Experience Cloud (LWR)** using LWC widget components, EDA (`hed__` namespace), and CumulusCI. See `docs/MAIN_GUIDE.md` for full architecture; `docs/AI-TOOLS-CONFIG.md` for org aliases and deployment troubleshooting.

---

## Architecture: Widget Zone System

Every portal section is a self-contained LWC widget. Admins control layout via `UST_Portal_Widget__c` records — no code or Experience Builder changes needed for routine content changes.

**Data flow:**
```
UST_Portal_Widget__c record (Zone/Page/Component/Audience)
  → ustWidgetZone.js calls PortalWidgetController.getWidgetsForZone()
  → ustWidgetZone.html renders matching LWC via lwc:if/lwc:elseif chain
  → unregistered components fall through to ustPortalWidgetStub (Builder-visible, live-invisible)
```

**Adding a new widget requires exactly 3 changes:**
1. Add entry to `WIDGET_REGISTRY` in `lwc/ustWidgetZone/ustWidgetZone.js`
2. Add `<template lwc:elseif={widget.isMyWidget}>` block in `lwc/ustWidgetZone/ustWidgetZone.html`
3. Deploy both `ustWidgetZone` and the new widget LWC together

**A new widget that needs a new field on `UST_Portal_Widget__c` (or a field on a new child object) has more places to touch, and missing one fails silently** (the value just never arrives). Walk this list every time:
1. Field XML under `objects/UST_Portal_Widget__c/fields/` (restricted picklists with **no default** if blank must mean "none"; a default fills every existing record).
2. `fieldPermissions` in all three sets: `UST_Portal_Widget_Admin` (editable), `Alumni_Portal_Guest_User` and `Alumni_Portal_User` (read only). A guest cannot see a field that is missing here.
3. `PortalWidgetController`: add it to the SOQL **and** to the DTO and its mapping.
4. `ustWidgetZone.js` `buildWidgetRegistry` (it copies DTO fields one by one) **and** the attribute in `ustWidgetZone.html`.
5. The widget LWC: an `@api` property with an allowlist for picklist values (unknown values ignored).
6. `ustWidgetRecordEditor`: input, state, preview attribute, saved copy, Reset and Save. A field that is only on screen for one widget type goes in `LATE_FIELDS` (see the editor bullet).
7. Apex test, Jest tests, `datasets/widgets/widgets.recipe.yml` example, `docs/WIDGET-CATALOG.md`.

> **Critical:** Dynamic `import()` and `lwc:is` are NOT supported at the current API version — they throw LWC1503. Always use the static `lwc:if/lwc:elseif` chain. See `docs/MAIN_GUIDE.md#adding-a-new-widget-to-the-registry`.

---

## Key Files

| Path | Role |
|------|------|
| `force-app/main/default/lwc/ustWidgetZone/` | Widget zone host — placed on Experience Builder pages |
| `force-app/main/default/lwc/ustAlumniTheme/` | Theme layout shell (header + main slot + footer) |
| `force-app/main/default/lwc/ustSharedStyles/` | CSS-only module (`@import 'c/ustSharedStyles'`): the shared look (H1/H2/H3, links, arrow link, pill buttons, `.ust-on-dark`). Needs a Jest stub (`jest-stubs/`) |
| `force-app/main/default/lwc/ustStaticContent/`, `ustHeroBanner/`, `ustWidgetButtons/` | The shipped widgets. Static Content has Section Background and Accent; the Hero has its own band (`Hero_Layout__c`) |
| `force-app/main/default/lwc/ustWidgetRecordEditor/` | Admin editor for a widget record (see the editor bullet below) |
| `force-app/main/default/lwc/ustCardGrid/`, `ustWidgetItemEditor/`, `classes/PortalCardGrid.cls` | Card Grid widget (5.5): the cards are child records `UST_Portal_Widget_Item__c` (Master-Detail to the widget). `PortalCardGrid` cleans them for the portal and serves the editor; the portal query is in `PortalWidgetController` |
| `force-app/main/default/staticresources/ustAlumniThemplate/css/ust-branding.css` | Site-wide brand hooks (`--dxp-*`), Spring 2026 refresh. Plan and lessons: `docs/WIDGET-AUTHORING-PLAN.md`, Phase 5 |
| `force-app/main/default/classes/PortalWidgetController.cls` | Widget query + audience filtering (`All`, `Donor`, `Parent`, `Faculty_Staff`) |
| `force-app/main/default/objects/UST_Portal_Widget__c/` | Widget control object (zone, page, component, audience, sort order) |
| `force-app/main/default/permissionsets/Alumni_Portal_Guest.permissionset-meta.xml` | Guest user access — must include any new Apex callable by unauthenticated pages |
| `unpackaged/config/experiences/digitalExperiences/site/Alumni1/` | Experience Bundle snapshot (routes, views, theme, CSS) |
| `docs/WIDGET-CATALOG.md` | Full widget inventory and status |
| `docs/DATA-MODEL.md` | Custom objects, EDA field map, TBD fields to confirm with advancement team |

---

## Developer Workflows

```powershell
# Create/recreate dev scratch org (7-day; EDA pre-installed via "EASY" snapshot)
cci flow run dev_org --org dev

# Deploy LWC components
cci task run deploy --path force-app/main/default/lwc --org dev

# Deploy a single component
cci task run deploy --path force-app/main/default/lwc/ustWidgetZone --org dev

# Deploy to EDA-Staging (persistent, has real-ish seed data)
sf project deploy start --source-dir force-app/main/default/lwc --target-org EDA-Staging

# LWC Jest tests
npm test
npm test -- --coverage

# Apex tests (single class)
sf apex run test --class-names PortalWidgetController_TEST --target-org UST-Alumni-Digital-Experience-Site__dev --result-format human --code-coverage --wait 20

# All Apex tests (75% coverage required)
cci task run run_tests --org dev

# Code analysis
sf code-analyzer run --target force-app/main/default --output-file ai-logs/code-analyzer.json --severity-threshold 3 2>&1 | Out-File ai-logs/ca-run.txt

# Sample data (loaded automatically by config_dev steps 90-92; see "Sample data" below)
cci task run load_sample_data --dataset widgets --org dev
cci task run delete_sample_widgets --org dev

# Re-sync Experience Bundle after Experience Builder changes
sf project retrieve start --metadata "DigitalExperienceBundle:site/Alumni1" --output-dir unpackaged/config/experiences --target-org UST-Alumni-Digital-Experience-Site__dev
```

---

## Sample Data (scratch orgs)

`datasets/dev` is loaded by `config_dev` step 90 and includes `datasets/widgets` (22 `[Sample]` widgets covering every zone, page context, filter, and edge case) and `datasets/alumni` (16 Contacts + 15 Alumni Directory records). Steps 91 and 92 (`create_sample_portal_users`, `link_sample_portal_users`, Apex in `datasets/alumni/`) create portal users smp1 to smp4 with `Alumni_Portal_User` + `Alumni_Favorites_User`, then link them to their Contact and Directory record. Full table and persona list: `docs/MAIN_GUIDE.md#sample-data-for-scratch-orgs`.

- **Users cannot go through a Snowfakery recipe** (the loader demands all 119 platform-defaulted `User` checkboxes), and a User and a Contact cannot change in one transaction, hence two Apex scripts.
- **People and users load once per org.** A Contact with a portal user cannot be deleted. Widgets can be reset (`delete_sample_widgets`) and reloaded. A scratch org has 5 Customer Community Login licenses; the sample uses 4.
- **`School_College`, `Degree_Types`, `Varsity_Sports`, `Academic_Majors` keep every real value inactive in this repo** (only `Placeholder` is valid, and the fields are restricted), so sample data and filters use `Placeholder` for those. Do not activate them in a scratch org to make a load pass.
- **The Alumni network stays `UnderConstruction` in a dev org until published**, so a browser login as a sample user is not possible there. Prove portal-user access with `Alumni_Portal_User_TEST` (runs the controllers as a real Customer Community user).
- **Known gaps, not caused by recent work:** the **Academic Majors widget filter does not work**: `PortalWidgetController` has the lines that load the user's majors commented out (they pointed at a `Contact.Academic_Majors__c` that does not exist; the data is on `Alumni_Directory__c.Academic_Major_s__c`), so a widget with that filter shows to nobody. `Contact.Community_Address_Range__c` (news search) and `Contact.Degree_s_Formatted__c` (business directory) are now in the repo. `Contact.Job_Title__c` exists in the org but not in the repo source.

---

## Org Strategy

| Alias | Type | Notes |
|-------|------|-------|
| `dev` / `UST-Alumni-Digital-Experience-Site__dev` | 7-day scratch | EDA installed via EASY snapshot; recreate with `cci flow run dev_org --org dev` |
| `EDA-Staging` | Persistent sandbox | `dahl3702_heda@stthomas.edu.edastaging`; use for integration tests with real EDA data |

---

## Critical Conventions

- **LWR site only** — Aura components are not supported; never use `aura` or `aloha` templates
- **EDA namespace:** All Higher Education objects use `hed__` prefix (e.g. `hed__Affiliation__c`, `hed__Program_Enrollment__c`); available in both orgs
- **Audience rules** (`Donor`, `Parent`, `Faculty_Staff`) are stubbed in `PortalWidgetController.resolveUserAudiences()` — only `All` is active; confirm Contact field API names before un-commenting
- **Widget record sharing** is two rules for active widgets (Read): portal users in `sharingRules/UST_Portal_Widget__c.sharingRules-meta.xml`, and the `Alumni` guest in `unpackaged/config/guestSharing/` (task `create_community_guest_sharing`, `config_dev` step 5.7). The guest rule must NOT go in `force-app`: it needs the site's guest user, which only exists after `create_community`. The object's external default is Private, so a new widget-like object needs its own rule. Never put personal data in widget text.
- **Business directory is public:** `AlumniBusinessDirectoryController` runs `without sharing` in `SYSTEM_MODE` because guests read it, so its SELECT list and WHERE clause are the only gate on what a guest sees. The `Alumni_Business` record type is still looked up per user, so both permission sets grant it.
- **Signed-in portal users** get access from the `Alumni_Portal_User` permission set (Apex, fields) plus the `Alumni Directory Edit Own` sharing set in `unpackaged/config/portalSharing/` (edit own profile). The old `Alumni Community User` profile belonged to the Aura site and is not used. Sample users smp1 to smp4 are made by `create_sample_portal_users` (see `datasets/alumni/`); Snowfakery cannot load `User`.
- **Guest user Apex access** goes in `Alumni_Portal_Guest` permission set (not in Guest profile). After changing any permission set on the guest user, **republish the site** from Experience Builder — CDN caches stale responses
- **Experience Bundle:** Must keep `source_format: sfdx` in the `create_community_experience_cloud_bundle` CCI task and never flatten the `site/Alumni1/` folder structure. See `docs/AI-TOOLS-CONFIG.md#experience-cloud-bundle` for the full error-cause reference table
- **NavigationMenu, Network, and DigitalExperienceConfig are separate from the Experience Bundle** and live in their own `unpackaged/config/` folders. Only `NavigationMenu` has a deploy task (`create_community_navigation`) wired into `config_dev`; the other two are backup snapshots only, not deployed anywhere yet
- **Default Navigation menu binding breaks on every fresh org** if not handled — Salesforce assigns its `NavigationLinkSet.DeveloperName` non-deterministically per org (`Default_Navigation`, `_1`, `_2`, ...) and won't allow renaming it for uniqueness. `tasks/sync_navigation_menu.py` (flow step `config_dev` 4.5) queries the real value and rewrites the theme layout's binding before every bundle deploy — don't hardcode a specific `Default_NavigationN` value in `content.json`. Symptom if this ever regresses: Experience Builder error *"Couldn't load the selected navigation menu."* See `docs/AI-TOOLS-CONFIG.md#experience-cloud-bundle` for the full writeup
- **When retrieving pages from a source org (e.g. EDA-Staging) that reference LWCs/Apex/objects not yet in `force-app`:** grep the bundle's `content.json` files for `"c:ComponentName"` refs and diff against `force-app/main/default/lwc/` to find all missing components in one pass, then trace each one's Apex/static-resource/object dependencies before redeploying. Check `sf package installed list` on the target org before adding a new managed-package dependency to `cumulusci.yml` — the `dev` scratch org's EASY snapshot already bakes in EDA and Summit Events App. Not every dependency is worth chasing: drop widgets blocked by real environment gaps (e.g. a managed package's Record Type only configured in the source org) rather than trying to replicate org-specific setup. See `docs/AI-TOOLS-CONFIG.md#experience-cloud-bundle` for the full methodology and dead ends already hit
- **Widget editor (`ustWidgetRecordEditor`):** cards in a fixed order: Widget Setup, Content, Call-to-action buttons, Hero Banner (hero only), Preview, Audience Filters. Content must stay directly under Setup and Preview directly above Filters (pinned by tests). `handleLoad` initialises **once per record**: `lightning-record-edit-form` fires `load` again with the saved values whenever its field list changes, which used to silently undo a type change. Never copy record values into state on every `load`. **Exception that bit us in 5.3:** the hero fields only join the form after the type is known, so they are absent from the first loads; `initialiseHeroSettings()` reads them the first time a load contains them. Any new field that exists for only one widget type needs the same treatment. **5.4 generalised this:** the panel style, section background and accent, and button placement and size are also late, so they are read through `LATE_FIELDS` / `initialiseLateFields()` (add new type-dependent inputs there, plus `applyLateField`, `handleReset` and `handleSuccess`).
- **Hero Banner overlay:** blank (`--None--`) means **no overlay** in Apex (`PortalHero`), the banner, and the editor preview; a new widget starts on Medium (the field default); an unknown value falls back to Medium. White text on a light picture is unreadable with no overlay, which the field help text says.
- **Picklist values** (e.g. `Preferred_Communication_Channel__c`) must be queried from org schema in tests — never hardcoded
- **What 5.1 built, in the Spring 2026 refresh** (`lwc/ustSharedStyles`, tokens, `:root:root` hooks): see `docs/WIDGET-AUTHORING-PLAN.md`, Phase 5. Before editing `ust-branding.css` read the "SLDS skills review" notes there: **check every `--dxp-*` hook name against the official list or the compiled CSS before adding it** (16 old ones did nothing), the Theme panel's branding set overrides a plain `:root` rule (use `:root:root`), and the SLDS button variants take horizontal padding from per-variant `--slds-c-button-<variant>-spacing-inline-*` hooks.
- **Page width and gutters (5.2):** body content is capped at **1344px** with a fluid gutter, set through Builder's own section hooks in the `:root:root` block of `ust-branding.css` (`--dxp-s-section-columns-max-width`, `--dxp-s-section-content-spacing-inline-*`, including the `-mobile` pair). Widgets in the `banner` and `above_footer` zones are page-wide; line their content up with `--ust-content-inset` (see `ustHeroBanner` and its `fullWidth` flag). Do not add a `100vw` bleed hack.
- **Official LWR hooks list:** `developer.salesforce.com/docs/platform/exp-cloud-lwr/guide/brand-hooks-map.html` (plain fetch returns 403; use browser-rendered extraction as in the `platform-docs-get` skill).
- **Site link rule beats component CSS (found after 5.4).** `dxp-slds-extensions.min.css` styles every `a:link:not(.slds-button, ...)` (and `:hover`/`:active`/`:focus`) with `text-decoration` and `color` read from `--dxp-c-link-*` / `--dxp-s-link-*` hooks, and its specificity beats a plain class rule. A custom link that draws its own underline therefore got a second, real one on the published site (the editor preview, which runs in Lightning Experience and does not load that stylesheet, looked fine). Set the hooks **on the element** (`.ust-link` and `.ust-arrow-link` do), and for rich text on a dark panel `.ust-on-dark` sets `--dxp-s-link-text-color` white, because rich-text links sit in their own shadow tree.
- **Verify styling on the site URL, not only in the editor preview or Builder.** The preview in Lightning Experience misses site-wide stylesheets. The check that works: create `ZZ_PROBE` widgets by anonymous Apex, open `https://<site>.live-preview.salesforce-experience.com/alumni/`, read computed styles through shadow roots, compute WCAG ratios against the panel color, force `:hover`/`:focus` with CDP `CSS.forcePseudoState`, then delete the probes (`DELETE ... WHERE Name LIKE 'ZZ_PROBE%'`). It found two real defects in 5.4 that every unit test passed.
- **Static Content backgrounds (5.4):** `Section_Background__c` (white, gray, light_purple, purple, dark_purple) and `Section_Accent__c` (green_circles, purple_circles) are allowlisted in `ustStaticContent.js` and painted in `ustStaticContent.css`. `Content_CSS_Class__c` callout and inverse still work as Light Purple and Purple; a chosen background replaces them. Purple and Dark Purple add `.ust-on-dark`. Do not apply them to the hero (it has its own band).
- **Page context is matched in Apex, not SOQL.** `PortalWidgetController` filters by zone and active in SOQL and by page (`widgetMatchesPage`, which treats `all` as every page) afterwards. A SOQL `Page_Context__c INCLUDES (:page)` once hid every All Pages widget. Keep it out of the query, and test `all`, a multi-page value and a different zone.
- **Card Grid (5.5):** a widget with child records is built like this: child object Master-Detail to the widget (shares and deletes with it, no new sharing rule), a pure `prepare()` class that reuses `PortalHero.isAllowedImageUrl` and `PortalButtons.isAllowedUrl`, the guest-facing query in `PortalWidgetController` (a `with sharing` helper class would not run without sharing), editor calls that refuse bad input with a message and are scoped to the widget id, and a preview that asks Apex instead of copying the rules into JavaScript. The renderer composes `ustStaticContent` through its slot instead of copying the heading, buttons and panel.
- **LWC CSS specificity (found in 5.5):** LWC adds an attribute selector to every compound in a selector, so `.a[x] .b[x]::after` outranks `.c:hover[x]::after` even though the source looks equal, and a hover rule silently never wins. Move the value into a custom property that the state rule changes (see `--ust-card-bar` in `ustCardGrid.css`), and when a state does nothing read the compiled rule from the page's `<style>` tag.
- **Container queries use `rem`:** `em` inside `@container` follows the container's own font size. Use a container query, not a window width, for anything that can sit in a narrow zone (the body zone is 875px wide at a 1440px window).
- **A class grant is invisible to a System Administrator.** The widget admin set lacked `PortalCardGrid` and every browser check passed, because the check ran as sysadmin. Add each new Apex class the editor calls to `UST_Portal_Widget_Admin` and to the list in `PortalWidgetAdminAccess_TEST`.
- **Jest `flushPromises` in the editor tests is one microtask.** A "late answer is ignored" test must wait for the re-render too (two flushes and a `setTimeout`), or it passes without its guard. Always run the mutation.
- **Admin-flow browser checks without a login URL in the output:** the Playwright MCP sandbox has no Node APIs, so drive a real Lightning record with a script run from the shell (`playwright-core` from the npx cache; the version must match the installed browser, `ls ~/.cache/ms-playwright`). It reads `sf org open --url-only` into memory only and prints nothing but results. Find row buttons by accessible name (`getByRole('button', { name })`); the icon hosts have no `title` attribute.
- **A CSS-only LWC module needs a Jest stub** (`jest.config.js` `moduleNameMapper`, files in `jest-stubs/`), like the S3 uploader.
- **Branding:** Apply UST colors via CSS custom properties; see `docs/BRAND-COLORS.md` for HEX/RGB/PMS values. Base is SLDS with 8px spacing unit

---

## External Dependencies

- **`awsS3DirectoryImage` LWC** (+ `awsDirectoryImageController` Apex, `errorPanel`/`ldsUtils` helpers) — pulled in via a GitHub source dependency in `cumulusci.yml` (`UniversityOfSaintThomas/Salesforce-LWC-S3-Integration`, `force-app` subfolder only). Deploys automatically with every `cci flow run dev_org`. Displays/uploads an image from AWS S3 onto any record's field — usable as-is for profile image upload (e.g. Contact) or a hero image uploader on a new widget's control object. Drop `<c-aws-s3-directory-image record-id={recordId} image-field="Your_Field__c">` into a component/page; the target field just needs Read/Edit FLS granted to the running user (the packaged `AWS_S3_Directory_Image` permission set only covers the Apex/Named Credential/External Credential access, not your specific field).
  - Auto-assigned to System Administrators via the `assign_aws_s3_directory_image_permset` task (`config_dev` step 1.4).
  - **Requires one-time manual per-org setup, not automatable via CumulusCI** (secrets/env-specific): set the real S3 bucket URL on the `AWS S3 Directory Image` Named Credential *and* the `AWS_S3_Directory_Image` CSP Trusted Site (both ship with placeholder URLs), and enter the AWS Access Key/Secret on the External Credential's Named Principal. See the dependency repo's README for exact steps and troubleshooting table.
  - Only JPG/GIF/PNG uploads are accepted (enforced server-side in the controller).

---

## Testing Gotchas

- **Components from the CumulusCI dependency (`awsS3DirectoryImage`) are not in this repo, so Jest cannot resolve them.** `jest.config.js` maps `c/awsS3DirectoryImage` to a stand-in in `jest-stubs/` (outside `force-app`, never deployed). Add the same kind of mapping for any other dependency component a template uses.
- **LWC reserves public property names starting with `data` or `on`** (LWC1107 / LWC1108) - a whole test suite fails to compile if one slips in.

- **`TestAlumniCommunityDataFactory` works in a scratch org and in EDA-Staging.** It uses the `Alumni Community User` profile and the user named `ETL User` when the org has them (staging does), and otherwise falls back to `Customer Community Login User` plus the `Alumni_Portal_User` and `Alumni_Favorites_User` permission sets, and to the running admin. `integrationUser()` is public so other tests use the same rule. Do **not** point the factory at the site's Guest profile or any other profile that merely exists. The factory also inserts Contacts with the duplicate-rule bypass, because the platform's standard Contact duplicate rule flags the look-alike test people in a clean org. The Admin profile can use `Professional_Directory__c.Alumni_Business` only because `update_admin_profile` in `cumulusci.yml` lists it under `record_types` (with `default: true`); without that every test that builds business listings fails with `INVALID_CROSS_REFERENCE_KEY`.
- **Most Apex test classes in a scratch org are not this repo's.** Of the classes with coverage, 10 are in this repo and 59 come from the EASY snapshot (the Admissions portal). Six snapshot test classes fail in a scratch org and cannot be fixed from here: `AdmissionsApplicationFinderCmp_TEST`, `requestForInformationFormController_TEST` and `ApplicationQuestion_TEST` write real `School_College`, `Degree_Types` and `Associated_Schools` values that this repo keeps inactive; `ScholarshipController_TEST` needs an `OrgWideEmailAddress` (not insertable by Apex, created in Setup with an email verification); `INT_InteractionProcessor_TEST` expects `Oppmatching` where the code produces `OppMatching`; `ApplicationBodyController_TEST` expects three `EASY_Widget__c` records it does not get. That leaves `ApplicationBodyController`, `ApplicationAdminView` and `ApplicationQuestion` under 75%. Activating the two value sets was tried in the dev org and was not enough (other restricted fields fail next), so it was reverted.
- **Contact `MailingCountry`/`MailingState` (legacy label fields) are unreliable across orgs** — this org's State/Country picklist settings enforce `United States of America` in some environments while a fresh scratch org may only accept `United States`, causing `FIELD_INTEGRITY_EXCEPTION` on insert. Use `MailingCountryCode`/`MailingStateCode` (ISO codes, e.g. `US`/`IL`) in test data factories instead — codes are stable regardless of org-specific picklist label text.
- **Jest + base Lightning stub components:** `label` (and similar `@api` string props) on components like `lightning-button` are JS properties, not reflected DOM attributes. `shadowRoot.querySelector('lightning-button[label="Save"]')` will not match anything. Query all `lightning-button` elements and filter on the `.label` property instead (see `lwc/alumniProfile/__tests__/alumniProfile.test.js` for the `findButtonByLabel` pattern).

---

## Data Model Quick Reference

- **Contact** — central record for every alumnus; most widgets read/write here
- **`hed__Affiliation__c`** — college/school association
- **`hed__Program_Enrollment__c`** — major/minor
- **Campaign / CampaignMember** — events and registrations
- **`UST_Portal_Widget__c`** — widget zone control records
- Several Contact flag fields (Donor, Faculty/Staff, Parent, Engagement Score) are **TBD** — see `docs/DATA-MODEL.md` for action items


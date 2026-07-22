# AI Tools Config — UST Alumni Digital Experience Site

Project-specific context for GitHub Copilot and AI tooling.
See global instructions for general patterns and commands.

---

## Project Identity

| Key | Value |
|-----|-------|
| Project Name | UST-Alumni-Digital-Experience-Site |
| Platform | Salesforce Experience Cloud (LWC) |
| CumulusCI Project Name | `UST-Alumni-Digital-Experience-Site` |
| API Version (CCI) | 63.0 |
| API Version (SFDX) | 65.0 |
| Source Format | SFDX (`force-app/main/default/`) |

---

## Org Strategy

| Purpose | CCI Alias | SF CLI Alias | Username | Notes |
|---------|-----------|-------------|----------|-------|
| Development | `dev` | `UST-Alumni-Digital-Experience-Site__dev` | *(scratch — recreate as needed)* | 7-day scratch org |
| Staging / Integration | `EDA-Staging` | `EDA-Staging` | `dahl3702_heda@stthomas.edu.edastaging` | Persistent; has EDA package installed |

> **Note:** The `dev` scratch org expires every 7 days. Recreate with `cci flow run dev_org --org dev`.
> The staging org (`EDA-Staging`) is the primary target for integration testing because it has EDA (Higher Education Data Architecture) installed.

### Key Commands

```powershell
# Deploy LWC components to dev scratch org
cci task run deploy --path force-app/main/default/lwc --org dev

# Deploy to EDA-Staging (use SF CLI alias)
sf project deploy start --source-dir force-app/main/default/lwc --target-org EDA-Staging

# Run Apex tests against dev scratch org (EDA available via EASY snapshot)
sf apex run test --class-names ClassName_TEST --target-org UST-Alumni-Digital-Experience-Site__dev --result-format human --code-coverage --wait 20

# Query org data
sf apex run --target-org UST-Alumni-Digital-Experience-Site__dev --file ai-logs/check_something.apex 2>&1 | Tee-Object ai-logs/anon_out.txt
```

---

## Installed Managed Packages

| Package | Namespace | Notes |
|---------|-----------|-------|
| EDA (Higher Education Data Architecture) | `hed__` | Available on **both** dev scratch org (via "EASY" snapshot) and EDA-Staging |

> **Snapshot:** The dev scratch org is created from the `EASY` org snapshot (defined in `orgs/dev.json`), which includes EDA pre-installed. This means `hed__` types (e.g. `hed__Affiliation__c`) are available in the dev scratch org — Apex classes and tests referencing EDA can be deployed to and compiled against `--org dev`.

---

## Architecture Overview

This project builds a **personalized alumni portal** on Salesforce **Experience Cloud**. The portal uses LWC-based "widgets" — modular components surfaced on a community page — whose visibility and content are driven by the logged-in alumni's data profile.

Key architectural patterns:
- **Widget-based layout**: Each portal section is an independent LWC component
- **Personalization data**: EDA contact/affiliation records, giving history, event registrations, preferences
- **SSO**: Portal uses federated ID on the Community User record (personal email)
- **CASE Metrics**: Engagement scoring across 4 pillars (Philanthropic, Volunteer, Experiential, Communications)

See `WIDGET-CATALOG.md` for full widget inventory and requirements.
See `DATA-MODEL.md` for object/field reference.

---

## Access Model (BackstopJS / Browser Testing)

Portal pages require authenticated Experience Cloud login (Community User session).

**Primary auth path:** Standard Experience Cloud login (username + password). Most alumni will use this — SSO/FederatedIdentifier is a secondary option and should not be assumed as the default flow.

For visual regression testing with BackstopJS, an `onBefore.js` login script is required.
Login URL pattern: `https://<experience-cloud-domain>/alumni/s/login`

**Current dev scratch org domain:** `deploy-pistachio-9172-dev-ed.scratch.my.site.com`
- Site base: `https://deploy-pistachio-9172-dev-ed.scratch.my.site.com/alumni`
- Login: `https://deploy-pistachio-9172-dev-ed.scratch.my.site.com/alumni/s/login`
- Events page: `https://deploy-pistachio-9172-dev-ed.scratch.my.site.com/alumni/events`

> **Note:** This domain is tied to the current scratch org and will change when the org is recreated. Update this value after each `cci flow run dev_org`.

---

## Test Data Notes

- EDA-Staging may have real-ish seed data from previous migration efforts
- Scratch org (`dev`) starts empty — `cci flow run dev_org` runs seed data tasks defined in `datasets/mapping.yml`
- For widget testing, need a Contact with: giving history, event registrations, a major/college affiliation, and a geo location (Mailing Address)
- Restricted picklist values (e.g. `Preferred_Communication_Channel__c`) must be queried from schema in tests — never hardcoded

---

## Experience Cloud Guest User Access

The portal has a **Guest User** for unauthenticated/public-facing pages. Access to Apex controllers for guest users is granted via **Permission Sets** (not profiles) — this is Salesforce best practice.

| Permission Set | Assigned To | Purpose |
|----------------|-------------|---------|
| `Alumni_Portal_Guest` | Guest User | Grants access to `NavMenuController` (and any other Apex needed by guest pages) |

> **Widget zone permissions:** `PortalWidgetController` and `UST_Portal_Widget__c` (Read on all fields) must be added to `Alumni_Portal_Guest` (for guest-accessible pages) and to the logged-in community user profile or a permission set. Without this, `ustWidgetZone` silently returns an empty widget list.

> **Best Practice:** Always use permission sets (not profiles) to grant Apex class access to guest users. This keeps the Guest profile minimal and makes grants auditable and reversible.

> **⚠️ Republish required:** After assigning or changing a permission set on the guest user, you **must republish the site** from Experience Builder. `@AuraEnabled(cacheable=true)` responses for guest pages are cached at the CDN/platform level. Without republishing, the stale cached response (error or empty) continues to be served.

When adding new Apex controllers that must be callable by unauthenticated/guest users:
1. Add the class to the `Alumni_Portal_Guest` permission set
2. Verify the permission set is assigned to the site's Guest User
3. **Republish the site** from Experience Builder to clear the cached response

---

## Experience Cloud Bundle — Retrieval & Source Control

The site's page structure, routes, layout, theme, and CSS are captured as an **Experience Bundle** (metadata type `ExperienceBundle`) and stored in:

```
unpackaged/config/experiences/digitalExperiences/site/Alumni1/
```

This directory is used as a **template snapshot** — it is deployed to new orgs by the `create_community_experience_cloud_bundle` CumulusCI task. It intentionally contains only site structure, not editorial CMS content.

### What the bundle contains

| Folder | Contents |
|--------|----------|
| `sfdc_cms__route/*` | URL route definitions (which page serves each URL) |
| `sfdc_cms__view/*` | Page layouts — which LWC components are placed where, with property bindings |
| `sfdc_cms__themeLayout/*` | Header/footer/theme layout assignments |
| `sfdc_cms__theme/*` | Theme settings (Build Your Own LWR) |
| `sfdc_cms__brandingSet/*` | Branding tokens (colors, fonts) |
| `sfdc_cms__styles/*` | Custom CSS (`styles.css`, `print.css`) |
| `sfdc_cms__appPage/*` | Main App Page definition |
| `sfdc_cms__site/*` | Site-level settings (name, auth config, etc.) |

### What it does NOT contain

Salesforce CMS editorial content (news articles, images, managed content items) is **not** part of any retrievable metadata type and lives only in the org. Seed data for custom SObjects (e.g. events, giving history) is managed separately via CumulusCI datasets.

### Retrieval command (run periodically as you build out the site)

```powershell
# 1. Discover the bundle's full name in the org (first time or after scratch org rebuild)
sf org list metadata --metadata-type DigitalExperienceBundle --target-org UST-Alumni-Digital-Experience-Site__dev
# Expected output: Full Name = site/Alumni1

# 2. Retrieve the bundle — store as-is, NO restructuring needed
sf project retrieve start `
  --metadata "DigitalExperienceBundle:site/Alumni1" `
  --output-dir unpackaged/config/experiences `
  --target-org UST-Alumni-Digital-Experience-Site__dev
```

**That's it. Keep the retrieved files exactly as-is.** CumulusCI's Deploy task has `source_format: sfdx` which handles the SFDX format natively.

**Structure after retrieval (SFDX source format — do not modify):**
```
unpackaged/config/experiences/
  package.xml                                          ← committed, never delete or modify
  digitalExperiences/
    site/
      Alumni1/
        Alumni1.digitalExperience-meta.xml             ← bundle descriptor
        sfdc_cms__route/Error/content.json             ← SFDX: workspace/site/contentType/definition
        sfdc_cms__route/Home/content.json
        sfdc_cms__view/home/content.json
        sfdc_cms__themeLayout/Alumni_Theme/content.json
        sfdc_cms__site/Alumni1/content.json
        … (all content types under site/Alumni1/)
```

**`package.xml` (committed, static — do not change):**
```xml
<types>
    <members>site/Alumni1</members>
    <name>DigitalExperienceBundle</name>  <!-- MDAPI type name — NOT ExperienceBundle -->
</types>
<types>
    <members>*</members>
    <name>DigitalExperience</name>        <!-- wildcard covers all routes/views/themes/etc. -->
</types>
```

> **⚠️ `source_format: sfdx` on the Deploy task is required.** The task in `cumulusci.yml` must include `source_format: sfdx`. Without it, CumulusCI treats `unpackaged/` as MDAPI and mangles the `site/Alumni1/` path structure at deploy time.
>
> **⚠️ Do NOT restructure the retrieved files.** Previous attempts to flatten `site/Alumni1/` into other shapes all failed. The SFDX structure is correct as retrieved.

> **Error → cause reference (for debugging):**
> | Error | Cause |
> |-------|-------|
> | `All file paths must use a three level structure` | Missing `source_format: sfdx` — CumulusCI treating as MDAPI |
> | `workspace type Alumni1 is invalid` | Removed `site/` folder; `Alumni1` used as workspace type |
> | `workspace name sfdc_cms__appPage is invalid` | Removed `Alumni1/` folder; content type used as site name |
> | `ExperienceBundle … not found in zipped directory` | Wrong type in package.xml — must be `DigitalExperienceBundle` |
> | `DigitalExperience … Not in package.xml` | Missing `DigitalExperience` wildcard in package.xml |

### Deployment command (apply bundle to a new/existing org)

```powershell
cci task run create_community_experience_cloud_bundle --org dev
```

### Workflow — keeping the bundle in sync

1. Make layout/theme/component changes in **Experience Builder** in the dev scratch org
2. Publish the site (so changes are committed in the org)
3. Run the retrieval command above to pull the updated bundle into `unpackaged/config/experiences/`
4. Commit the changes to git — the bundle is now the new template baseline
5. On the next `cci flow run dev_org` (fresh scratch org), run `create_community_experience_cloud_bundle` to replay the template

### Bundle name gotcha

Salesforce names the bundle `Alumni1` (not `Alumni`) because it appends a counter to avoid collisions at creation time. The SF CLI full name is `site/Alumni1`. This is expected — don't rename the folder.

### Companion metadata NOT inside the bundle

The bundle only covers page/route/theme content. Three related pieces live in separate metadata types and are **not** retrieved or deployed by the bundle commands above:

| What | Where in repo | Metadata type | Deploy task |
|------|---------------|---------------|-------------|
| Default navigation menu | `unpackaged/config/navigationMenus/` | `NavigationMenu` | `create_community_navigation` |
| Network config (member groups, url prefix, etc.) | `unpackaged/config/networks/` | `Network` | *(none — backup snapshot only; `create_community_network` task manages member groups directly via API, doesn't deploy this file)* |
| Site-level digital experience config | `unpackaged/config/digitalExperienceConfigs/` | `DigitalExperienceConfig` | *(none currently — not wired into any flow)* |

If a fresh scratch org build is missing navigation or other config that "should" be there, check whether the relevant task is actually a step in `config_dev` — retrieving metadata into the repo does **not** mean it's deployed.

### Default Navigation menu binding is non-deterministic across orgs

Salesforce auto-generates the `DeveloperName` of a site's Default Navigation `NavigationLinkSet` (`Default_Navigation`, `Default_Navigation1`, `Default_Navigation2`, ...) based on creation order **across the whole org**, not per-network. The theme layout's nav bar component (`community_navigation:customizableNavigationBarContainer`) binds to this menu by that exact `DeveloperName` string in its `navigationMenuEditor` attribute (in `sfdc_cms__themeLayout/scopedHeaderAndFooter/content.json`).

This means:
- A value that works in one org (e.g. staging's `Default_Navigation3`) is almost never correct in another org, since it depends on how many other "Default Navigation"-labeled menus were created first (e.g. the EASY snapshot's other bundled communities).
- Salesforce **will not let you rename** a site's Default Navigation menu to make the label unique — deploying a `NavigationMenu` with a different `<label>` for an already-existing default menu fails with `You can't rename a site's Default Navigation menu`.
- Symptom in Experience Builder / live preview: `Couldn't load the selected navigation menu. On the Navigation Menu component, select a valid value from the Default Menu dropdown.`

**Fix:** `tasks/sync_navigation_menu.py` (`SyncNavigationMenuBinding` task, registered as `sync_navigation_menu` in `cumulusci.yml`) queries `NavigationLinkSet` for the Alumni network's actual `DeveloperName` at build time and rewrites the binding in `content.json` before the bundle deploys. It runs as flow step `4.5` in `config_dev` — after `create_community_network` (so the network + its auto-created default menu exist) and before `create_community_experience_cloud_bundle` (which deploys the file). The committed `content.json` holds a neutral placeholder (`Default_Navigation`); don't treat that value as meaningful — it's always overwritten at build time.

### Chasing dependencies when retrieving pages from a source org (e.g. EDA-Staging)

Pages/views retrieved from a real org often reference LWCs, Apex controllers, custom objects, static resources, and settings that aren't yet in `force-app`. Workflow used successfully:

1. Retrieve the bundle, then grep all `content.json` files under the bundle for `"c:ComponentName"` references and diff against `force-app/main/default/lwc/` folder names to find missing LWCs in one pass (faster than iterating deploy failures one at a time).
2. For each missing LWC, check its `.js` for `@salesforce/apex/...` imports (Apex controllers) and `@salesforce/resourceUrl/...` imports (static resources) — retrieve those too.
3. For Apex controllers, read the class for SOQL/schema references to custom objects/fields not yet in `force-app`, and for managed-package objects (e.g. `summit__...`), check `sf package installed list --target-org <scratch-org>` **before** assuming you need to add a new dependency to `cumulusci.yml` — this project's `dev` scratch org is built from the "EASY" org snapshot, which already bakes in EDA and Summit Events App. A missing-package compile error is usually a missing-source problem, not a missing-dependency problem.
4. Not everything is worth chasing. Two dead ends hit in practice:
   - A `summit__Summit_Events__c` query filtered on `RecordTypeId`, but that Record Type doesn't exist for that object in the scratch org's package install (only in the source org) — an environment/config gap, not a metadata gap. The widget was dropped rather than trying to recreate org-specific package configuration.
   - An object's internal admin "View" action override pointed at a FlexiPage that itself depended on an AWS S3 integration LWC/Apex controller — unrelated to the actual community-facing widget. Stripped the `actionOverrides` entries instead of retrieving the unrelated dependency chain.
5. **RecordType picklist restrictions don't travel between orgs with different State/Country picklist configurations or different picklist value sets.** If a `RecordType`'s restricted picklist values reference country/state values or global value sets not activated/present in the target org, deploy fails per-value (`Picklist value: X in picklist: Y not found`). Retrieving `Settings:Address` to replicate the source org's picklist activation may itself fail (`Invalid iso code AS for country American Samoa` — some territory codes can't be activated via metadata deploy in certain orgs). The pragmatic fix used here: strip the restricted `<picklistValues>` block for the problem field(s) from the `RecordType` file entirely (removes the restriction, doesn't affect the field itself or any SOQL) rather than trying to make picklist activation state match exactly.

---

## Code Coverage Requirement

Minimum org-wide coverage: **75%** (set in `cumulusci.yml` → `tasks.run_tests`)


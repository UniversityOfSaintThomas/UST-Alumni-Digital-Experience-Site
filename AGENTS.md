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

> **Critical:** Dynamic `import()` and `lwc:is` are NOT supported at the current API version — they throw LWC1503. Always use the static `lwc:if/lwc:elseif` chain. See `docs/MAIN_GUIDE.md#adding-a-new-widget-to-the-registry`.

---

## Key Files

| Path | Role |
|------|------|
| `force-app/main/default/lwc/ustWidgetZone/` | Widget zone host — placed on Experience Builder pages |
| `force-app/main/default/lwc/ustAlumniTheme/` | Theme layout shell (header + main slot + footer) |
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

# Re-sync Experience Bundle after Experience Builder changes
sf project retrieve start --metadata "DigitalExperienceBundle:site/Alumni1" --output-dir unpackaged/config/experiences --target-org UST-Alumni-Digital-Experience-Site__dev
```

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
- **Guest user Apex access** goes in `Alumni_Portal_Guest` permission set (not in Guest profile). After changing any permission set on the guest user, **republish the site** from Experience Builder — CDN caches stale responses
- **Experience Bundle:** Must keep `source_format: sfdx` in the `create_community_experience_cloud_bundle` CCI task and never flatten the `site/Alumni1/` folder structure. See `docs/AI-TOOLS-CONFIG.md#experience-cloud-bundle` for the full error-cause reference table
- **NavigationMenu, Network, and DigitalExperienceConfig are separate from the Experience Bundle** and live in their own `unpackaged/config/` folders. Only `NavigationMenu` has a deploy task (`create_community_navigation`) wired into `config_dev`; the other two are backup snapshots only, not deployed anywhere yet
- **Default Navigation menu binding breaks on every fresh org** if not handled — Salesforce assigns its `NavigationLinkSet.DeveloperName` non-deterministically per org (`Default_Navigation`, `_1`, `_2`, ...) and won't allow renaming it for uniqueness. `tasks/sync_navigation_menu.py` (flow step `config_dev` 4.5) queries the real value and rewrites the theme layout's binding before every bundle deploy — don't hardcode a specific `Default_NavigationN` value in `content.json`. Symptom if this ever regresses: Experience Builder error *"Couldn't load the selected navigation menu."* See `docs/AI-TOOLS-CONFIG.md#experience-cloud-bundle` for the full writeup
- **When retrieving pages from a source org (e.g. EDA-Staging) that reference LWCs/Apex/objects not yet in `force-app`:** grep the bundle's `content.json` files for `"c:ComponentName"` refs and diff against `force-app/main/default/lwc/` to find all missing components in one pass, then trace each one's Apex/static-resource/object dependencies before redeploying. Check `sf package installed list` on the target org before adding a new managed-package dependency to `cumulusci.yml` — the `dev` scratch org's EASY snapshot already bakes in EDA and Summit Events App. Not every dependency is worth chasing: drop widgets blocked by real environment gaps (e.g. a managed package's Record Type only configured in the source org) rather than trying to replicate org-specific setup. See `docs/AI-TOOLS-CONFIG.md#experience-cloud-bundle` for the full methodology and dead ends already hit
- **Picklist values** (e.g. `Preferred_Communication_Channel__c`) must be queried from org schema in tests — never hardcoded
- **Branding:** Apply UST colors via CSS custom properties; see `docs/BRAND-COLORS.md` for HEX/RGB/PMS values. Base is SLDS with 8px spacing unit

---

## Data Model Quick Reference

- **Contact** — central record for every alumnus; most widgets read/write here
- **`hed__Affiliation__c`** — college/school association
- **`hed__Program_Enrollment__c`** — major/minor
- **Campaign / CampaignMember** — events and registrations
- **`UST_Portal_Widget__c`** — widget zone control records
- Several Contact flag fields (Donor, Faculty/Staff, Parent, Engagement Score) are **TBD** — see `docs/DATA-MODEL.md` for action items


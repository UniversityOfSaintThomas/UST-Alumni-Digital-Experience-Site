# UST Alumni Digital Experience Site — Main Guide

## Purpose

Rebuild the University of St. Thomas alumni portal on **Salesforce Experience Cloud**, replacing the legacy alumni directory with a personalized, widget-driven experience. Logged-in alumni see content tailored to their profile data — giving history, event registrations, major/college, geographic location, and self-declared preferences.

---

## Architecture

### Platform
- **Salesforce Experience Cloud** — **LWR (Lightning Web Runtime) site**, NOT Aura ([LWR Sites for Experience Cloud docs](https://developer.salesforce.com/docs/atlas.en-us.exp_cloud_lwr.meta/exp_cloud_lwr/intro.htm))
  - LWR provides better performance, modern routing, and first-class LWC support compared to Aura-based sites
  - Uses the `enhanced_lwr` template in `sfdx-project.json`; do **not** use `aura` or `aloha` templates
- **LWC widgets** as the primary UI building block (LWR sites require LWC — Aura components are not supported)
- **EDA (Higher Education Data Architecture)** managed package provides the academic data model (affiliations, programs, etc.)
- **SSO**: Federated ID on Community User record maps to alumni personal email

### Widget-First Design
Every section of the portal is a self-contained LWC "widget" component. The portal uses a **record-driven widget zone system** to control which widgets appear, on which pages, in what order, and for which audience segments — admins manage this through `UST_Portal_Widget__c` records, without touching Experience Builder or code.

See `WIDGET-CATALOG.md` for the full widget inventory and component registry.  
See [Widget Zone System](#widget-zone-system) below for implementation and configuration details.

### Widget Zone System

Replaces the legacy EASY Widgets pattern with an admin-facing Salesforce object. Admins create and edit `UST_Portal_Widget__c` records to control the portal without any deployment.

**Flow:**

```
Admin creates/edits UST_Portal_Widget__c record
  Zone = body | Page = home | Component = ust_profile_card | Sort = 10 | Audience = All
         |
Experience Builder page loads ustWidgetZone (zoneName="body", pageContext="home")
         |
PortalWidgetController.getWidgetsForZone() queries active matching records
  - filters by zone, page context, and current user's audience segments
  - returns ordered list of widget DTOs
         |
ustWidgetZone renders each widget in sort order
  - registered component  →  renders the real widget LWC
  - unregistered component →  renders ustPortalWidgetStub
       (stub is visible in Experience Builder, invisible in the live site)
```

**Files involved:**

| File | Role |
|------|------|
| `objects/UST_Portal_Widget__c/` | Object + 7 field definitions |
| `classes/PortalWidgetController.cls` | Apex — queries widgets, checks audience segments |
| `lwc/ustWidgetZone/` | Host container — drag onto pages in Experience Builder |
| `lwc/ustPortalWidgetStub/` | Dev placeholder — Builder-visible, live-site-invisible |

---

#### Experience Builder Setup

Place one **UST Widget Zone** component per zone on each page:

1. Open Experience Builder → from the component panel, drag **UST Widget Zone** onto the page
2. In the component property panel, set:
   - **Zone Name** — one of: `body`, `sidebar`, `banner`, `above_footer`
   - **Page Context** — the page slug, e.g. `home`, `events`, `giving`, `profile`
3. Repeat for each zone on that page
4. Publish the site after placing zones

> The same `UST Widget Zone` component is placed on every page. Different `Zone Name` + `Page Context` values on each instance mean each zone only loads the records targeting it.

---

#### Configuring Widget Records

Create `UST_Portal_Widget__c` records via **Setup → Object Manager → UST Portal Widget → Records**, or create a List View for easy admin access.

| Field | Purpose | Example |
|-------|---------|---------|
| Widget Name | Admin label — be descriptive | `Profile Card - Home Page` |
| Zone | Which zone instance renders this widget | `body` |
| Page Context | Pages where this widget appears *(multi-select)* | `home; profile` |
| Component Name | Registry key — selects the LWC to render | `ust_profile_card` |
| Sort Order | Position within the zone; lower numbers appear first | `10`, `20`, `30` |
| Audience Rule | Which alumni segment sees this widget | `All` |
| Is Active | Kill switch — uncheck to hide without deleting | ✓ |
| Description | Admin notes; not shown to alumni | *(optional)* |

A widget that should appear on multiple pages uses one record — select multiple values in **Page Context** rather than duplicating the record.

---

#### Audience Rules

| Rule | Current State | Notes |
|------|--------------|-------|
| `All` | ✅ **Active** | Shown to every authenticated user |
| `Donor` | ⏳ **Stubbed** | Awaiting Contact donor flag field confirmation (see DATA-MODEL.md) |
| `Parent` | ⏳ **Stubbed** | Awaiting Contact parent flag field confirmation |
| `Faculty_Staff` | ⏳ **Stubbed** | Awaiting Contact faculty/staff flag confirmation |

To activate a stubbed rule: confirm the Contact field API name with the advancement team, then un-comment the corresponding block in `PortalWidgetController.resolveUserAudiences()`.

A user who qualifies for multiple segments sees widgets for all of them. Create separate records for widgets that target one segment but not all alumni (e.g. a Donor-only tile alongside an All-alumni tile in the same zone).

---

#### Adding a New Widget to the Registry

When a new widget LWC is built and deployed, activate it in the zone system with three changes:

**1 — Uncomment the boolean flag in `ustWidgetZone.js` → `buildWidgetRegistry()`:**
```javascript
isProfileCard: item.componentName === 'ust_profile_card',
```

**2 — Add a `lwc:if` (or `lwc:elseif`) block in `ustWidgetZone.html`, above the `lwc:else` stub:**
```html
<!-- First registered widget: use lwc:if -->
<template lwc:if={widget.isProfileCard}>
    <c-ust-profile-card></c-ust-profile-card>
</template>
<!-- Additional widgets: use lwc:elseif -->
<template lwc:elseif={widget.isEventsWidget}>
    <c-ust-events-widget></c-ust-events-widget>
</template>
<!-- Keep this stub block as the final lwc:else — catches any unregistered component names -->
<template lwc:else>
    <c-ust-portal-widget-stub ...></c-ust-portal-widget-stub>
</template>
```

**3 — Deploy both the zone and the new widget together:**
```powershell
cci task run deploy --path force-app/main/default/lwc/ustWidgetZone --org dev
cci task run deploy --path force-app/main/default/lwc/ustProfileCard --org dev
```

No Experience Builder changes are needed. The zone component already on the page calls the same Apex query and automatically renders the real widget the next time the page loads.

> **Stub behavior:** Until Step 1–2 are deployed, a widget record with `Component_Name__c = ust_profile_card` renders the stub placeholder (visible in Builder, invisible to alumni in the live site). This lets admins configure records ahead of the LWC being built.

---

### Personalization Dimensions
The following data points drive what is shown per alumni:

| Dimension | Source |
|-----------|--------|
| College / School | EDA Affiliation (`hed__Affiliation__c`) |
| Major / Minor | EDA Program Enrollment |
| Donor status | Giving history / NPSP Opportunity |
| Faculty/staff connection | Contact type or custom flag |
| Parent connection | Custom flag or relationship record |
| Geographic location | Contact Mailing Address |
| Event preferences | Custom preference record |
| Communication preferences | Custom preference record |
| Engagement score (CASE) | Computed from Philanthropic, Volunteer, Experiential, Communications activity |

---

## Development Workflow

### Initial Org Setup
```powershell
# Create a fresh dev scratch org (7-day lifespan)
cci flow run dev_org --org dev
```

### Incremental Deploys
```powershell
# Deploy all LWC components
cci task run deploy --path force-app/main/default/lwc --org dev

# Deploy a single component
cci task run deploy --path force-app/main/default/lwc/myComponent --org dev

# Deploy Apex classes
cci task run deploy --path force-app/main/default/classes --org dev
```

### Testing
```powershell
# LWC Jest tests
npm test

# LWC Jest with coverage
npm test -- --coverage

    # Apex tests (single class) — dev scratch org has EDA via EASY snapshot
    sf apex run test --class-names ClassName_TEST --target-org UST-Alumni-Digital-Experience-Site__dev --result-format human --code-coverage --wait 20

# All Apex tests
cci task run run_tests --org dev
```

### Code Analysis
```powershell
sf code-analyzer run --target force-app/main/default --output-file ai-logs/code-analyzer.json --output-file ai-logs/code-analyzer.html --severity-threshold 3 2>&1 | Out-File ai-logs/ca-run.txt
```

---

## Project Structure

```
force-app/main/default/
  lwc/                  # Lightning Web Components (portal widgets + support components)
    ustAlumniTheme/     # Theme layout shell (header + main slot + footer)
    ustAlumniHeader/    # Site header and navigation
    ustAlumniFooter/    # Site footer
    ustWidgetZone/      # Widget zone host — drag onto Experience Builder pages
    ustPortalWidgetStub/# Dev placeholder for unbuilt widgets (Builder-only visible)
  classes/              # Apex controllers
    NavMenuController   # Experience Cloud navigation menu fetcher
    PortalWidgetController # Widget zone registry query + audience filtering
  objects/              # Custom object and field metadata
    UST_Portal_Widget__c/  # Widget zone control object (zone, page, component, audience)
  permissionsets/       # Permission sets for community users and admins
  experiences/          # Experience Cloud site metadata
  staticresources/      # Images, fonts, global CSS

docs/
  MAIN_GUIDE.md         # This file — project overview and workflow
  BRAND-COLORS.md       # Official UST color palette with HEX/RGB/PMS values
  WIDGET-CATALOG.md     # Portal widget inventory, requirements, and status
  ROADMAP.md            # Phase 1 / Phase 2 breakdown, open questions from 2026 stakeholder requests
  DATA-MODEL.md         # Custom objects, key fields, and EDA object map
  AI-TOOLS-CONFIG.md    # Org aliases and AI tool configuration
  SVG-ASSETS.md         # SVG logo and icon inventory (docs/svgs/)
  user-discover.md      # Raw discovery session notes (Jan & Mar 2026)
```

---

## Key Dependencies

| Dependency | Version | Notes |
|-----------|---------|-------|
| CumulusCI | ≥ 4.8.0 | Project build tool |
| Salesforce API | 63.0 / 65.0 | CCI / SFDX respectively |
| EDA (HEDA) | Managed pkg | Academic data model; available on dev scratch org (EASY snapshot) and EDA-Staging |
| Node.js | Current LTS | LWC Jest testing |
| `@salesforce/sfdx-lwc-jest` | ^7.0.2 | Jest runner for LWC |

---

## Design System

- **SLDS** (Salesforce Lightning Design System) as the base
- **UST Brand Colors** applied via CSS custom properties — see `BRAND-COLORS.md`
- **Typography**: UST standard fonts (TBD — check Brand Hub typography page)
- **Spacing**: Follow SLDS spacing scale; 8px base unit
- **Icons**: SLDS utility icons + UST-specific assets in static resources

---

## CASE Engagement Model

Portal surfaces alumni engagement across 4 pillars:

| Pillar | Examples |
|--------|---------|
| **Philanthropic** | Gifts, pledges, Tommie Give Day participation |
| **Volunteer** | Event volunteering, mentorship sign-ups |
| **Experiential** | Event attendance, workshops, webinars |
| **Communications** | Email opens, social media interactions, portal visits |

A score model (existing framework) aggregates these into a year-end engagement summary shown in the portal.

---

## SSO & Authentication Notes

- **Primary login path**: Standard **Experience Cloud login** (username + password) — this is how the vast majority of alumni will authenticate
- SSO / Federated ID is a secondary option (available if the alumni has a linked institutional account) but is **not** the default or expected first-time flow
- Community User `FederatedIdentifier` is still populated for alumni with institutional email links, but the portal UX should not assume or require SSO
- Experience Cloud domain: TBD (set during Experience Builder setup)
- Login page URL pattern: `https://<experience-cloud-domain>/alumni/s/login`

---

## Related Resources

- [UST Brand Hub](https://one.stthomas.edu/sites/brand-hub/SitePageModern/255330/brand-home)
- [UST Brand Colors](https://one.stthomas.edu/sites/brand-hub/SitePageModern/248163/brand-colors)
- [CumulusCI Docs](https://cumulusci.readthedocs.io/)
- [LWR Sites for Experience Cloud Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.exp_cloud_lwr.meta/exp_cloud_lwr/intro.htm)
- [EDA Documentation](https://powerofus.force.com/s/article/EDA-Documentation)


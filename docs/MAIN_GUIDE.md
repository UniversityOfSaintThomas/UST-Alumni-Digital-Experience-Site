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
Every section of the portal is a self-contained LWC "widget" component. Widgets are:
- Added to Experience Builder pages via drag-and-drop
- Personalized using the logged-in user's Contact record and related data
- Conditionally shown/hidden based on the alumni's profile (donor, faculty/staff, parent, college, etc.)

See `WIDGET-CATALOG.md` for the full widget inventory.

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
  classes/              # Apex controllers
  objects/              # Custom object/field metadata
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


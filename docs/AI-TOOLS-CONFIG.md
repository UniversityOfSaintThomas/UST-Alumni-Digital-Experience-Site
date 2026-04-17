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

> **Best Practice:** Always use permission sets (not profiles) to grant Apex class access to guest users. This keeps the Guest profile minimal and makes grants auditable and reversible.

> **⚠️ Republish required:** After assigning or changing a permission set on the guest user, you **must republish the site** from Experience Builder. `@AuraEnabled(cacheable=true)` responses for guest pages are cached at the CDN/platform level. Without republishing, the stale cached response (error or empty) continues to be served.

When adding new Apex controllers that must be callable by unauthenticated/guest users:
1. Add the class to the `Alumni_Portal_Guest` permission set
2. Verify the permission set is assigned to the site's Guest User
3. **Republish the site** from Experience Builder to clear the cached response

---

## Code Coverage Requirement

Minimum org-wide coverage: **75%** (set in `cumulusci.yml` → `tasks.run_tests`)


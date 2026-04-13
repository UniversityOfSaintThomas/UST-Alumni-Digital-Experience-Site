# UST Alumni Digital Experience Site

Personalized alumni portal built on **Salesforce Experience Cloud** using LWC widget components. Powered by EDA (Higher Education Data Architecture) and personalized by each alumnus's giving history, event registrations, major/college, and declared preferences.

## Documentation

| Doc | Purpose |
|-----|---------|
| [MAIN_GUIDE.md](docs/MAIN_GUIDE.md) | Project overview, architecture, development workflow |
| [WIDGET-CATALOG.md](docs/WIDGET-CATALOG.md) | Portal widget inventory, requirements, and status |
| [DATA-MODEL.md](docs/DATA-MODEL.md) | Custom objects, key fields, EDA object map |
| [BRAND-COLORS.md](docs/BRAND-COLORS.md) | Official UST color palette (HEX/RGB/PMS) |
| [AI-TOOLS-CONFIG.md](docs/AI-TOOLS-CONFIG.md) | Org aliases, CI/CD config, AI tool context |
| [user-discover.md](docs/user-discover.md) | Raw discovery session notes (Jan & Mar 2026) |

## Quick Start

```powershell
# Create a fresh dev scratch org
cci flow run dev_org --org dev

# Deploy LWC components
cci task run deploy --path force-app/main/default/lwc --org dev

# Run LWC Jest tests
npm test

# Run Apex tests
cci task run run_tests --org dev
```

## Tech Stack

- Salesforce Experience Cloud (LWR)
- Lightning Web Components (LWC)
- EDA - Higher Education Data Architecture (`hed__` namespace)
- CumulusCI (build/deploy tooling)
- Salesforce API v63.0 / v65.0

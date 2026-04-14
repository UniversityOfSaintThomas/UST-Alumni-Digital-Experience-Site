# UST Alumni Portal — Stakeholder Hub

Welcome to the planning and design documentation for the **University of St. Thomas Alumni Digital Experience Portal** — a personalized, widget-driven alumni portal built on Salesforce Experience Cloud.

This site is the living reference for stakeholders, product owners, and contributors. It covers what we're building, why, and what decisions still need to be made.

---

## What We're Building

The portal replaces the legacy alumni directory with a **personalized, self-service experience** that surfaces content relevant to each alumnus — their events, giving history, career connections, and campus updates — based on their unique profile in Salesforce.

Key principles:

- **Widget-driven** — every section is a drag-and-drop component that site builders control in Experience Builder, no code changes needed for layout or navigation
- **Personalized** — content adapts to the logged-in alumnus's college, giving history, event participation, location, and stated preferences
- **Salesforce-native** — built on Experience Cloud LWR, using Lightning Web Components and the Higher Education Data Architecture (EDA)

---

## Quick Links

| Document | What's in it |
|----------|-------------|
| [Project Guide](MAIN_GUIDE.md) | Architecture, development workflow, deployment process |
| [2026 Roadmap](ROADMAP.md) | Stakeholder requests, phased targets, and open questions |
| [Widget Catalog](WIDGET-CATALOG.md) | Every planned portal section — purpose, data, and status |
| [Data Model](DATA-MODEL.md) | Salesforce objects, fields, and relationships driving personalization |
| [Brand Guide](BRAND-COLORS.md) | Color palette, typography, and design tokens |
| [User Discovery](user-discover.md) | Findings from stakeholder and alumni discovery sessions |

---

## Current Status — April 2026

| Area | Status |
|------|--------|
| Salesforce scratch org | ✅ Active (`EASY` snapshot with Experience Cloud) |
| Theme layout (header / footer) | ✅ Deployed — navigation managed in Experience Builder |
| Navigation | ✅ ConnectApi-driven; site builders control menus without code |
| Phase 1 widgets | 🔨 In scoping |
| Phase 2 (Volunteer, Preferences, etc.) | ❓ Pending answers to [open questions](ROADMAP.md#open-questions-must-resolve-before-development) |

---

## How to Give Feedback

The best way to raise a question or flag a change is to open an issue on the [GitHub repository](https://github.com/UniversityOfSaintThomas/UST-Alumni-Digital-Experience-Site) or reach out to the development team directly.

Open questions that are blocking Phase 2 scoping are tracked in the [Roadmap — Open Questions section](ROADMAP.md#open-questions-must-resolve-before-development).




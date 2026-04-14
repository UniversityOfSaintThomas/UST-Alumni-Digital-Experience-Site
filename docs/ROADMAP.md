# Roadmap — UST Alumni Portal 2026

Derived from the `2026_Portal Requests.csv` stakeholder input, cross-referenced against
`WIDGET-CATALOG.md` and prior discovery sessions (Jan & Mar 2026).

> **How to read this doc:**
> - **Phase 1** = stakeholder-prioritized; target for initial launch
> - **Phase 2+** = approved in concept but needs more definition or is a follow-on build
> - **Needs Discussion** = flagged in requests but has unresolved process/data questions before scoping
> - ❓ = open question that must be answered before development can start

---

## Phase 1 — Initial Launch Targets

### Events

| Request | Widget | Notes |
|---------|--------|-------|
| Upcoming Alumni Events list | Widget 2 — Events | Filter by preferences (virtual, type, etc.) |
| Upcoming Non-Alumni Events list | Widget 2 — Events | ❓ Where does this data come from? (see Open Questions) |
| Event Registrations — Upcoming | Widget 2 — Events | Show events the alumnus is already signed up for |

### Alumni Profile

| Request | Widget | Notes |
|---------|--------|-------|
| Upload profile photo | Widget 1 — Profile Card | Migrate current functionality |
| Update Contact Information | Widget 1 — Profile Card | Migrate current functionality |
| Update Business Info | Widget 1 — Profile Card | ❓ What fields constitute "Business Info"? (see Open Questions) |
| Alumni Directory — Search other alums | Widget 7 — Directory & Connect | Migrate current functionality |
| Alumni-to-Alumni connect / messaging | Widget 7 — Directory & Connect | ❓ Native portal or route to St. Thomas Connect? (see Open Questions) |

### Links & Quick Access

All of the following are Phase 1 link-outs (see Widget 8 — Links Hub for full detail):

| Link Target | Notes |
|------------|-------|
| St. Thomas Connect (PeopleGrove) | Primary alumni-to-alumni network |
| Handshake | Job listings / career services |
| Athletics site | General athletics link |
| Athletics Ticketing (Paciolan?) | ❓ Is Phase 1 just a link or can we show past ticket purchases? |
| Donations / Give | Seasonal storytelling around Tommie Give Day |
| Law Directory | School-specific link |
| Business Directory | School-specific link |
| Job Listings via Handshake or St. Thomas Connect | Career resource |
| Request a Transcript | Registrar link |
| Refer a Student | Engagement / admissions |
| Bookstore online | With customizable options if possible |
| CampusESP | Parent-of-current-student link (shown conditionally) |

### Alumni Updates & Content

| Request | Widget | Notes |
|---------|--------|-------|
| Videos / Photos section | Widget 12 — Videos & Media | Photos from events attended; event photos |
| Upload photo of life events | Widget 10 — Photo & Story | Does upload need approval workflow? |
| Top 10 playlist | Widget 12 — Videos & Media | Who manages this content? UA/comms team? |
| Share their story / Alumni Notes with photos | Widget 10 — Photo & Story | Migrate existing functionality |
| Alumni News section (ambassador content) | New — Alumni News (see Widget Index) | ❓ Where does this content live in Salesforce? |
| Easy access to what is new with UST | New — Alumni News | Content updated by UA without code deploy |
| Follow us on social channels | Widget 10 / Footer | Needs links per channel |

### Giving Information

| Request | Widget | Notes |
|---------|--------|-------|
| Assigned Gift Officer — with photo and contact info | Widget 3 — Give / Donor | Phase 1; GO/UA can update via the widget; ❓ what fields? |

---

## Phase 2 / Needs More Definition

### Events

| Request | Notes |
|---------|-------|
| Alumni-Created Events (with ability to invite others) | "Need to talk through the process flow (approval, etc.)" — Screen Flow in widget |

### Volunteer Management (New — not in current catalog)

| Request | Notes |
|---------|-------|
| Search & sign up for volunteer opportunities | Potential use of Volunteers4Salesforce (V4SF) package |
| Alumni create volunteer opportunities | Screen Flow; requires approval process definition |

> ❓ Is Volunteers4Salesforce already installed in the org? What volunteer tracking currently exists?

### Alumni Preferences

| Request | Notes |
|---------|-------|
| Full Preference Center — channel preferences (Email, SMS, Mail, Phone) | Requires MarComm team collaboration; SFMC subscriber sync |
| Content preferences (interest types) | ❓ "Need to compile list of Content types aligned with Filters and Sender Keys" — need SFMC sender key inventory |

### Alumni Updates

| Request | Notes |
|---------|-------|
| UST awards, giving society membership, achievements display | "Need definition of what information to show and where it is in SF" |
| Engagement year-in-review (with incentives/gamification) | "Need definition" — uses existing CASE score model |

### Giving Information

| Request | Notes |
|---------|-------|
| Full donation reports, Endowment Reports, Impact Reports | "Need definition of what information to show and where it is in SF" |
| Student thank-you messages for donors | References Jira ticket ECRMSF-5238; need process definition |
| Gift Receipts display | "Need definition of what information to show" |
| Show Pledges | "Need definition of what information to show" |

### Communications

| Request | Notes |
|---------|-------|
| Communications History (Email + SMS) | SMS via Activity History; email via IER from SFMC; ❓ Is Marketing Cloud Connect configured in EDA-Staging? |

---

## Platform / Non-Code Items

| Item | Notes |
|------|-------|
| Mobile App | "Contract Update/Licensing" — not a widget; ❓ What platform/app is this? |

---

## Open Questions — Must Resolve Before Development

These are blocking or high-impact unknowns surfaced from the CSV and prior discovery. Each should be answered by the appropriate stakeholder before the related work is scoped.

| # | Question | Category | Who to Ask |
|---|----------|----------|-----------|
| 1 | **Business Info fields** — What fields make up "Business Info" on the alumni profile? (Employer, Title, LinkedIn URL?) Are these on the Contact record or a related Account? | Alumni Profile | Data/CRM team |
| 2 | **Non-Alumni Events data source** — Where does data for non-UST Alumni events come from? Are these Campaigns with a different record type, or pulled from an external calendar/feed? | Events | Events/data team |
| 3 | **Alumni-Created Events process** — What does the approval workflow look like? Who reviews? Is it a draft → staff-approves model, or fully self-serve? | Events | Events team |
| 4 | **Alumni-to-Alumni messaging** — Should this be native to the portal (Chatter / custom messaging object), or should the portal link alumni into St. Thomas Connect (PeopleGrove) where this already exists? | Directory | Product owner |
| 5 | **Volunteer Management package** — Is Volunteers4Salesforce (V4SF) already installed in EDA-Staging, or would it need to be licensed and installed? What volunteer data exists today? | Volunteer | CRM team |
| 6 | **Mobile App platform** — The request says "Contract Update/Licensing." Is this the Salesforce Mobile app, a custom app, or a third-party? Who manages that contract? | Platform | Leadership |
| 7 | **Content Preference types & SFMC Sender Keys** — The CSV says content preferences need to align with existing SFMC Filters and Sender Keys. Can you share that list, or should we pull it from SFMC directly? | Preferences | MarComm / SFMC team |
| 8 | **Assigned Gift Officer fields** — What information should display on the GO widget? (Name, photo, phone, email, calendar booking link?) Where does the GO's data live today — on the User record, a custom object, or a Contact relationship? | Giving | Gift Officers / UA |
| 9 | **Marketing Cloud Connect** — Is Marketing Cloud Connect configured and syncing Individual Email Results (`Individual_Email_Result__c`) in EDA-Staging today? Is SMS tracked in Salesforce (Activity History or a custom object)? | Communications | SFMC / CRM team |
| 10 | **Athletics Ticketing platform** — Is the platform Paciolan? For Phase 1, is the deliverable just a link, or is there an API/data sync available to show past ticket purchases? | Athletics | Athletics / IT |
| 11 | **Alumni News content source** — For the "Alumni News / ambassador content" section, where does this content live in Salesforce? Is it CMS content, a custom object, or pulled from the UST news RSS feed? | Alumni Updates | UA / Comms team |
| 12 | **Student Thank-You messages** — What is the current state of the workflow referenced in Jira ECRMSF-5238? Is there a data model already defined, or is this net-new? | Giving | Philanthropy team |


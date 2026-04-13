# Widget Catalog — UST Alumni Portal

Each row is a potential portal widget surfaced on the Experience Cloud alumni page. Widgets are LWC components added to pages via Experience Builder and personalized by the logged-in alumni's data.

**Status key:** `Planned` | `In Design` | `In Progress` | `Done`

---

## Widget Index

| # | Widget Name | Priority | Status | Notes |
|---|------------|---------|--------|-------|
| 1 | [Profile Card](#1-profile-card) | High | Planned | |
| 2 | [Events — Upcoming & Registered](#2-events--upcoming--registered) | High | Planned | |
| 3 | [Give / Donor Widget](#3-give--donor-widget) | High | Planned | |
| 4 | [Engagement Summary (Year in Review)](#4-engagement-summary-year-in-review) | High | Planned | |
| 5 | [St. Thomas Connection Messages](#5-st-thomas-connection-messages) | High | Planned | Personalized by role |
| 6 | [Preference Center](#6-preference-center) | High | Planned | |
| 7 | [Alumni Directory & Connect](#7-alumni-directory--connect) | Medium | Planned | |
| 8 | [Links Hub](#8-links-hub) | Medium | Planned | |
| 9 | [Communications History](#9-communications-history) | Medium | Planned | |
| 10 | [Photo & Story Sharing](#10-photo--story-sharing) | Medium | Planned | |
| 11 | [Athletics](#11-athletics) | Low | Planned | |
| 12 | [Videos & Media](#12-videos--media) | Low | Planned | |

---

## 1. Profile Card

**Purpose:** Surface the alumni's own information on the portal. Give them confidence the portal "knows" them and let them keep their record current.

**Features:**
- Display name, photo, college/school, graduation year, major/minor
- Allow alumni to upload or update their own headshot
- GO (Gift Officer) / UA (University Advancement) staff can also update the widget content
- Show contact information (email, phone, city/state)

**Personalization trigger:** Always shown; content varies by Contact record

**Data sources:**
- `Contact` (Name, Photo, Email, Phone, Mailing City/State)
- `hed__Affiliation__c` → `hed__Account__r` (College/School)
- EDA Program Enrollment (Major/Minor)

**Notes:**
- Photo upload requires Files + ContentDocument support in Experience Cloud
- Consider privacy controls: alumni can choose what is visible to other alumni in the directory

---

## 2. Events — Upcoming & Registered

**Purpose:** Show events the alumni cares about — both registered events and events matching their preferences. Upcoming events are prioritized over history.

**Features:**
- List of events the alumni has already registered for (upcoming first, then past)
- Suggested events based on: geographic proximity, virtual preference, interest categories
- Option to include events NOT hosted by UST Alumni (partner/community events)
- "Willing to travel" filter to expand geo radius
- Ability to invite other alumni to an event (alumni-hosted events)

**Personalization triggers:**
- Event preference settings (virtual vs. in-person, category interests)
- Alumni Mailing Address (for geo-based suggestions)
- Past event attendance history

**Data sources:**
- `CampaignMember` (event registrations)
- `Campaign` (event details, type, location, date)
- Alumni preference record (virtual preference, interest categories)
- Contact Mailing Address

**Notes:**
- "Alumni-created events" feature is a future enhancement — requires a community-facing event creation flow
- Campus ESP integration possible for parent-specific events (see St. Thomas Connection widget)

---

## 3. Give / Donor Widget

**Purpose:** Inspire giving through personalized storytelling. Surface the alumni's giving history and provide a prominent, contextual way to give.

**Features:**
- **Give button** with seasonal impact storytelling (college/school-specific)
- Highlight **Tommie Give Day** with enhanced messaging during that period
- Show how past gifts have had real-world impact (impact stories)
- Calendar year-end giving summary
- Show gift receipts
- Link to Endowment Reports and Impact Reports
- "Giving Society" membership badge (if applicable)
- Donor: surface a personalized **thank you message**

**Personalization triggers:**
- Donor status (any gift on record)
- College/School affiliation (for impact story targeting)
- Giving society membership
- Time of year (seasonal storytelling, Tommie Give Day calendar event)

**Data sources:**
- `Opportunity` / NPSP giving records
- `ContentDocument` (impact reports, endowment reports, gift receipts as files)
- Custom Impact Story object or CMS content (seasonal stories by college)
- Giving Society custom object or field on Contact

**Notes:**
- Impact story content will likely be managed as Experience Cloud CMS content or a custom object
- Tommie Give Day date should be stored in org configuration (Custom Metadata or Custom Setting) so the widget activates automatically

---

## 4. Engagement Summary (Year in Review)

**Purpose:** Show alumni their engagement across all four CASE pillars — giving, volunteering, events, and communications — as a motivating year-in-review summary.

**Features:**
- Annual summary of engagement across CASE pillars:
  - **Philanthropic**: total giving amount, gift count
  - **Volunteer**: hours volunteered, roles filled
  - **Experiential**: events attended, workshops completed
  - **Communications**: emails opened, portal visits, social interactions
- Engagement score visualization (existing framework)
- "Next step" suggestions to increase engagement level
- Incentive/gamification element: show progress toward next tier

**Personalization triggers:** All CASE activity tied to the Contact record

**Data sources:**
- NPSP Opportunity rollups (giving totals)
- Volunteer hours object (custom or NPSP Volunteers)
- `CampaignMember` with attendance flag (events)
- Email engagement (Salesforce Marketing Cloud or individual email results)
- Existing engagement score model fields on Contact

**Notes:**
- The engagement score model should already exist in the org — query Contact for the scoring fields rather than rebuilding
- Year-end cutoff: calendar year (Jan 1–Dec 31) or fiscal year (confirm with advancement team)

---

## 5. St. Thomas Connection Messages

**Purpose:** Surface role-specific messages that acknowledge the alumni's special relationship with UST beyond just being a graduate.

**Segment → Message mapping:**

| Segment | Message Type |
|---------|-------------|
| **Donor** | Personalized thank you message (see Give widget) |
| **Faculty / Staff** | Special recognition message for those who went on to serve UST |
| **Parent** | Link to CampusESP portal for parent-specific content |
| **General** | Default St. Thomas pride / community message |

**Personalization triggers:**
- Donor flag / giving history
- Faculty/Staff flag (custom field on Contact or Relationship record)
- Parent flag (custom field or relationship to current student)

**Data sources:**
- Contact type fields (custom flags or EDA Affiliation types)
- CampusESP URL (static link, stored in Custom Setting)

**Notes:**
- These messages may be managed as CMS content so the advancement team can update copy without a code deploy
- A Contact can fall into multiple segments — priority order: Donor > Faculty/Staff > Parent > General

---

## 6. Preference Center

**Purpose:** Let alumni control what they see on the portal and how UST communicates with them. Preferences also feed the newsletter content and event recommendations.

**Features:**
- **Content preferences**: event types (virtual, in-person, career, athletics, philanthropy, etc.)
- **Channel preferences**: Email, SMS, Phone, Mail, Social
- **Geographic preference**: home city/region, willingness to travel
- **Newsletter opt-in/opt-out**
- Changes saved back to the Contact/preference record in real time

**Personalization triggers:** N/A — this widget drives the personalization of others

**Data sources:**
- Custom `Alumni_Preference__c` object (or fields on Contact)
- Existing preference fields in org (confirm with team)

**Notes:**
- Patrick noted this would be out of scope initially for a *full* real-time preference center; a simplified version (event type + channel opt-out) is the phase 1 target
- Preferences should feed Salesforce Marketing Cloud (SFMC) subscriber attributes where applicable
- This widget is key to the newsletter strategy: preferences → newsletter content → newsletter drives alumni back to portal

---

## 7. Alumni Directory & Connect

**Purpose:** Help alumni find and connect with each other. Enable one-to-one messaging and group connections.

**Features:**
- Searchable directory of other alumni (opt-in visibility)
- Filters by college/school, graduation year, major, city
- Send a direct message to another alumnus (portal message or email)
- Alumni Notes / Story sharing with photos
- Alumni-to-alumni event invitations

**Personalization triggers:**
- Alumni's own visibility preferences (opt-in to directory)
- Shared college, class year, major (for "people like you" suggestions)

**Data sources:**
- Contact records with Community User accounts
- Privacy preference flag (directory opt-in)
- `CommunityMessage__c` or Experience Cloud Chatter for messaging

**Notes:**
- **St. Thomas Connect** (PeopleGrove) already exists as a platform for alumni-to-alumni connection — the portal should link to it rather than duplicate the functionality
- Phase 1: Link to St. Thomas Connect with a deep-link into relevant groups/connections
- Phase 2: Native portal directory with filtered search
- LinkedIn city-based groups also exist (Tommie Tailgates) — surface relevant group links by geo

---

## 8. Links Hub

**Purpose:** A curated set of quick-access links to the most common alumni needs and external systems.

**Suggested Links:**

| Category | Link | Target System |
|---------|------|--------------|
| Career | Job listings / career coaching | Handshake |
| Career | Alumni professional network | St. Thomas Connect (PeopleGrove) |
| Academics | Request a transcript | Registrar system |
| Athletics | Athletics events & tickets | UST Athletics site |
| Athletics | Purchase tickets | Athletics ticketing system |
| Giving | Make a gift | UST giving page |
| Engagement | Volunteer opportunities | Internal or external |
| Student Referral | Refer a student | UST admissions |
| School Directories | Law Directory, Business Directory, etc. | Individual school sites |
| Bookstore | UST bookstore (customized options) | Bookstore online |
| Financial | Regent (financial aid processing) | Cloud for Good / Regent |

**Personalization triggers:**
- Athletic ticket history → show ticket summary
- College/school affiliation → surface relevant school directory link

**Data sources:** Mostly static links stored in Custom Metadata Type for admin management

---

## 9. Communications History

**Purpose:** Give alumni a single place to see all communications UST has sent them — no hunting through email inboxes.

**Features:**
- List of emails sent via Salesforce or SFMC (with open/click status)
- SMS sent (if tracked in Salesforce)
- Filterable by date, type

**Personalization triggers:** All comms tied to the Contact record

**Data sources:**
- `EmailMessage` (individual emails sent via SF)
- SFMC Individual Email Results (synced to SF via Marketing Cloud Connect)
- `SMS_History__c` (custom, if SMS is tracked)

**Notes:**
- Farrah confirmed that anything sent via Salesforce or SFMC can be surfaced
- SFMC data must be synced to the org via Marketing Cloud Connect for portal access

---

## 10. Photo & Story Sharing

**Purpose:** Let alumni share their life updates, stories, and photos — building a sense of community and giving advancement team rich content for storytelling.

**Features:**
- Upload personal photos and life event photos
- Write "Alumni Notes" (short story/update)
- Optionally share notes publicly with the alumni community
- Profile photo upload (also used in Profile Card widget)

**Personalization triggers:** Alumni's own submissions

**Data sources:**
- `ContentDocument` / `ContentVersion` (file uploads)
- Custom `Alumni_Story__c` or `Alumni_Note__c` object
- `Contact.PhotoUrl` (profile photo)

**Notes:**
- Photo upload in Experience Cloud requires proper community sharing rules and file size limits
- Moderation workflow may be needed if notes are publicly visible
- The 5 Ts of Philanthropy framework (Time, Treasure, Talent, Ties, Testimony) — "Testimony" maps to this widget

---

## 11. Athletics

**Purpose:** Surface athletics content for alumni who care about UST sports.

**Features:**
- Upcoming athletics events calendar
- Link to purchase tickets (Athletics ticketing system)
- Show tickets previously purchased (if data is available via integration)
- Integration with UST Athletics ticketing platform

**Personalization triggers:**
- Self-declared interest in athletics (preference center)
- Past ticket purchase history (if available)

**Data sources:**
- Integration with Athletics ticketing system (TBD — API or data sync)
- Campaign records for athletics events (if tracked in Salesforce)

**Notes:**
- Ticketing integration is flagged as a future/nice-to-have — phase 1 likely a link with ticket history if accessible

---

## 12. Videos & Media

**Purpose:** Embed curated video content and photo galleries on the portal — pride-building content that makes alumni feel connected to the UST community.

**Features:**
- Top 10 playlist (curated videos — speaker series, highlights, campaigns)
- Event photo galleries (especially photos from events the alumni attended)
- Embedded video player (YouTube, Vimeo, or hosted)

**Personalization triggers:**
- Events the alumni attended → show photos from those events
- College/school affiliation → show relevant school videos

**Data sources:**
- External video platform (YouTube/Vimeo embed links stored in CMS or Custom Metadata)
- Event photo galleries (CMS content or ContentDocument linked to Campaign)

**Notes:**
- Phase 1: Curated static playlist managed by the communications team
- Future: Personalized gallery showing photos tagged to events the alumni attended

---

## Future / Out-of-Scope Items

| Feature | Notes |
|---------|-------|
| Mobile app | Expressed interest; not in current scope |
| Full real-time preference center (all channels + content) | Patrick flagged as out-of-scope initially |
| Alumni-created events (native portal) | Future phase — link to St. Thomas Connect for now |
| Athletics ticketing integration (deep) | API integration complexity; link-only for phase 1 |
| Student thank-you messages widget | Nice-to-have; requires student side workflow |
| UST awards / achievements display | Data may not be structured in SF yet |


# Widget Catalog — UST Alumni Portal

Each section of the portal is an independent LWC widget component. Widgets are placed in Experience Builder via the **widget zone system**: admins create `UST_Portal_Widget__c` records to control which widgets appear on which pages, in which zones, and for which audience segments. See **Widget Zone System** in `MAIN_GUIDE.md` for setup and configuration instructions.

**Status key:** `Planned` | `In Design` | `In Progress` | `Done`

---

## Component Registry

Maps each widget to its `Component_Name__c` picklist value (the registry key used in `ustWidgetZone`) and its Audience Rule options.

| # | Widget Name | `Component_Name__c` | LWC Component | Audience Options |
|---|------------|---------------------|---------------|-----------------|
| 1 | Profile Card | `ust_profile_card` | `c-ust-profile-card` | All |
| 2 | Events — Upcoming & Registered | `ust_events_widget` | `c-ust-events-widget` | All |
| 3 | Give / Donor Widget | `ust_give_widget` | `c-ust-give-widget` | All, Donor |
| 4 | Engagement Summary | `ust_engagement_summary` | `c-ust-engagement-summary` | All |
| 5 | St. Thomas Connection Messages | `ust_connection_messages` | `c-ust-connection-messages` | All, Donor, Parent, Faculty_Staff |
| 6 | Preference Center | `ust_preference_center` | `c-ust-preference-center` | All |
| 7 | Alumni Directory & Connect | `ust_alumni_directory` | `c-ust-alumni-directory` | All |
| 8 | Links Hub | `ust_links_hub` | `c-ust-links-hub` | All, Parent |
| 9 | Communications History | `ust_communications_history` | `c-ust-communications-history` | All |
| 10 | Photo & Story Sharing | `ust_photo_story` | `c-ust-photo-story` | All |
| 11 | Athletics | `ust_athletics` | `c-ust-athletics` | All |
| 12 | Videos & Media | `ust_videos_media` | `c-ust-videos-media` | All |
| 13 | Volunteer Management | `ust_volunteer` | `c-ust-volunteer` | All |
| 14 | Alumni News & UST Updates | `ust_alumni_news` | `c-ust-alumni-news` | All |

> **Registry activation:** The LWC component tag listed above only renders once its boolean flag is uncommented in `ustWidgetZone.js` and a matching `lwc:if` block is added to `ustWidgetZone.html`. Until then, a stub placeholder shows in Experience Builder and nothing shows in the live site. See MAIN_GUIDE.md → Widget Zone System → Adding a New Widget.

---

## Widget Index

| # | Widget Name | Phase | Priority | Status | Notes |
|---|------------|-------|---------|--------|-------|
| — | [Static Content](#static-content) | 1 | — | ✅ Done | Built-in; no separate LWC needed |
| 1 | [Profile Card](#1-profile-card) | 1 | High | Planned | Includes Business Info update |
| 2 | [Events — Upcoming & Registered](#2-events-upcoming-registered) | 1 | High | Planned | Alumni events, non-alumni events, registrations |
| 3 | [Give / Donor Widget](#3-give-donor-widget) | 1 | High | Planned | Includes Assigned Gift Officer section |
| 4 | [Engagement Summary (Year in Review)](#4-engagement-summary-year-in-review) | 2 | High | Planned | Needs data model definition |
| 5 | [St. Thomas Connection Messages](#5-st-thomas-connection-messages) | 1 | High | Planned | Personalized by role |
| 6 | [Preference Center](#6-preference-center) | 2 | High | Planned | Full pref center is Phase 2; see notes |
| 7 | [Alumni Directory & Connect](#7-alumni-directory-connect) | 1 | Medium | Planned | ❓ Native messaging vs. PeopleGrove TBD |
| 8 | [Links Hub](#8-links-hub) | 1 | Medium | Planned | Expanded link list from 2026 CSV |
| 9 | [Communications History](#9-communications-history) | 2 | Medium | Planned | ❓ MC Connect status TBD |
| 10 | [Photo & Story Sharing](#10-photo-story-sharing) | 1 | Medium | Planned | |
| 11 | [Athletics](#11-athletics) | 1 | Low | Planned | Phase 1 = link only |
| 12 | [Videos & Media](#12-videos-media) | 1 | Low | Planned | Phase 1 = curated playlist |
| 13 | [Volunteer Management](#13-volunteer-management) | 2 | Low | Planned | ❓ V4SF package TBD |
| 14 | [Alumni News & UST Updates](#14-alumni-news-ust-updates) | 1 | Medium | Planned | ❓ Content source TBD |

> **Zone-Ready** means the widget's boolean flag is in `WIDGET_REGISTRY` in `ustWidgetZone.js` and its `lwc:if` block is in `ustWidgetZone.html`. Until then, the zone system shows a stub placeholder in Experience Builder and nothing in the live site.

---

## Static Content

**Purpose:** Allow admins to place arbitrary rich-text content in any zone on any page, without building a dedicated LWC component. Use for banners, announcements, intro copy, or any static HTML content block.

**Widget Type value:** `ust_static_content`  
**LWC:** `c-ust-static-content` (built ✅)  
**Zone-Ready:** ✅ Active

**How to use:**
1. Open (or create) a `UST_Portal_Widget__c` record. The record page uses the **UST Portal Widget Editor** (`ustWidgetRecordEditor`), which replaces the classic layout.
2. Set **Component Name** = `Static Content`. The **Content** section appears.
3. Enter an optional header, pick a **Content CSS Class** (optional), and write the content in the rich text editor. Use the **Paragraph style** dropdown for Heading 2-5. The preview below the editor shows how it renders on the portal.
4. Set Zone, Page Context, Sort Order, and Is Active as normal, then **Save**.

**Content CSS Class (`Content_CSS_Class__c`):** styles the whole widget (not selected text). The classic Quill-based editor cannot round-trip a `class` attribute, so styles are widget-wide. Current values: `ust-content-callout`, `ust-content-inverse`, `ust-content-centered`, `ust-content-muted`. Only inherited properties (text color, alignment, font size) reach the rich text itself, because `lightning-formatted-rich-text` owns its markup.

**Adding a new style class:** (1) add a picklist value on `Content_CSS_Class__c` (API name = CSS class), (2) add it to `ALLOWED_CONTENT_CLASSES` in `ustStaticContent.js`, (3) add its rule in `ustStaticContent.css`. Classes not on the allowlist are ignored.

**Adding a conditional section to the editor later:** add the `Component_Name__c` value and a section key to `COMPONENT_SECTIONS` in `ustWidgetRecordEditor.js`, then add a getter and template block (see the header comment in that file).

**Call-to-action buttons:** In the Content section, use **Add button** to create buttons for the widget. Each button has text, a type, a link, a style, a position, and an optional icon. **Links to** either an *external link* (a full `https://` address, or `mailto:` / `tel:`) or a *portal page*: pick a site page from the list (pages that require sign-in are marked) or type a path that starts with a single `/`, such as `/alumni-directory`. Portal links are stored without the site's address, so the same widget works unchanged in sandbox and production. External web links open in a new tab unless you clear that option. Use the arrows to reorder, the pencil to edit, and the trash to delete; buttons are saved with the widget when you press **Save** (finish or cancel a button you are editing first). **Button Placement** puts the buttons above or below the text (below is the default). **Button Size** applies to every button in the widget: blank sizes to the text, *Wide* gives equal minimum width, *Full width* stretches them. Button text and links can use data tags (links accept only Banner ID and Contact Id). Anything that is not a safe link is dropped when the page loads, so a mistyped or unsafe link never reaches visitors. To add a size: add a `Button_Size__c` picklist value, list it in `ustWidgetButtons.js` (`SIZE_CLASSES`), and add its rule in `ustWidgetButtons.css`.

**Data tags (personalization):** Write `{{First_Name}}` or `{{First_Name|Alum}}` (text after the pipe is the fallback) in the header or body. Use the **Insert data tag** list beside the editor and header field so tags are typed correctly. Available tags: `First_Name` (nickname if there is one), `Last_Name`, `Class_Year`, `Employer`, `Job_Title`, `St_Thomas_Degree`, `City_State`, `Contact_Id`, `Banner_ID`. Values come from the signed-in alumnus's Alumni Directory record; guests and alumni without a record see the fallback (or nothing). Tags are case-insensitive, unknown tags stay visible as typed (the editor warns), and values are escaped so a profile entry can never inject markup. The preview shows sample values; tick **Preview as a guest** to see the fallbacks. Email, phone, birthdate, and address are deliberately not available. To add a tag, add it to `PortalDataTags` (definition and value mapping) and its test.

**Zone and page targeting:** The editor's **Page Context** picker only offers pages that have the selected zone. It reads the `UST_Portal_Zone_Placement__c` registry, which `ustWidgetZone` keeps current by registering itself whenever an admin opens a page in Experience Builder (never for site visitors). Changing the zone removes known pages that lack it, with an Undo. Pages not yet registered can be typed in by page API name (lowercase, for example `my_account__c`). Admins need the `UST_Portal_Widget_Admin` permission set for registration to work. The `banner` and `above_footer` zones live in the shared theme layout (set `Zone Scope` = Layout on any zone placed there) and count as present on every page. See `docs/WIDGET-AUTHORING-PLAN.md`.

**Components:**
- `ustPageContextPicker` - the page/zone-aware Page Context chooser used by the editor.
- `ustHeroBanner` (the banner renderer for the Hero Banner type).
- `ustWidgetButtonEditor` (add/edit/reorder/delete buttons), `ustWidgetButtons` (shared button renderer), `ustButtonRules` (shared link/validation rules).
- `ustDataTagInput` - plain text input with the Insert data tag list (used for the header); `ustDataTags` - shared tag parsing/preview helpers.
- `ustRichTextEditor` is listed below.
- `ustWidgetRecordEditor` - the record-page layout (Widget Setup, Content, Audience Filters) built on `lightning-record-edit-form`.
- `ustRichTextEditor` - wraps `lightning-input-rich-text` and adds the Paragraph / Heading 2-5 dropdown (Heading 1 and 6 are deliberately excluded; the page already supplies the h1 and the widget header renders as an h2). It also shows a character counter against the 32,768 field limit.
- Access: assign the `UST_Portal_Widget_Admin` permission set to admins who manage widgets.

**Data flow:**
- `PortalWidgetController.getWidgetsForZone()` includes `Static_Content__c` and `Content_CSS_Class__c` in its SOQL query and maps them to `PortalWidgetDto.staticContent` / `contentCssClass`
- `ustWidgetZone.buildWidgetRegistry()` passes both through to each widget object
- `ustWidgetZone.html` renders `<c-ust-static-content rich-text-content={widget.staticContent} content-class={widget.contentCssClass}>` when `widget.isStaticContent` is true
- `ustStaticContent` renders the HTML using `<lightning-formatted-rich-text>` (XSS-safe platform renderer)

**Notes:**
- No deployment needed to add new static content - all content is managed in widget records
- The `Static Content` field is an Html type (32,768 character limit)
- Only renders if `richTextContent` is non-empty (guarded by `hasContent` getter)
- After a JS-only deploy, Lightning may serve a stale bundle: clear IndexedDB / Cache Storage and reload twice (about 20 seconds apart)
- Known limitation: the Heading dropdown and class picker are not available through the standard (non-custom) page layout; use the record page

---

---

## Hero Banner

**Purpose:** A large picture banner with a headline, text, and buttons on top, for the top of a page or a major announcement.

**Widget Type value:** `ust_hero_banner`  
**LWC:** `c-ust-hero-banner` (built)  
**Zone-Ready:** Yes

**How to use:**
1. Create a `UST_Portal_Widget__c` record, set **Component Name** = `Hero Banner`, choose the Zone and Page Context, and **Save**. (Pictures need a saved widget.)
2. In the **Hero Banner** section, upload a **desktop picture** (cropped to 1600 x 600). Optionally upload a **mobile picture** (cropped to 800 x 640) for phones. Pictures upload immediately and are not part of Save or Reset.
3. Write **alt text** that describes the picture (required once a picture exists).
4. Choose the **height** (Short, Medium, Tall), where the **text sits** (Left, Center, Right), and the **overlay** (Light, Medium, Strong, or --None-- for no overlay: the picture shows exactly as it is). The text is white, so use Strong for light or busy photos; with --None-- check the text is still readable. A new widget starts on Medium.
5. Write the **Headline**, the **Overlay text**, and add **buttons** in the Content section. Data tags, headings, buttons, placement, and size all work exactly as they do for Static Content. Buttons line up with the text position.
6. The preview shows the banner as visitors will see it (buttons do not navigate in the preview).

**Behavior:**
- With no picture, or if the picture cannot be loaded, the banner shows a solid brand-purple background so the text stays readable.
- A replaced picture shows right away: the address carries a version that changes whenever the widget is saved.
- The picture fills the banner without stretching (it is cropped to fit).

**Setup (once per org):** the S3 uploader needs the bucket configured. See "Phase 4 — as built" in `docs/WIDGET-AUTHORING-PLAN.md` for the five steps (Named Credential URL, CSP trusted site, AWS keys, permission sets, republish).

**Data flow:**
- `PortalWidgetController` adds a `hero` block (`PortalHero`) for hero widgets only: validated https picture addresses with a cache-busting version, alt text, and the look settings.
- `ustWidgetZone` renders `<c-ust-hero-banner>`, which draws the picture and layers `ustStaticContent` on top for the headline, text, and buttons.

## 1. Profile Card

**Purpose:** Surface the alumni's own information on the portal. Give them confidence the portal "knows" them and let them keep their record current.

**Features:**
- Display name, photo, college/school, graduation year, major/minor
- Allow alumni to upload or update their own headshot *(migrate current functionality)*
- Allow alumni to update their contact information *(migrate current functionality)*
- Allow alumni to update their **Business Info** — ❓ *field list TBD (employer, title, LinkedIn URL? confirm with data team — see ROADMAP Q1)*
- GO (Gift Officer) / UA (University Advancement) staff can also update the widget content
- Show contact information (email, phone, city/state)

**Personalization trigger:** Always shown; content varies by Contact record

**Data sources:**
- `Contact` (Name, Photo, Email, Phone, Mailing City/State)
- `hed__Affiliation__c` → `hed__Account__r` (College/School)
- EDA Program Enrollment (Major/Minor)
- Business Info fields — ❓ TBD (Contact fields, related Account, or custom object)

**Notes:**
- Photo upload requires Files + ContentDocument support in Experience Cloud
- Business Info update scope needs clarification before building — could be Contact fields (Title, Company) or a richer business profile object
- Consider privacy controls: alumni can choose what is visible to other alumni in the directory

---

## 2. Events — Upcoming & Registered

**Purpose:** Show events the alumni cares about — both registered events and events matching their preferences. Upcoming events are prioritized over history.

**Features:**

*Upcoming Alumni-Hosted Events list:*
- Suggested events based on: geographic proximity, virtual preference, interest categories
- "Willing to travel" filter to expand geo radius

*Upcoming Non-Alumni Events list:*
- Events NOT hosted by UST Alumni (partner / community events) ❓ *data source TBD — see ROADMAP Q2*
- Filtering by geographic location and alumni location

*Event Registrations — Upcoming:*
- List of events the alumni has already registered for (upcoming first, then past)

*Alumni-Created / Managed Events (Phase 2):*
- Ability for an alumnus to create their own event and invite others
- Requires process flow definition for approval ❓ *see ROADMAP Q3*
- Implemented as a **Screen Flow** embedded in the widget

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
- Show **gift receipts** ❓ *need definition of what information to show and where it is in SF*
- Show **pledges** ❓ *need definition of what information to show and where it is in SF*
- Link to **Endowment Reports** and **Impact Reports** ❓ *need definition*
- "Giving Society" membership badge (if applicable)
- Donor: surface a personalized **thank you message** *(see ROADMAP Q12 — Jira ECRMSF-5238)*

**Assigned Gift Officer section (Phase 1):**
- Show the alumni's assigned Gift Officer with photo and contact information
- Allow GO/UA staff to update their own widget content
- ❓ What fields? (Name, photo, phone, email, calendar booking link?) — *see ROADMAP Q8*
- ❓ Where does GO data live today — on the User record, a Contact relationship, or a custom object?

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

> ❓ **Content type list:** The 2026 CSV notes that content types need to align with existing SFMC "Filters and Sender Keys." This list must be pulled from the SFMC account before building the preference UI — *see ROADMAP Q7.*

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
- Send a direct message to another alumnus (portal message or email) ❓ *see note on PeopleGrove below*
- Alumni Notes / Story sharing with photos
- Alumni-to-alumni event invitations

**Personalization triggers:**
- Alumni's own visibility preferences (opt-in to directory)
- Shared college, class year, major (for "people like you" suggestions)

**Data sources:**
- Contact records with Community User accounts
- Privacy preference flag (directory opt-in)
- `CommunityMessage__c` or Experience Cloud Chatter for messaging — *TBD on approach*

**Notes:**
- **St. Thomas Connect** (PeopleGrove) already exists as a platform for alumni-to-alumni connection
- ❓ Phase 1 decision needed: **native portal messaging** vs. **deep-link into PeopleGrove** — *see ROADMAP Q4*
- Phase 1: Link to St. Thomas Connect with a deep-link into relevant groups/connections (default assumption until Q4 is resolved)
- Phase 2: Native portal directory with filtered search
- LinkedIn city-based groups also exist (Tommie Tailgates) — surface relevant group links by geo

---

## 8. Links Hub

**Purpose:** A curated set of quick-access links to the most common alumni needs and external systems.

**Suggested Links** (all Phase 1 unless noted):

| Category | Link | Target System | Notes |
|---------|------|--------------|-------|
| Career | Job listings / career coaching | Handshake | |
| Career | Alumni professional network | St. Thomas Connect (PeopleGrove) | |
| Career | Career services connection | Handshake or St. Thomas Connect | |
| Academics | Request a transcript | Registrar system | |
| Academics | Regent / financial aid processing | Cloud for Good / Regent | |
| Athletics | Athletics events | UST Athletics site | |
| Athletics | Purchase tickets | Athletics ticketing system ❓ Paciolan? | Phase 1 = link only |
| Giving | Make a gift | UST giving page | Seasonal storytelling |
| Engagement | Volunteer opportunities | Internal or V4SF | Phase 2 if V4SF not installed |
| Engagement | Refer a student | UST admissions | Ways to engage; student referral |
| Directories | Law Directory | Law school site | |
| Directories | Business Directory | Business school site | |
| Community | St. Thomas Connect | PeopleGrove | Alumni-to-alumni connection |
| School / Community | Website — other ways to engage | UST main site | |
| Bookstore | UST Bookstore | Bookstore online | Customizable options if possible |
| Parents | CampusESP | CampusESP portal | Shown conditionally to parents of current students |

**Personalization triggers:**
- Athletic ticket history → show ticket summary (Phase 2 / if data available)
- College/school affiliation → surface relevant school directory link
- Parent flag → show CampusESP link

**Data sources:** Mostly static links stored in Custom Metadata Type for admin management

---

## 9. Communications History

**Purpose:** Give alumni a single place to see all communications UST has sent them — no hunting through email inboxes.

**Features:**
- List of emails sent via Salesforce or SFMC (with open/click status)
- SMS sent — via Activity History ❓ *or custom SMS object? confirm with CRM team*
- Individual Email Results (IER) from SFMC ❓ *Marketing Cloud Connect must be configured — see ROADMAP Q9*
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
- Upload personal photos and life event photos ❓ *does upload need an approval workflow?*
- Write "Alumni Notes" (short story/update) *(migrate existing functionality)*
- Optionally share notes publicly with the alumni community
- Profile photo upload (also used in Profile Card widget)
- **Event photo galleries** — show photos from events the alumnus attended (photos must be tagged to that event/campaign) ❓ *when should they show? who tags photos?*

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
- Top 10 playlist (curated videos — speaker series, highlights, campaigns) ❓ *who manages this? UA/comms team via CMS?*
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

## 13. Volunteer Management

**Purpose:** Let alumni find, sign up for, and create volunteer opportunities — closing the loop on the CASE "Volunteer" pillar directly on the portal.

**Phase:** 2 — needs V4SF package decision first (see ROADMAP Q5)

**Features:**
- Search and browse available volunteer opportunities
- Sign up for opportunities directly from the portal
- *(Phase 2+)* Alumni create their own volunteer opportunities — implemented as a **Screen Flow** embedded in the widget

**Personalization triggers:**
- Alumni's interest categories (from Preference Center)
- Past volunteer history

**Data sources:**
- Volunteers4Salesforce (V4SF) managed package objects (if installed) — `Volunteer_Job__c`, `Volunteer_Shift__c`, `Volunteer_Hours__c`
- ❓ If V4SF is not installed: custom object or NPSP Volunteers alternative

**Notes:**
- ❓ **Key blocker**: Is Volunteers4Salesforce already in the org? If not, this requires a procurement/install decision before development begins
- If V4SF is not available, a lightweight custom object could be built, but that duplicates what V4SF provides
- "Create volunteer opp" flow needs approval process definition before scoping

---

## 14. Alumni News & UST Updates

**Purpose:** Keep alumni informed about what is new with UST and provide a space for ambassador-style storytelling — "proud to be part of the community" content.

**Phase:** 1 — but content source must be confirmed first (see ROADMAP Q11)

**Features:**
- Alumni News section — curated content that UA can update without a code deploy
- UST Updates — easy access to what is new at UST
- "Alumni Ambassador" content — stories celebrating alumni achievement and UST community pride
- Social media follow section — links to UST's active channels ❓ *links needed from comms team*

**Personalization triggers:**
- College/school affiliation → show school-specific news
- Interest preferences (from Preference Center)

**Data sources:**
- ❓ TBD — could be Experience Cloud CMS, a custom `News_Item__c` object, or an RSS feed from the UST website
- Social media links — static, stored in Custom Metadata for admin management

**Notes:**
- This widget is distinct from the Videos & Media widget (Widget 12) — this is text/article content; Widget 12 is video/photo
- UA team needs to be able to manage content without a developer; CMS is the preferred approach
- Coordinate with comms team to confirm where "new with UST" content currently lives

---

## Future / Out-of-Scope Items

| Feature | Notes |
|---------|-------|
| Mobile app | "Contract Update/Licensing" — not a widget; ❓ platform TBD (see ROADMAP Q6) |
| Full real-time preference center (all channels + content) | Phase 2 — needs MarComm collaboration and SFMC sender key list |
| Alumni-created events (native portal) | Phase 2 — approval process TBD (see ROADMAP Q3) |
| Athletics ticketing integration (deep) | Phase 1 = link only; API/data sync is Phase 2+ — ❓ Paciolan? |
| Student thank-you messages widget | References Jira ECRMSF-5238; process definition needed |
| UST awards / achievements display | Data may not be structured in SF yet |
| Engagement year-in-review (gamification) | Phase 2 — uses existing CASE score model; needs data definition |
| Full donation / endowment / impact report suite | Phase 2 — needs data model definition |


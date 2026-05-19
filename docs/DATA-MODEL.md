# Data Model — UST Alumni Portal

This document maps the Salesforce objects and key fields used by the portal widgets. It covers standard objects, EDA managed package objects, and custom objects to be built.

> **EDA Note:** The `hed__` namespace objects are available on **both** the dev scratch org (via the "EASY" snapshot) and EDA-Staging. Apex classes and tests referencing `hed__` types can be compiled and run against either org.

---

## Standard Objects

### Contact
The central record for every alumnus. Nearly every widget reads from or writes to Contact.

| Field | API Name | Notes |
|-------|----------|-------|
| Name | `Name` | Display name |
| Email | `Email` | Primary email (may be personal or institutional) |
| Phone | `Phone` | Primary phone |
| Mailing Address | `MailingCity`, `MailingState`, `MailingPostalCode`, `MailingCountry` | Used for geo-based event recommendations |
| Photo URL | `Contact.PhotoUrl` | Community user profile photo |
| Federated ID (via User) | `User.FederatedIdentifier` | SSO mapping to personal email |
| Engagement Score | *(TBD — existing field on Contact)* | Source of CASE engagement score; query org schema to confirm field name |
| Donor Flag | *(TBD)* | Confirm whether this is a rollup, formula, or custom field |
| Faculty/Staff Flag | *(TBD)* | Custom field indicating UST employment connection |
| Parent Flag | *(TBD)* | Custom field indicating parent-of-current-student connection |
| Directory Opt-In | *(TBD)* | Privacy control for alumni directory visibility |

> **Action:** Confirm field API names for Engagement Score, Donor Flag, Faculty/Staff Flag, and Parent Flag with the advancement team or by querying the EDA-Staging org schema.

### User
Community Users are linked to Contact records. The Experience Cloud portal session is tied to the User.

| Field | Notes |
|-------|-------|
| `ContactId` | Links to the Contact record |
| `FederatedIdentifier` | SSO key (personal email) — populated when alumni has an institutional link, but **most alumni log in via standard Experience Cloud login**, not SSO |
| `Profile` | Community user profile (controls permissions) |

### Campaign
Events are tracked as Campaigns in Salesforce.

| Field | API Name | Notes |
|-------|----------|-------|
| Event Name | `Name` | |
| Event Type | `Type` | Picklist: Virtual, In-Person, Hybrid, etc. |
| Start Date | `StartDate` | |
| End Date | `EndDate` | |
| Location | `Campaign.Description` or custom | TBD — confirm how location is stored |
| Category/Interest Area | *(TBD custom field)* | For preference-based filtering |

### CampaignMember
Links a Contact to a Campaign (event registration).

| Field | Notes |
|-------|-------|
| `ContactId` | Alumnus |
| `CampaignId` | Event/Campaign |
| `Status` | Registered, Attended, No Show, etc. |
| `HasResponded` | Whether they attended (for CASE Experiential metric) |

### Opportunity (NPSP giving)
Gifts and pledges. NPSP standard object.

| Field | Notes |
|-------|-------|
| `AccountId` → Household | NPSP household account |
| `Primary_Contact__c` | Contact (donor) |
| `Amount` | Gift amount |
| `CloseDate` | Gift date |
| `RecordType` | Donation, Pledge, Soft Credit, etc. |

---

## EDA Objects (namespace: `hed__`)

### hed__Affiliation__c
Links a Contact to an Account (College/School/Department). Primary source for "what college did they attend."

| Field | API Name | Notes |
|-------|----------|-------|
| Contact | `hed__Contact__c` | |
| Account (College) | `hed__Account__c` | The college/school account |
| Type | `hed__Type__c` | e.g. "Student", "Faculty", "Staff" |
| Status | `hed__Status__c` | "Current" or "Former" |
| Primary | `hed__Primary__c` | Boolean — marks the primary affiliation |

### hed__Course_Enrollment__c / Program_Enrollment__c
Tracks the alumnus's academic program (degree, major, minor).

| Field | Notes |
|-------|-------|
| Contact lookup | Links to alumnus |
| Program/Course lookup | Resolves to major/minor/degree |
| Status | Active, Graduated, etc. |

> **Action:** Confirm whether EDA Program Enrollment or Course Enrollment is the source for major/minor data in this org.

---

## Custom Objects to Build

### UST_Portal_Widget__c
Admin-controlled registry driving the widget zone system. Each record tells one `ustWidgetZone` LWC instance which component to render, on which page, and for which audience segment.

| Field Label | API Name | Type | Notes |
|------------|----------|------|-------|
| Widget Name | `Name` | Text | Admin label (e.g. "Profile Card - Home") |
| Zone | `Zone__c` | Picklist | body; sidebar; banner; above_footer |
| Component Name | `Component_Name__c` | Picklist | Registry key — must match entry in `ustWidgetZone.js` |
| Page Context | `Page_Context__c` | Multi-select Picklist | all; home; giving; events; profile; directory; news |
| Sort Order | `Sort_Order__c` | Number | Lower = higher on page; ties broken by Name |
| Audience Rule | `Audience_Rule__c` | Picklist | All; Donor; Parent; Faculty_Staff |
| Is Active | `Is_Active__c` | Checkbox | Kill switch; default true |
| Description | `Description__c` | Long Text Area | Admin notes only |

> **Implementation note:** Donor, Parent, and Faculty_Staff audience rules are wired up in `PortalWidgetController.resolveUserAudiences()` with TODO markers. Activate by un-commenting the Contact query block once the field API names for Donor_Flag__c, Parent_Flag__c, and Faculty_Staff_Flag__c are confirmed (see Open Questions below).

### Alumni_Preference__c
Stores the alumni's self-declared preferences for portal personalization.

| Field Label | API Name | Type | Notes |
|------------|----------|------|-------|
| Contact | `Contact__c` | Lookup(Contact) | Master-detail preferred for cleanup |
| Event Type Preferences | `Event_Type_Preferences__c` | Multi-select Picklist | Virtual; In-Person; Career; Athletics; Philanthropy; Social |
| Communication Channels | `Communication_Channels__c` | Multi-select Picklist | Email; SMS; Phone; Mail |
| Geographic Radius (Miles) | `Geo_Radius_Miles__c` | Number | For event distance filtering |
| Willing to Travel | `Willing_To_Travel__c` | Checkbox | Expands event geo radius |
| Newsletter Opt-In | `Newsletter_Opt_In__c` | Checkbox | |
| Directory Opt-In | `Directory_Opt_In__c` | Checkbox | Whether alumnus appears in alumni directory |

### Alumni_Story__c
Stores alumnus-submitted notes, stories, and life updates.

| Field Label | API Name | Type | Notes |
|------------|----------|------|-------|
| Contact | `Contact__c` | Lookup(Contact) | Author |
| Title | `Title__c` | Text(255) | |
| Story Body | `Story_Body__c` | Long Text Area | |
| Published | `Is_Published__c` | Checkbox | Moderation gate |
| Visibility | `Visibility__c` | Picklist | Private; Alumni Community; Public |

### UST_Link__c (or Custom Metadata Type)
Admin-managed list of links for the Links Hub widget. Prefer Custom Metadata Type for deploy-ability.

| Field Label | Type | Notes |
|------------|------|-------|
| Label | Text | Display name |
| URL | URL | Target link |
| Category | Picklist | Career; Academics; Athletics; Giving; etc. |
| College Filter | Text | If blank, shown to all; otherwise scoped to that college |
| Sort Order | Number | Display order |
| Active | Checkbox | |

### Impact_Story__c (or Experience Cloud CMS)
Seasonal giving impact stories shown in the Give widget. Could be a custom object or CMS content collection.

| Field Label | Type | Notes |
|------------|------|-------|
| Title | Text | |
| Body | Rich Text | |
| College | Lookup(Account) | Target audience; blank = all |
| Active Start Date | Date | When to start showing |
| Active End Date | Date | When to stop showing |
| Is Tommie Give Day | Checkbox | Activates special Tommie Give Day styling |

---

## Marketing Cloud Data (via MC Connect)

| Object | Notes |
|--------|-------|
| `Individual_Email_Result__c` | Synced from SFMC via Marketing Cloud Connect; tracks email send, open, click per Contact |
| SFMC Subscriber | Linked by Contact email; preference center updates should sync subscriber attributes |

> **Action:** Confirm Marketing Cloud Connect is configured in EDA-Staging and which objects are synced before building the Communications History widget.

---

## Object Relationship Diagram (Summary)

```
User
 └── ContactId ──> Contact
                      ├── hed__Affiliation__c (College/School)
                      ├── hed__Program_Enrollment__c (Major/Minor)
                      ├── CampaignMember (Event registrations)
                      ├── Opportunity (Gifts — via NPSP)
                      ├── Alumni_Preference__c (Portal prefs)
                      ├── Alumni_Story__c (Notes/stories)
                      └── Individual_Email_Result__c (MC email history)
```

---

## Open Questions / Actions

- [ ] Confirm field API names for Engagement Score, Donor Flag, Faculty/Staff Flag, Parent Flag on Contact in EDA-Staging
- [ ] Confirm whether Program Enrollment or Course Enrollment holds major/minor data
- [ ] Confirm Marketing Cloud Connect sync configuration in EDA-Staging
- [ ] Confirm how event location is stored on Campaign (custom field vs. Description)
- [ ] Decide: Custom object vs. Custom Metadata Type for Links Hub links
- [ ] Confirm fiscal year vs. calendar year for engagement summary
- [ ] Identify existing engagement score fields on Contact (query schema in EDA-Staging)
- [ ] Determine photo upload file size limits and sharing model for Experience Cloud community


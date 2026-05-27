/**
 * PortalWidgetController
 *
 * Returns the ordered list of UST_Portal_Widget__c records that should render
 * in a given zone on a given page for the currently logged-in community user.
 *
 * Filtering is multi-dimensional, based on 10 Contact-level data attributes
 * defined in docs/2026_PortalUpdates-Widget_Filters.csv. Each filter field on
 * UST_Portal_Widget__c is independent. For any given dimension:
 *   - If the widget's filter field is blank, every user qualifies for that dimension.
 *   - If the widget's filter field has values, the user's corresponding Contact field
 *     must contain at least one matching value (OR within dimension).
 * A user sees a widget only if they qualify for ALL non-blank filter dimensions
 * (AND across dimensions).
 *
 * Widgets with no filter fields set are shown to every authenticated user.
 * Guest users (no linked Contact) only see widgets with no filter fields set.
 *
 * Runs without sharing so that community user profiles do not need explicit
 * sharing rules on UST_Portal_Widget__c. The community user profile OR a
 * permission set (Alumni_Portal_Guest for guest, community profile for logged-in)
 * must still grant Read access to the object and all queried fields.
 *
 * See AI-TOOLS-CONFIG.md - Experience Cloud Guest User Access
 *
 * NOTE: Audience_Rule__c is no longer used. It has been superseded by the 10
 * Filter_* fields added in the 2026 portal update. See WIDGET-CATALOG.md.
 */
public without sharing class PortalWidgetController {

    /**
     * Returns widget configurations for the specified zone and page, filtered
     * to those matching the current user's contact data profile across all
     * active filter dimensions.
     *
     * @param zoneName    Developer value of Zone__c (body, sidebar, banner, above_footer)
     * @param pageContext Developer value of the page being rendered (home, events, giving,
     *                    profile, directory, news, all)
     * @return Ordered list of PortalWidgetDto; empty if user has no matching widgets
     *         or if the running user lacks Read access to UST_Portal_Widget__c
     */
    @AuraEnabled
    public static List<PortalWidgetDto> getWidgetsForZone(String zoneName, String pageContext) {
        try {
            if (String.isBlank(zoneName) || String.isBlank(pageContext)) {
                return new List<PortalWidgetDto>();
            }

            // Graceful degradation: return empty list rather than throwing if
            // the community user profile or permission set is missing object access.
            if (!Schema.sObjectType.UST_Portal_Widget__c.isAccessible()) {
                return new List<PortalWidgetDto>();
            }

            ContactFilterValues userFilters = resolveContactFilterValues();

            // Query all active widgets for this zone.
            // Page context and all filter dimensions are evaluated post-query because
            // SOQL INCLUDES with bind variables on multi-select picklists can behave
            // inconsistently across API versions. The result set is always small.
            List<UST_Portal_Widget__c> candidateWidgets = [
                SELECT Id, Name, Component_Name__c, Sort_Order__c, Page_Context__c,
                       Description__c,
                       Filter_College__c,
                       Filter_Degree_Level__c,
                       Filter_St_Thomas_Connection__c,
                       Filter_Academic_Majors__c,
                       Filter_Event_Location_Type__c,
                       Filter_Athletic_Affiliation__c,
                       Filter_Geo_Location__c,
                       Filter_Content_Sender_Key__c,
                       Filter_Class_Year__c,
                       Filter_Volunteer_Status__c
                FROM UST_Portal_Widget__c
                WHERE Zone__c = :zoneName
                  AND Is_Active__c = TRUE
                ORDER BY Sort_Order__c ASC NULLS LAST, Name ASC
            ];

            List<PortalWidgetDto> results = new List<PortalWidgetDto>();
            for (UST_Portal_Widget__c widget : candidateWidgets) {
                if (widgetMatchesPage(widget.Page_Context__c, pageContext)
                        && widgetMatchesContactFilters(widget, userFilters)) {
                    PortalWidgetDto dto = new PortalWidgetDto();
                    dto.id            = widget.Id;
                    dto.widgetLabel   = widget.Name;
                    dto.componentName = widget.Component_Name__c;
                    dto.sortOrder     = widget.Sort_Order__c != null
                                        ? Integer.valueOf(widget.Sort_Order__c)
                                        : 999;
                    dto.description   = widget.Description__c;
                    results.add(dto);
                }
            }
            return results;

        } catch (Exception caught) {
            throw new AuraHandledException(
                'Unable to load portal widgets: ' + caught.getMessage()
            );
        }
    }

    // ----- Page filter -----

    /**
     * Checks whether a widget's multi-select Page_Context__c value includes
     * the requested page or the catch-all 'all' value.
     * Multi-select picklist values are stored as semicolon-delimited strings.
     *
     * @param storedPageContext The raw Page_Context__c value from the record (may be null)
     * @param requestedPage     The page being rendered
     * @return true if the widget should appear on the requested page
     */
    private static Boolean widgetMatchesPage(String storedPageContext, String requestedPage) {
        if (String.isBlank(storedPageContext)) {
            return false;
        }
        Set<String> selectedPages = new Set<String>(storedPageContext.split(';'));
        return selectedPages.contains('all') || selectedPages.contains(requestedPage);
    }

    // ----- Contact filter resolution -----

    /**
     * Resolves the current user's Contact record and extracts values for all
     * 10 active filter dimensions defined in 2026_PortalUpdates-Widget_Filters.csv.
     *
     * Guest users (no linked Contact) receive an empty ContactFilterValues object,
     * which means they only see widgets with NO filter fields set.
     *
     * TODO: Verify these Contact field API names against the EDA-Staging org schema.
     *       Field names are sourced from the "Alumni Directory Field" column in
     *       docs/2026_PortalUpdates-Widget_Filters.csv. Update if the org uses
     *       different names.
     *
     * @return ContactFilterValues populated from the user's Contact record
     */
    private static ContactFilterValues resolveContactFilterValues() {
        ContactFilterValues filterValues = new ContactFilterValues();

        Id userId = UserInfo.getUserId();
        List<User> users = [
            SELECT ContactId
            FROM User
            WHERE Id = :userId
            LIMIT 1
        ];

        if (users.isEmpty() || users[0].ContactId == null) {
            // Guest user or internal user without a linked Contact.
            // Only widgets with all filter fields blank will be shown.
            return filterValues;
        }

        Id contactId = users[0].ContactId;

        // TODO: Confirm these field API names in EDA-Staging before going to production.
        //       Each field name is taken from the "Alumni Directory Field" column in
        //       docs/2026_PortalUpdates-Widget_Filters.csv (with __c appended).
        //
        //   CSV Row               Alumni Directory Field      Contact Field Used Here
        //   --------------------  --------------------------  --------------------------
        //   By college            College__c                  College__c
        //   Alumni Level          Degree_Level_s__c           Degree_Level_s__c
        //   St Thomas Connection  St_Thomas_Connection        St_Thomas_Connection__c
        //   By major/minor        Academic_Majors__c          Academic_Majors__c
        //   Event preferences     Event_Location_Type_s       Event_Location_Type_s__c
        //   Athletic participation Athletic_Affiliation_s     Athletic_Affiliation_s__c
        //   Geo location          Geo_Locations               Geo_Locations__c
        //   Content/Sender Keys   Content_Sender_Keys         Content_Sender_Keys__c
        //   Class Year            Class_Year                  Class_Year__c
        //   Volunteer Status      Volunteer_Status            Volunteer_Status__c

        List<Contact> contacts = [
            SELECT College__c,
                   Degree_Level_s__c,
                   St_Thomas_Connection__c,
                   Academic_Majors__c,
                   Event_Location_Type_s__c,
                   Athletic_Affiliation_s__c,
                   Geo_Locations__c,
                   Content_Sender_Keys__c,
                   Class_Year__c,
                   Volunteer_Status__c
            FROM Contact
            WHERE Id = :contactId
            WITH USER_MODE
            LIMIT 1
        ];

        if (contacts.isEmpty()) {
            return filterValues;
        }

        Contact contact = contacts[0];
        filterValues.colleges             = splitMultiPicklist(contact.College__c);
        filterValues.degreeLevels         = splitMultiPicklist(contact.Degree_Level_s__c);
        filterValues.stThomasConnections  = splitMultiPicklist(contact.St_Thomas_Connection__c);
        filterValues.academicMajors       = splitMultiPicklist(contact.Academic_Majors__c);
        filterValues.eventLocationTypes   = splitMultiPicklist(contact.Event_Location_Type_s__c);
        filterValues.athleticAffiliations = splitMultiPicklist(contact.Athletic_Affiliation_s__c);
        filterValues.geoLocations         = splitMultiPicklist(contact.Geo_Locations__c);
        filterValues.contentSenderKeys    = splitMultiPicklist(contact.Content_Sender_Keys__c);
        filterValues.classYears           = splitMultiPicklist(contact.Class_Year__c);
        filterValues.volunteerStatuses    = splitMultiPicklist(contact.Volunteer_Status__c);

        return filterValues;
    }

    // ----- Filter matching -----

    /**
     * Returns true if the widget should be shown to a user with the given contact filter values.
     *
     * For each filter dimension:
     *   - If the widget's filter field is blank, the user always passes that dimension.
     *   - If the widget's filter field has values, the user must have at least one
     *     matching value in their Contact field (OR within a dimension).
     * The user must pass EVERY non-blank dimension (AND across dimensions).
     *
     * @param widget      The UST_Portal_Widget__c record with all Filter_* fields populated
     * @param userFilters The current user's resolved Contact filter values
     * @return true if the user qualifies to see this widget
     */
    private static Boolean widgetMatchesContactFilters(
            UST_Portal_Widget__c widget,
            ContactFilterValues userFilters) {
        return dimensionMatches(widget.Filter_College__c,                userFilters.colleges)
            && dimensionMatches(widget.Filter_Degree_Level__c,           userFilters.degreeLevels)
            && dimensionMatches(widget.Filter_St_Thomas_Connection__c,   userFilters.stThomasConnections)
            && dimensionMatches(widget.Filter_Academic_Majors__c,        userFilters.academicMajors)
            && dimensionMatches(widget.Filter_Event_Location_Type__c,    userFilters.eventLocationTypes)
            && dimensionMatches(widget.Filter_Athletic_Affiliation__c,   userFilters.athleticAffiliations)
            && dimensionMatches(widget.Filter_Geo_Location__c,           userFilters.geoLocations)
            && dimensionMatches(widget.Filter_Content_Sender_Key__c,     userFilters.contentSenderKeys)
            && dimensionMatches(widget.Filter_Class_Year__c,             userFilters.classYears)
            && dimensionMatches(widget.Filter_Volunteer_Status__c,       userFilters.volunteerStatuses);
    }

    /**
     * Checks one filter dimension: if the widget has no filter values for this dimension,
     * the user always passes. If the widget has filter values, the user must have at least
     * one value in common with the widget's filter (OR logic within the dimension).
     *
     * @param widgetFilterField Semicolon-delimited filter values from the widget record (may be null)
     * @param userValues        Set of values the current user qualifies for on this dimension
     * @return true if the user qualifies for this filter dimension
     */
    private static Boolean dimensionMatches(String widgetFilterField, Set<String> userValues) {
        if (String.isBlank(widgetFilterField)) {
            return true; // No filter on this dimension - all users qualify
        }
        for (String widgetValue : widgetFilterField.split(';')) {
            if (userValues.contains(widgetValue.trim())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Splits a semicolon-delimited multi-select picklist value into a trimmed Set of strings.
     * Returns an empty Set for null or blank input.
     *
     * @param fieldValue The raw field value from a Contact multi-select picklist field
     * @return Set of individual picklist values
     */
    private static Set<String> splitMultiPicklist(String fieldValue) {
        if (String.isBlank(fieldValue)) {
            return new Set<String>();
        }
        Set<String> values = new Set<String>();
        for (String value : fieldValue.split(';')) {
            String trimmed = value.trim();
            if (String.isNotBlank(trimmed)) {
                values.add(trimmed);
            }
        }
        return values;
    }

    // ----- Inner classes -----

    /**
     * Carries the current user's qualifying values for each active filter dimension
     * defined in docs/2026_PortalUpdates-Widget_Filters.csv.
     *
     * Each Set holds the values parsed from the corresponding Contact multi-select
     * picklist field. An empty Set means the Contact has no value for that dimension
     * (which means only widgets with a blank filter for that dimension will match).
     */
    @TestVisible
    private class ContactFilterValues {
        /** College__c values from the user's Contact */
        Set<String> colleges             = new Set<String>();
        /** Degree_Level_s__c values from the user's Contact */
        Set<String> degreeLevels         = new Set<String>();
        /** St_Thomas_Connection__c values from the user's Contact */
        Set<String> stThomasConnections  = new Set<String>();
        /** Academic_Majors__c values from the user's Contact */
        Set<String> academicMajors       = new Set<String>();
        /** Event_Location_Type_s__c values from the user's Contact */
        Set<String> eventLocationTypes   = new Set<String>();
        /** Athletic_Affiliation_s__c values from the user's Contact */
        Set<String> athleticAffiliations = new Set<String>();
        /** Geo_Locations__c values from the user's Contact */
        Set<String> geoLocations         = new Set<String>();
        /** Content_Sender_Keys__c values from the user's Contact */
        Set<String> contentSenderKeys    = new Set<String>();
        /** Class_Year__c value from the user's Contact */
        Set<String> classYears           = new Set<String>();
        /** Volunteer_Status__c value from the user's Contact */
        Set<String> volunteerStatuses    = new Set<String>();
    }

    /**
     * Serialisable representation of a UST_Portal_Widget__c record passed to the LWC.
     * The LWC maps componentName to boolean flags that drive the lwc:if/lwc:elseif
     * registry chain in ustWidgetZone.html.
     */
    public class PortalWidgetDto {
        /** UST_Portal_Widget__c record Id */
        @AuraEnabled public String id;
        /** Widget Name (admin-assigned label, shown in stub placeholder) */
        @AuraEnabled public String widgetLabel;
        /** Component_Name__c picklist value - maps to the LWC registry in ustWidgetZone.js */
        @AuraEnabled public String componentName;
        /** Resolved sort order; defaults to 999 when Sort_Order__c is blank */
        @AuraEnabled public Integer sortOrder;
        /** Admin notes (Description__c); surfaced by stub placeholder in development */
        @AuraEnabled public String description;
    }
}
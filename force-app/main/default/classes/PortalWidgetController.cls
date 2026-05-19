/**
 * PortalWidgetController
 *
 * Returns the ordered list of UST_Portal_Widget__c records that should render
 * in a given zone on a given page for the currently logged-in community user.
 *
 * Audience filtering is additive: a user who belongs to multiple segments
 * (e.g. both Donor and Parent) sees widgets for all of their segments. Widgets
 * with Audience_Rule__c = 'All' are always included for any authenticated user.
 *
 * Contact-level audience flags (Donor, Parent, Faculty_Staff) are stubbed with
 * TODO markers until the field API names are confirmed with the advancement team.
 * See DATA-MODEL.md - Open Questions section. Until those fields are confirmed
 * and the TODO blocks are un-commented, only 'All' audience widgets are active.
 *
 * Runs without sharing so that community user profiles do not need explicit
 * sharing rules on UST_Portal_Widget__c. The community user profile OR a
 * permission set (Alumni_Portal_Guest for guest, community profile for logged-in)
 * must still grant Read access to the object and all queried fields.
 *
 * See AI-TOOLS-CONFIG.md - Experience Cloud Guest User Access
 */
public without sharing class PortalWidgetController {

    /**
     * Returns widget configurations for the specified zone and page, filtered
     * to those matching the current user's audience segment(s).
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

            Set<String> userAudiences = resolveUserAudiences();
            List<String> audienceList = new List<String>(userAudiences);

            // Query all active widgets for this zone that target the right audience.
            // Page context filtering is done post-query (see filterByPage) because
            // SOQL INCLUDES with bind variables on multi-select picklists can behave
            // inconsistently across API versions. The result set is always small.
            List<UST_Portal_Widget__c> candidateWidgets = [
                SELECT Id, Name, Component_Name__c, Sort_Order__c, Audience_Rule__c,
                       Page_Context__c, Description__c
                FROM UST_Portal_Widget__c
                WHERE Zone__c = :zoneName
                  AND Is_Active__c = TRUE
                  AND Audience_Rule__c IN :audienceList
                ORDER BY Sort_Order__c ASC NULLS LAST, Name ASC
            ];

            List<PortalWidgetDto> results = new List<PortalWidgetDto>();
            for (UST_Portal_Widget__c widget : candidateWidgets) {
                if (widgetMatchesPage(widget.Page_Context__c, pageContext)) {
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

    /**
     * Builds the set of Audience_Rule__c values that the current running user
     * qualifies for. 'All' is always included so widgets targeted at every user
     * are never filtered out.
     *
     * Donor, Parent, and Faculty_Staff segments are stubbed pending Contact field
     * confirmation. When the advancement team confirms the field API names, un-comment
     * the corresponding blocks and update the Contact query field list.
     *
     * @return Set containing 'All' plus any additional segment keys the user qualifies for
     */
    private static Set<String> resolveUserAudiences() {
        Set<String> audiences = new Set<String>{ 'All' };

        Id userId = UserInfo.getUserId();
        List<User> users = [
            SELECT ContactId
            FROM User
            WHERE Id = :userId
            LIMIT 1
        ];

        if (users.isEmpty() || users[0].ContactId == null) {
            // Guest user or internal user without a linked Contact.
            // Only 'All' audience widgets are shown.
            return audiences;
        }

        // TODO: Un-comment the block below once Contact audience field API names are
        //       confirmed with the advancement team. See DATA-MODEL.md - Open Questions.
        //       Replace the placeholder field names with the confirmed API names.
        //
        // Id contactId = users[0].ContactId;
        // List<Contact> contacts = [
        //     SELECT Donor_Flag__c, Parent_Flag__c, Faculty_Staff_Flag__c
        //     FROM Contact
        //     WHERE Id = :contactId
        //     LIMIT 1
        // ];
        // if (!contacts.isEmpty()) {
        //     Contact contact = contacts[0];
        //     if (contact.Donor_Flag__c == true)         { audiences.add('Donor'); }
        //     if (contact.Parent_Flag__c == true)        { audiences.add('Parent'); }
        //     if (contact.Faculty_Staff_Flag__c == true) { audiences.add('Faculty_Staff'); }
        // }

        return audiences;
    }

    // ----- Inner DTO -----

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


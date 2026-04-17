/**
 * NavMenuController
 *
 * Apex bridge for fetching Experience Cloud navigation menu items.
 * Queries NavigationMenuItem directly via SOQL so that guest users can access
 * nav data without requiring ConnectApi permissions.
 *
 * ConnectApi.NavigationMenu.getCommunityNavigationMenu() throws
 * "This feature is not currently enabled for this user" for guest users, making
 * it unusable for public-facing LWR sites. The SOQL approach works for all
 * user types as long as the class runs without sharing.
 *
 * Falls back gracefully (empty list) when called outside a community context
 * or when the named menu does not exist yet, allowing LWC components to use
 * their hard-coded defaults instead.
 *
 * Supports Live (published site) and Draft (Experience Builder preview) modes
 * via the publishStatus parameter, which the LWC sets by inspecting
 * CurrentPageReference.state.app ('commeditor' = Draft, everything else = Live).
 */
public without sharing class NavMenuController {

    /**
     * Returns navigation menu items for the specified menu developer name.
     * Top-level items are in the returned list; their children are nested
     * inside each item's subMenu property.
     *
     * @param menuName The DeveloperName of the NavigationLinkSet (navigation menu)
     *                 as configured in Experience Builder under Navigation
     * @param publishStatus 'Live' for the published site, 'Draft' for Experience Builder preview
     * @return List of NavMenuItemDto; empty if not in a community or menu is not found
     */
    @AuraEnabled(cacheable=true)
    public static List<NavMenuItemDto> getMenuItems(String menuName, String publishStatus) {
        try {
            if (String.isBlank(menuName) || String.isBlank(publishStatus)) {
                return new List<NavMenuItemDto>();
            }

            String status = publishStatus.equalsIgnoreCase('Draft') ? 'Draft' : 'Live';

            List<NavigationMenuItem> allItems = [
                SELECT Id, Label, Type, Target, TargetPrefs, ParentId, Position, Status
                FROM NavigationMenuItem
                WHERE NavigationLinkSet.DeveloperName = :menuName
                  AND Status = :status
                ORDER BY Position ASC
            ];

            return buildMenuTree(allItems, null);
        } catch (Exception e) {
            return new List<NavMenuItemDto>();
        }
    }

    /**
     * Recursively builds a nested menu tree from a flat list of NavigationMenuItem records.
     *
     * @param allItems All items fetched for this menu (flat list)
     * @param parentId The parent Id to match at this level; null for top-level items
     * @return Ordered list of NavMenuItemDto with nested subMenu children
     */
    private static List<NavMenuItemDto> buildMenuTree(List<NavigationMenuItem> allItems, Id parentId) {
        List<NavMenuItemDto> result = new List<NavMenuItemDto>();
        for (NavigationMenuItem item : allItems) {
            Boolean matchesParent = (parentId == null)
                ? (item.ParentId == null)
                : (item.ParentId == parentId);
            if (!matchesParent) {
                continue;
            }
            NavMenuItemDto dto = new NavMenuItemDto();
            dto.id = item.Id;
            dto.label = item.Label;
            dto.actionType = mapType(item.Type);
            dto.actionValue = item.Target; // Target field stores the URL/path
            dto.target = mapWindowTarget(item.TargetPrefs);
            dto.subMenu = buildMenuTree(allItems, item.Id);
            result.add(dto);
        }
        return result;
    }

    /**
     * Maps a NavigationMenuItem Type string to the action type string expected by the LWC.
     *
     * @param itemType The Type field value from NavigationMenuItem
     * @return Normalised action type string
     */
    private static String mapType(String itemType) {
        if (String.isBlank(itemType)) {
            return 'InternalLink';
        }
        if (itemType == 'ExternalLink') {
            return 'ExternalLink';
        }
        if (itemType == 'MenuLabel') {
            return 'MenuLabel';
        }
        return 'InternalLink';
    }

    /**
     * Maps NavigationMenuItem TargetPrefs picklist to the window-target string expected by the LWC.
     * TargetPrefs of "None" means open in the current window; anything else (e.g. "OpenInNewWindow")
     * means open in a new tab.
     *
     * @param targetPrefs The TargetPrefs picklist value from NavigationMenuItem
     * @return 'NewWindow' or 'CurrentWindow'
     */
    private static String mapWindowTarget(String targetPrefs) {
        if (String.isNotBlank(targetPrefs) && targetPrefs.containsIgnoreCase('NewWindow')) {
            return 'NewWindow';
        }
        return 'CurrentWindow';
    }

    // ----- Inner DTO -----

    /** Serialisable representation of a navigation menu item. */
    public class NavMenuItemDto {
        /** Salesforce record Id of the NavigationMenuItem */
        @AuraEnabled public String id;
        /** Display label */
        @AuraEnabled public String label;
        /** Action type: ExternalLink, InternalLink, MenuLabel, SalesforceCMSContent, etc. */
        @AuraEnabled public String actionType;
        /** URL or page name depending on actionType */
        @AuraEnabled public String actionValue;
        /** Link target: CurrentWindow or NewWindow */
        @AuraEnabled public String target;
        /** Child items; empty list when no children */
        @AuraEnabled public List<NavMenuItemDto> subMenu;
    }
}

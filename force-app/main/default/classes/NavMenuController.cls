/**
 * NavMenuController
 *
 * Apex bridge for fetching Experience Cloud navigation menu items via SOQL.
 * Uses dynamic SOQL (Database.query) so the class compiles in scratch orgs
 * that do not have Communities / Experience Cloud enabled -- the queries will
 * simply throw at runtime and the catch block returns an empty list, letting
 * the LWC fall back to its hard-coded defaults.
 */
public with sharing class NavMenuController {

    /**
     * Returns navigation menu items for the specified menu developer name.
     * Top-level items appear first; their children are nested in subMenu.
     *
     * @param menuName Developer Name of the NavigationMenu in Experience Builder
     * @return List of NavMenuItemDto, empty if menu not found or not in community
     */
    @AuraEnabled(cacheable=true)
    public static List<NavMenuItemDto> getMenuItems(String menuName) {
        try {
            Id networkId = Network.getNetworkId();
            if (networkId == null || String.isBlank(menuName)) {
                return new List<NavMenuItemDto>();
            }

            // Dynamic SOQL: NavigationMenu is only available in orgs with
            // Communities enabled. Using Database.query avoids compile-time
            // type resolution so the class deploys to any org.
            List<SObject> menus = Database.query(
                'SELECT Id FROM NavigationMenu' +
                ' WHERE DeveloperName = :menuName' +
                ' AND NetworkId = :networkId' +
                ' LIMIT 1'
            );
            if (menus.isEmpty()) {
                return new List<NavMenuItemDto>();
            }

            Id menuId = (Id) menus[0].get('Id');
            List<SObject> allItems = Database.query(
                'SELECT Id, Label, Target, Position, Type, ActionValue, ParentId, Status' +
                ' FROM NavigationMenuItem' +
                ' WHERE NavigationMenuId = :menuId' +
                ' AND Status = \'Live\'' +
                ' ORDER BY Position NULLS LAST'
            );

            return buildTree(allItems, null);
        } catch (Exception e) {
            return new List<NavMenuItemDto>();
        }
    }

    /**
     * Recursively builds the menu item tree from a flat SOQL result.
     *
     * @param allItems All NavigationMenuItem SObjects for the menu
     * @param parentId Filter to items with this parent (null = top-level)
     * @return Nested DTO list
     */
    private static List<NavMenuItemDto> buildTree(
        List<SObject> allItems,
        Id parentId
    ) {
        List<NavMenuItemDto> result = new List<NavMenuItemDto>();
        for (SObject item : allItems) {
            Id itemParentId = (Id) item.get('ParentId');
            if (itemParentId == parentId) {
                NavMenuItemDto dto = new NavMenuItemDto();
                dto.id = (String) item.get('Id');
                dto.label = (String) item.get('Label');
                String itemType = (String) item.get('Type');
                dto.actionType = String.isBlank(itemType) ? 'InternalLink' : itemType;
                dto.actionValue = (String) item.get('ActionValue');
                String itemTarget = (String) item.get('Target');
                dto.target = String.isBlank(itemTarget) ? 'CurrentWindow' : itemTarget;
                dto.subMenu = buildTree(allItems, (Id) item.get('Id'));
                result.add(dto);
            }
        }
        return result;
    }

    // ----- Inner DTO -----

    /** Serialisable representation of a navigation menu item. */
    public class NavMenuItemDto {
        /** Salesforce record Id of the NavigationMenuItem */
        @AuraEnabled public String id;
        /** Display label */
        @AuraEnabled public String label;
        /** Action type: ExternalLink, InternalLink, HomePage, SitePage, etc. */
        @AuraEnabled public String actionType;
        /** URL or page name depending on actionType */
        @AuraEnabled public String actionValue;
        /** Link target: CurrentWindow or NewWindow */
        @AuraEnabled public String target;
        /** Child items; empty list when no children */
        @AuraEnabled public List<NavMenuItemDto> subMenu;
    }
}

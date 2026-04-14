/**
 * NavMenuController
 *
 * Apex bridge for fetching Experience Cloud navigation menu items.
 * Uses ConnectApi.NavigationMenu.getCommunityNavigationMenu() so site builders
 * can manage all navigation entirely inside Experience Builder -- no code change
 * required when links or labels change.
 *
 * Falls back gracefully (empty list) when called outside a community context
 * or when the named menu does not exist yet, allowing LWC components to use
 * their hard-coded defaults instead.
 *
 * Supports Live (published site) and Draft (Experience Builder preview) modes
 * via the publishStatus parameter, which the LWC sets by inspecting
 * CurrentPageReference.state.app ('commeditor' = Draft, everything else = Live).
 */
public with sharing class NavMenuController {

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
            Id networkId = Network.getNetworkId();
            if (networkId == null || String.isBlank(menuName) || String.isBlank(publishStatus)) {
                return new List<NavMenuItemDto>();
            }

            ConnectApi.PublishStatus status = publishStatus.equalsIgnoreCase('Draft')
                ? ConnectApi.PublishStatus.Draft
                : ConnectApi.PublishStatus.Live;

            // Skip item types that are not supported in custom navigation components
            List<ConnectApi.NavigationMenuItemType> skipTypes = new List<ConnectApi.NavigationMenuItemType>{
                ConnectApi.NavigationMenuItemType.Event,
                ConnectApi.NavigationMenuItemType.SystemLink
            };

            ConnectApi.NavigationMenuItemCollection collection =
                ConnectApi.NavigationMenu.getCommunityNavigationMenu(
                    networkId,
                    null,       // navigationLinkSetId -- not needed when DeveloperName is provided
                    menuName,   // navigationLinkSetDeveloperName
                    status,
                    false,      // includeImageUrl
                    false,      // addHomeMenuItem
                    skipTypes
                );

            if (collection == null || collection.menuItems == null) {
                return new List<NavMenuItemDto>();
            }

            return toDto(collection.menuItems);
        } catch (Exception e) {
            return new List<NavMenuItemDto>();
        }
    }

    /**
     * Recursively maps ConnectApi navigation menu items to serializable DTOs.
     *
     * @param items List of ConnectApi.NavigationMenuItem to convert
     * @return Nested DTO list matching the shape expected by the LWC components
     */
    private static List<NavMenuItemDto> toDto(List<ConnectApi.NavigationMenuItem> items) {
        List<NavMenuItemDto> result = new List<NavMenuItemDto>();
        if (items == null) {
            return result;
        }
        for (Integer i = 0; i < items.size(); i++) {
            ConnectApi.NavigationMenuItem item = items.get(i);
            NavMenuItemDto dto = new NavMenuItemDto();
            // ConnectApi.NavigationMenuItem has no id field; use position index
            dto.id = 'nav-' + i;
            dto.label = item.label;
            dto.actionType = item.actionType != null
                ? String.valueOf(item.actionType)
                : 'InternalLink';
            dto.actionValue = item.actionValue;
            // target is ConnectApi.NavigationMenuItemOpenTarget (enum) -- use String.valueOf
            dto.target = item.target != null
                ? String.valueOf(item.target)
                : 'CurrentWindow';
            // subMenu is List<ConnectApi.NavigationMenuItem> directly (no .menuItems wrapper)
            dto.subMenu = (item.subMenu != null)
                ? toDto(item.subMenu)
                : new List<NavMenuItemDto>();
            result.add(dto);
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

/**
 * PortalButtons
 *
 * Turns the call-to-action buttons stored on a Portal Widget (Buttons_JSON__c) into a clean list for
 * the portal. The editor validates when an admin saves, but this class re-checks everything on every
 * read because the JSON could also arrive through a data load or an older editor.
 *
 * Stored shape: {"version":1,"buttons":[{"id","label","type","url","newTab","style","align","icon"}]}
 *   type  external : https://, mailto:, or tel: link
 *         portal   : a path on this site, such as /alumni-directory (the site base path is added at
 *                    render time, which keeps the JSON portable between sandbox and production)
 *
 * Rules, in order, for every button:
 *   1. {{data tags}} in the label and URL are resolved for the current user (PortalDataTags).
 *   2. The label must not be blank after that; the URL must not still contain a tag.
 *   3. The resolved URL must pass the allowlist for its type. Anything else (javascript:, data:,
 *      protocol-relative //host, whitespace, backslashes) drops the button.
 *   4. Unknown styles and alignments fall back to defaults; an invalid icon is ignored.
 * Dropped buttons are skipped silently; the rest still render.
 */
public with sharing class PortalButtons {

    public static final String TYPE_EXTERNAL = 'external';
    public static final String TYPE_PORTAL = 'portal';
    public static final String PLACEMENT_ABOVE = 'Above';
    public static final String PLACEMENT_BELOW = 'Below';

    private static final String DEFAULT_STYLE = 'brand';
    private static final String DEFAULT_ALIGNMENT = 'left';
    private static final Integer MAX_LABEL_LENGTH = 80;
    private static final Integer MAX_URL_LENGTH = 2048;

    /** Network name of the portal; same value the sync_navigation_menu CumulusCI task uses. */
    @TestVisible
    private static final String SITE_NETWORK_NAME = 'Alumni';

    private static final Set<String> STYLES = new Set<String>{
            'text_link', 'brand', 'outline-brand', 'destructive', 'text-destructive', 'neutral', 'success'
    };
    private static final Set<String> ALIGNMENTS = new Set<String>{ 'left', 'center', 'end' };
    private static final Set<String> SIZE_CLASSES = new Set<String>{ 'ust-buttons-wide', 'ust-buttons-full' };

    // Characters never allowed in a link: whitespace, control characters, backslash.
    private static final Pattern HTTPS_PATTERN = Pattern.compile('(?i)^https://[^\\s\\x00-\\x1F\\x7F/?#\\\\]+[^\\s\\x00-\\x1F\\x7F\\\\]*$');
    private static final Pattern MAILTO_PATTERN = Pattern.compile('(?i)^mailto:[^\\s\\x00-\\x1F\\x7F\\\\]+$');
    private static final Pattern TEL_PATTERN = Pattern.compile('(?i)^tel:[+0-9().,;#*\\-]+$');
    private static final Pattern PORTAL_PATH_PATTERN = Pattern.compile('^/(?!/)[^\\s\\x00-\\x1F\\x7F\\\\]*$');
    private static final Pattern ICON_PATTERN = Pattern.compile('^(?:utility:)?([a-z0-9_]+)$');

    /** One cleaned button, ready to render. */
    public class ButtonDto {
        @AuraEnabled public String id;
        @AuraEnabled public String label;
        @AuraEnabled public String type;
        @AuraEnabled public String url;
        @AuraEnabled public Boolean newTab;
        @AuraEnabled public String style;
        @AuraEnabled public String align;
        @AuraEnabled public String icon;
    }

    /** A site page the editor can offer when adding a portal link. */
    public class PortalLinkSuggestion {
        @AuraEnabled public String label;
        @AuraEnabled public String path;
        @AuraEnabled public Boolean loginRequired;
    }

    /**
     * Cleans the stored JSON and resolves data tags for one visitor.
     *
     * @param buttonsJson Raw Buttons_JSON__c value (blank or malformed returns an empty list)
     * @param tagValues   Data tag values for the current user; null or empty for guests
     * @return Valid buttons in their stored order
     */
    public static List<ButtonDto> prepare(String buttonsJson, Map<String, String> tagValues) {
        List<ButtonDto> cleaned = new List<ButtonDto>();
        if (String.isBlank(buttonsJson)) {
            return cleaned;
        }
        Object parsed;
        try {
            parsed = JSON.deserializeUntyped(buttonsJson);
        } catch (JSONException malformed) {
            return cleaned;
        }
        if (!(parsed instanceof Map<String, Object>)) {
            return cleaned;
        }
        Object rawList = ((Map<String, Object>) parsed).get('buttons');
        if (!(rawList instanceof List<Object>)) {
            return cleaned;
        }
        Integer position = 0;
        for (Object item : (List<Object>) rawList) {
            position++;
            if (!(item instanceof Map<String, Object>)) {
                continue;
            }
            ButtonDto button = cleanButton((Map<String, Object>) item, tagValues, position);
            if (button != null) {
                cleaned.add(button);
            }
        }
        return cleaned;
    }

    /**
     * Quick check used to skip the data lookup when no button uses a tag.
     *
     * @param buttonsJson Raw Buttons_JSON__c value
     * @return true if the JSON mentions a tag opener
     */
    public static Boolean containsTag(String buttonsJson) {
        return PortalDataTags.containsTag(buttonsJson);
    }

    /**
     * Normalizes the placement field; blank or unknown means Below.
     *
     * @param placement Raw Button_Placement__c value
     * @return Above or Below
     */
    public static String normalizePlacement(String placement) {
        return placement == PLACEMENT_ABOVE ? PLACEMENT_ABOVE : PLACEMENT_BELOW;
    }

    /**
     * Normalizes the size field to an allowlisted CSS class.
     *
     * @param sizeClass Raw Button_Size__c value
     * @return The class, or an empty string
     */
    public static String normalizeSize(String sizeClass) {
        return sizeClass != null && SIZE_CLASSES.contains(sizeClass) ? sizeClass : '';
    }

    /**
     * Checks a link against the allowlist for its type. The editor mirrors these rules.
     *
     * @param type external or portal
     * @param url  The fully resolved URL
     * @return true if the link is safe to render
     */
    public static Boolean isAllowedUrl(String type, String url) {
        if (String.isBlank(url) || url.length() > MAX_URL_LENGTH || url.contains('{{')) {
            return false;
        }
        if (type == TYPE_PORTAL) {
            return PORTAL_PATH_PATTERN.matcher(url).matches();
        }
        if (type == TYPE_EXTERNAL) {
            return HTTPS_PATTERN.matcher(url).matches()
                    || MAILTO_PATTERN.matcher(url).matches()
                    || TEL_PATTERN.matcher(url).matches();
        }
        return false;
    }

    /**
     * Site pages the editor can offer for portal links, taken from the site navigation menu.
     * Home is always offered. Only admins who can edit widgets receive suggestions.
     *
     * @return Suggestions sorted by label; Home first
     */
    @AuraEnabled
    public static List<PortalLinkSuggestion> getPortalLinkSuggestions() {
        List<PortalLinkSuggestion> suggestions = new List<PortalLinkSuggestion>();
        if (!Schema.SObjectType.UST_Portal_Widget__c.isUpdateable()) {
            return suggestions;
        }
        suggestions.add(buildSuggestion('Home', '/', false));

        List<Network> networks = [SELECT Id FROM Network WHERE Name = :SITE_NETWORK_NAME WITH SYSTEM_MODE LIMIT 1];
        if (networks.isEmpty()) {
            return suggestions;
        }
        Id networkId = networks[0].Id;
        Map<String, NavigationMenuItem> byTarget = new Map<String, NavigationMenuItem>();
        for (NavigationMenuItem item : [
                SELECT Label, Target, Status, AccessRestriction
                FROM NavigationMenuItem
                WHERE Type = 'InternalLink' AND Target != NULL AND NavigationLinkSet.NetworkId = :networkId
                WITH SYSTEM_MODE
                ORDER BY Label ASC
        ]) {
            NavigationMenuItem kept = byTarget.get(item.Target);
            // Prefer the published (Live) copy when a path appears twice.
            if (kept == null || (kept.Status != 'Live' && item.Status == 'Live')) {
                byTarget.put(item.Target, item);
            }
        }
        List<PortalLinkSuggestion> menuPages = new List<PortalLinkSuggestion>();
        for (NavigationMenuItem item : byTarget.values()) {
            if (isAllowedUrl(TYPE_PORTAL, item.Target) && item.Target != '/') {
                menuPages.add(buildSuggestion(item.Label, item.Target, item.AccessRestriction == 'LoginRequired'));
            }
        }
        menuPages.sort(new SuggestionLabelComparator());
        suggestions.addAll(menuPages);
        return suggestions;
    }

    // ----- Helpers -----

    private static ButtonDto cleanButton(Map<String, Object> source, Map<String, String> tagValues, Integer position) {
        String type = stringValue(source, 'type');
        if (type != TYPE_EXTERNAL && type != TYPE_PORTAL) {
            return null;
        }
        String label = PortalDataTags.resolve(stringValue(source, 'label'), tagValues, PortalDataTags.Mode.PLAIN_TEXT);
        label = label == null ? '' : label.trim();
        if (String.isBlank(label)) {
            return null;
        }
        String rawUrl = stringValue(source, 'url');
        String url = PortalDataTags.resolve(rawUrl == null ? null : rawUrl.trim(), tagValues, PortalDataTags.Mode.LINK_URL);
        if (!isAllowedUrl(type, url)) {
            return null;
        }

        ButtonDto button = new ButtonDto();
        button.id = String.isNotBlank(stringValue(source, 'id')) ? stringValue(source, 'id') : 'b' + position;
        button.label = label.length() > MAX_LABEL_LENGTH ? label.substring(0, MAX_LABEL_LENGTH) : label;
        button.type = type;
        button.url = url;
        button.newTab = type == TYPE_EXTERNAL && url.toLowerCase().startsWith('https://')
                && (source.get('newTab') instanceof Boolean ? (Boolean) source.get('newTab') : true);
        String style = stringValue(source, 'style');
        button.style = style != null && STYLES.contains(style) ? style : DEFAULT_STYLE;
        String align = stringValue(source, 'align');
        button.align = align != null && ALIGNMENTS.contains(align) ? align : DEFAULT_ALIGNMENT;
        button.icon = normalizeIcon(stringValue(source, 'icon'));
        return button;
    }

    private static String stringValue(Map<String, Object> source, String key) {
        Object value = source.get(key);
        return value instanceof String ? (String) value : null;
    }

    /**
     * Accepts "heart" or "utility:heart" and returns "utility:heart"; anything else returns null.
     *
     * @param rawIcon Icon as stored
     * @return Normalized utility icon name, or null
     */
    @TestVisible
    private static String normalizeIcon(String rawIcon) {
        if (String.isBlank(rawIcon)) {
            return null;
        }
        Matcher iconMatcher = ICON_PATTERN.matcher(rawIcon.trim().toLowerCase());
        return iconMatcher.matches() ? 'utility:' + iconMatcher.group(1) : null;
    }

    private static PortalLinkSuggestion buildSuggestion(String label, String path, Boolean loginRequired) {
        PortalLinkSuggestion suggestion = new PortalLinkSuggestion();
        suggestion.label = label;
        suggestion.path = path;
        suggestion.loginRequired = loginRequired;
        return suggestion;
    }

    /** Sorts suggestions by label, ignoring case. */
    private class SuggestionLabelComparator implements System.Comparator<PortalLinkSuggestion> {
        public Integer compare(PortalLinkSuggestion first, PortalLinkSuggestion second) {
            return (first.label == null ? '' : first.label.toLowerCase())
                    .compareTo(second.label == null ? '' : second.label.toLowerCase());
        }
    }
}
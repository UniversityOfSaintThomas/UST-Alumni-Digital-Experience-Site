/**
 * PortalButtons
 *
 * Turns the call-to-action buttons stored on a Portal Widget (Buttons_JSON__c) into a clean list for
 * the portal. The editor validates when an admin saves, but this class re-checks everything on every
 * read because the JSON could also arrive through a data load or an older editor.
 *
 * Stored shape: {"version":1,"buttons":[{"id","label","type","url","newTab","style","align","icon"}]}
 * Besides links the list can hold short notes, for a Links List: {"id","kind":"note","html"}. A note has no
 * type, so a version of this class that does not know notes drops it as an invalid button instead of showing
 * it wrongly. A note is a few words of formatted text (bold, italic, underline, line break, paragraph, and
 * https / mailto / tel links) and nothing else: sanitizeNote rebuilds it from an allowlist, so what comes out
 * has only those tags with no attributes except a checked href. Notes are capped (MAX_NOTE_HTML characters,
 * MAX_NOTES per widget, MAX_ITEMS items in all) so the long text field cannot be filled up.
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
    public static final String LAYOUT_ROW = 'row';
    public static final String LAYOUT_LIST = 'list';
    public static final String LAYOUT_LIST_COMPACT = 'list_compact';
    public static final String KIND_LINK = 'link';
    public static final String KIND_NOTE = 'note';
    /** Longest note, counted on the cleaned HTML (tags included). */
    public static final Integer MAX_NOTE_HTML = 500;
    public static final Integer MAX_NOTES = 10;
    /** Links and notes together; later items are ignored. */
    public static final Integer MAX_ITEMS = 40;

    private static final Integer MAX_LABEL_LENGTH = 80;
    private static final Integer MAX_URL_LENGTH = 2048;
    private static final Integer MAX_NOTE_DEPTH = 6;

    /** Network name of the portal; same value the sync_navigation_menu CumulusCI task uses. */
    @TestVisible
    private static final String SITE_NETWORK_NAME = 'Alumni';

    private static final Set<String> STYLES = new Set<String>{
            'text_link', 'arrow_link', 'brand', 'outline-brand', 'destructive', 'text-destructive', 'neutral', 'success'
    };
    private static final Set<String> ALIGNMENTS = new Set<String>{ 'left', 'center', 'end' };
    private static final Set<String> SIZE_CLASSES = new Set<String>{ 'ust-buttons-wide', 'ust-buttons-full' };
    private static final Set<String> LAYOUTS = new Set<String>{ LAYOUT_ROW, LAYOUT_LIST, LAYOUT_LIST_COMPACT };
    private static final Set<String> NOTE_TAGS = new Set<String>{ 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a' };
    private static final Pattern NOTE_TAG_PATTERN = Pattern.compile('<[^<>]*>');
    private static final Pattern NOTE_TAG_PARTS = Pattern.compile('(?s)^<\\s*(/?)\\s*([a-zA-Z][a-zA-Z0-9]*)(.*?)/?\\s*>$');
    private static final Pattern NOTE_HREF = Pattern.compile('(?is)\\bhref\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')');
    private static final Pattern NOTE_BARE_AMPERSAND = Pattern.compile('&(?!(?:amp|lt|gt|quot|#39|nbsp);)');

    // Characters never allowed in a link: whitespace, control characters, backslash.
    private static final Pattern HTTPS_PATTERN = Pattern.compile('(?i)^https://[^\\s\\x00-\\x1F\\x7F/?#\\\\]+[^\\s\\x00-\\x1F\\x7F\\\\]*$');
    private static final Pattern MAILTO_PATTERN = Pattern.compile('(?i)^mailto:[^\\s\\x00-\\x1F\\x7F\\\\]+$');
    private static final Pattern TEL_PATTERN = Pattern.compile('(?i)^tel:[+0-9().,;#*\\-]+$');
    private static final Pattern PORTAL_PATH_PATTERN = Pattern.compile('^/(?!/)[^\\s\\x00-\\x1F\\x7F\\\\]*$');
    private static final Pattern ICON_PATTERN = Pattern.compile('^(?:utility:)?([a-z0-9_]+)$');

    /** One cleaned button, ready to render. */
    public class ButtonDto {
        /** 'link' for a button or link, 'note' for a short text between links */
        @AuraEnabled public String kind = KIND_LINK;
        /** Cleaned HTML of a note (null for a link) */
        @AuraEnabled public String html;
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
        Integer notes = 0;
        for (Object item : (List<Object>) rawList) {
            position++;
            if (position > MAX_ITEMS) {
                break;
            }
            if (!(item instanceof Map<String, Object>)) {
                continue;
            }
            Map<String, Object> source = (Map<String, Object>) item;
            if (stringValue(source, 'kind') == KIND_NOTE) {
                String html = readNote(stringValue(source, 'html'));
                if (html != null && notes < MAX_NOTES) {
                    ButtonDto note = new ButtonDto();
                    note.kind = KIND_NOTE;
                    note.html = html;
                    note.id = String.isNotBlank(stringValue(source, 'id')) ? stringValue(source, 'id') : 'n' + position;
                    cleaned.add(note);
                    notes++;
                }
                continue;
            }
            ButtonDto button = cleanButton(source, tagValues, position);
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
     * Normalizes the layout field; blank or unknown means a row of buttons.
     *
     * @param layout Raw Button_Layout__c value
     * @return row, list or list_compact
     */
    public static String normalizeLayout(String layout) {
        return layout != null && LAYOUTS.contains(layout) ? layout : LAYOUT_ROW;
    }

    /**
     * Checks a note as typed in the editor and returns the cleaned HTML to store. Refuses with a message the
     * admin can act on; the portal re-cleans on every read (readNote), so storing anything else gains nothing.
     *
     * @param html The note as typed
     * @return The cleaned HTML
     */
    @AuraEnabled
    public static String cleanNote(String html) {
        if (String.isNotBlank(html) && html.contains('{{')) {
            throw noteProblem('Data tags are not available in notes. Remove the {{ }} text.');
        }
        String cleaned = sanitizeNote(html);
        if (visibleText(cleaned).length() == 0) {
            throw noteProblem('Write some text for the note.');
        }
        if (cleaned.length() > MAX_NOTE_HTML) {
            throw noteProblem('The note is too long. Keep it to about ' + (MAX_NOTE_HTML / 5) + ' words or fewer ('
                    + cleaned.length() + ' of ' + MAX_NOTE_HTML + ' characters used, formatting included).');
        }
        return cleaned;
    }

    /**
     * Cleans a stored note for the portal.
     *
     * @param html The stored HTML
     * @return The cleaned HTML, or null when the note is empty or too long to show safely
     */
    @TestVisible
    private static String readNote(String html) {
        if (String.isBlank(html) || html.contains('{{')) {
            return null;
        }
        String cleaned = sanitizeNote(html);
        if (visibleText(cleaned).length() == 0 || cleaned.length() > MAX_NOTE_HTML) {
            return null;
        }
        return cleaned;
    }

    /**
     * Rebuilds a note from an allowlist: only p, br, strong, b, em, i, u and a, with no attributes except a
     * checked href (https, mailto or tel). Every other tag is dropped and its text kept; text is escaped; tags
     * are closed in order. Nothing the author typed is copied through as markup.
     *
     * @param raw The note as typed or stored
     * @return Clean HTML (possibly empty)
     */
    @TestVisible
    private static String sanitizeNote(String raw) {
        if (String.isBlank(raw)) {
            return '';
        }
        List<String> parts = new List<String>();
        List<String> open = new List<String>();
        Integer position = 0;
        Matcher tags = NOTE_TAG_PATTERN.matcher(raw);
        while (tags.find()) {
            parts.add(escapeNoteText(raw.substring(position, tags.start())));
            parts.add(rebuildTag(tags.group(), open));
            position = tags.end();
        }
        parts.add(escapeNoteText(raw.substring(position)));
        for (Integer i = open.size() - 1; i >= 0; i--) {
            parts.add(closingTag(open[i]));
        }
        return String.join(parts, '').trim();
    }

    private static String rebuildTag(String tagText, List<String> open) {
        Matcher partsMatcher = NOTE_TAG_PARTS.matcher(tagText);
        if (!partsMatcher.matches()) {
            return '';
        }
        Boolean closing = partsMatcher.group(1) == '/';
        String name = partsMatcher.group(2).toLowerCase();
        if (!NOTE_TAGS.contains(name)) {
            return '';
        }
        if (closing) {
            return name == 'br' ? '' : closeNoteTag(name, open);
        }
        if (name == 'br') {
            return '<br>';
        }
        if (open.size() >= MAX_NOTE_DEPTH) {
            return '';
        }
        if (name == 'a') {
            String href = open.contains('a') || open.contains('a!') ? null : noteHref(partsMatcher.group(3));
            if (href == null) {
                open.add('a!');
                return '';
            }
            open.add('a');
            return '<a href="' + href.replace('&', '&amp;').replace('"', '&quot;') + '">';
        }
        open.add(name);
        return '<' + name + '>';
    }

    private static String noteHref(String attributes) {
        Matcher hrefMatcher = NOTE_HREF.matcher(attributes == null ? '' : attributes);
        if (!hrefMatcher.find()) {
            return null;
        }
        String value = hrefMatcher.group(1) != null ? hrefMatcher.group(1) : hrefMatcher.group(2);
        value = value.replace('&amp;', '&').trim();
        // Site paths are not allowed in a note: their base path is only known when buttons are drawn.
        return !value.startsWith('/') && isAllowedUrl(TYPE_EXTERNAL, value) ? value : null;
    }

    private static String closeNoteTag(String name, List<String> open) {
        String lookFor = name;
        Integer found = -1;
        for (Integer i = open.size() - 1; i >= 0; i--) {
            if (open[i] == lookFor || (name == 'a' && open[i] == 'a!')) {
                found = i;
                break;
            }
        }
        if (found < 0) {
            return '';
        }
        List<String> closers = new List<String>();
        for (Integer i = open.size() - 1; i >= found; i--) {
            closers.add(closingTag(open[i]));
            open.remove(i);
        }
        return String.join(closers, '');
    }

    private static String closingTag(String openName) {
        return openName == 'a!' ? '' : '</' + openName + '>';
    }

    private static String escapeNoteText(String text) {
        return NOTE_BARE_AMPERSAND.matcher(text).replaceAll('&amp;').replace('<', '&lt;').replace('>', '&gt;');
    }

    /** The words of a note with the tags and entities taken out, for the "is it empty" check. */
    private static String visibleText(String html) {
        return html.replaceAll('<[^<>]*>', '').replace('&nbsp;', ' ').trim();
    }

    private static AuraHandledException noteProblem(String message) {
        AuraHandledException problem = new AuraHandledException(message);
        problem.setMessage(message);
        return problem;
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
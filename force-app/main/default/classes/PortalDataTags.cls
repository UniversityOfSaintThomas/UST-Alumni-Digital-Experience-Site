/**
 * PortalDataTags
 *
 * Personalization tags for portal widget content, written as {{Tag_Name}} or {{Tag_Name|fallback}},
 * resolved from the signed-in alumnus's Alumni_Directory__c record. Used in widget headers, body
 * text, and (later) button labels and URLs.
 *
 *   {{First_Name}}        value, or empty text when the alumnus has none (and for guests)
 *   {{First_Name|Alum}}   value, or the text after the pipe when there is no value
 *
 * - Tag names are case-insensitive and spaces count as underscores ({{first name}} works).
 * - The editor can split a tag with formatting ({{First_<b>Name</b>}}); markup inside a tag is ignored.
 * - Unknown tags are left exactly as typed so admins can see and fix them.
 * - Values come from a fixed allowlist (see DEFINITIONS). Sensitive fields (email, phone, birthdate,
 *   address) are deliberately not available.
 * - Alumni can edit several of these fields, so values are HTML-escaped in HTML mode and URL-encoded in
 *   URL mode. Fallback text is written by the admin in the same format as the surrounding text, so it is
 *   inserted as-is (URL-encoded in URL mode).
 * - In LINK_URL mode only tags flagged allowInUrl resolve (identifiers); every other tag becomes empty.
 */
public with sharing class PortalDataTags {

    /** How the surrounding text is used, which decides how values are encoded. (Not named HTML/URL: those clash with system types.) */
    public enum Mode {
        HTML_CONTENT, PLAIN_TEXT, LINK_URL
    }

    /** The allowlist. Single source of truth for the resolver and the editor dropdown. */
    private static final List<TagDefinition> DEFINITIONS = new List<TagDefinition>{
            new TagDefinition('First_Name', 'First name', 'Jordan', false),
            new TagDefinition('Last_Name', 'Last name', 'Tommie', false),
            new TagDefinition('Class_Year', 'Class year', '2012', false),
            new TagDefinition('Employer', 'Employer', 'Summit Health', false),
            new TagDefinition('Job_Title', 'Job title', 'Product Manager', false),
            new TagDefinition('St_Thomas_Degree', 'St. Thomas degree', 'B.A. Communication', false),
            new TagDefinition('City_State', 'City, state', 'St. Paul, MN', false),
            new TagDefinition('Contact_Id', 'Contact Id', '(your Contact Id)', true),
            new TagDefinition('Banner_ID', 'Banner ID', 'A00123456', true)
    };

    private static final Pattern TAG_PATTERN = Pattern.compile('\\{\\{((?:[^{}<]|<[^>]*>)+?)\\}\\}');
    private static final Pattern MARKUP_PATTERN = Pattern.compile('<[^>]*>');

    /** Test seam: when set, valuesForCurrentUser() returns this instead of querying. */
    @TestVisible
    private static Map<String, String> testValues;

    /** One available tag, as the editor needs it. */
    public class TagDefinition {
        @AuraEnabled public String name;
        @AuraEnabled public String label;
        @AuraEnabled public String sample;
        @AuraEnabled public Boolean allowInUrl;

        public TagDefinition(String name, String label, String sample, Boolean allowInUrl) {
            this.name = name;
            this.label = label;
            this.sample = sample;
            this.allowInUrl = allowInUrl;
        }
    }

    /**
     * Lists the available tags for the editor dropdown and unknown-tag warnings.
     *
     * @return Tag definitions in display order
     */
    @AuraEnabled(cacheable=true)
    public static List<TagDefinition> getTagDefinitions() {
        return DEFINITIONS;
    }

    /**
     * Replaces every known {{tag}} in the text.
     *
     * @param text   Content that may contain tags (null or blank is returned unchanged)
     * @param values Tag values keyed by lowercase tag name; null or empty means "no data" (guest)
     * @param renderMode HTML_CONTENT (escape values), PLAIN_TEXT, or LINK_URL (encode values, identifiers only)
     * @return The text with known tags resolved
     */
    public static String resolve(String text, Map<String, String> values, Mode renderMode) {
        if (String.isBlank(text) || !text.contains('{{')) {
            return text;
        }
        Map<String, TagDefinition> definitionsByKey = definitionsByKey();
        Matcher tagMatcher = TAG_PATTERN.matcher(text);
        List<String> parts = new List<String>();
        Integer cursor = 0;
        while (tagMatcher.find()) {
            parts.add(text.substring(cursor, tagMatcher.start()));
            parts.add(replacementFor(tagMatcher.group(0), tagMatcher.group(1), values, renderMode, definitionsByKey));
            cursor = tagMatcher.end();
        }
        parts.add(text.substring(cursor));
        return String.join(parts, '');
    }

    /**
     * Quick check used to skip the data lookup when no widget on the page uses tags.
     *
     * @param text Content to inspect
     * @return true if the text contains a tag opener
     */
    public static Boolean containsTag(String text) {
        return String.isNotBlank(text) && text.contains('{{');
    }

    /**
     * Tag values for the signed-in user's Alumni_Directory__c record.
     * Guests, and users without a directory record, get an empty map.
     * Reads only the allowlisted fields of the user's own record, in system mode, so portal users do
     * not need field access to them.
     *
     * @return Values keyed by lowercase tag name
     */
    public static Map<String, String> valuesForCurrentUser() {
        if (testValues != null) {
            return testValues;
        }
        Id userId = UserInfo.getUserId();
        List<User> users = [SELECT ContactId FROM User WHERE Id = :userId WITH SYSTEM_MODE LIMIT 1];
        if (users.isEmpty() || users[0].ContactId == null) {
            return new Map<String, String>();
        }
        return valuesForContact(users[0].ContactId);
    }

    /**
     * Tag values for one contact's Alumni_Directory__c record.
     *
     * @param contactId The Contact Id
     * @return Values keyed by lowercase tag name; empty if the contact has no directory record
     */
    public static Map<String, String> valuesForContact(Id contactId) {
        List<Alumni_Directory__c> rows = [
                SELECT Nickname__c, First_Name_Text__c, Last_Name_Text__c, Class_Year_Text__c,
                        Employer_Text__c, Occupation_Text__c, St_Thomas_Degree_text__c, City_State__c,
                        Contact_ID__c, Contact_Banner_ID__c
                FROM Alumni_Directory__c
                WHERE Contact__c = :contactId
                WITH SYSTEM_MODE
                LIMIT 1
        ];
        Map<String, String> values = new Map<String, String>();
        if (rows.isEmpty()) {
            return values;
        }
        Alumni_Directory__c row = rows[0];
        values.put('first_name', String.isNotBlank(row.Nickname__c) ? row.Nickname__c : row.First_Name_Text__c);
        values.put('last_name', row.Last_Name_Text__c);
        values.put('class_year', row.Class_Year_Text__c);
        values.put('employer', row.Employer_Text__c);
        values.put('job_title', row.Occupation_Text__c);
        values.put('st_thomas_degree', row.St_Thomas_Degree_text__c);
        values.put('city_state', row.City_State__c);
        values.put('contact_id', row.Contact_ID__c);
        values.put('banner_id', row.Contact_Banner_ID__c);
        return values;
    }

    // ----- Helpers -----

    private static Map<String, TagDefinition> definitionsByKey() {
        Map<String, TagDefinition> byKey = new Map<String, TagDefinition>();
        for (TagDefinition definition : DEFINITIONS) {
            byKey.put(definition.name.toLowerCase(), definition);
        }
        return byKey;
    }

    private static String replacementFor(
            String original, String tagBody, Map<String, String> values, Mode renderMode,
            Map<String, TagDefinition> definitionsByKey) {
        // Ignore editor markup and non-breaking spaces inside the tag.
        String cleaned = MARKUP_PATTERN.matcher(tagBody).replaceAll('')
                .replace('&nbsp;', ' ')
                .replace(String.fromCharArray(new List<Integer>{ 160 }), ' ');
        Integer pipeIndex = cleaned.indexOf('|');
        String rawName = pipeIndex >= 0 ? cleaned.substring(0, pipeIndex) : cleaned;
        String fallback = pipeIndex >= 0 ? cleaned.substring(pipeIndex + 1).trim() : '';

        String key = rawName.trim().replace(' ', '_').toLowerCase();
        TagDefinition definition = definitionsByKey.get(key);
        if (definition == null) {
            return original;
        }
        if (renderMode == Mode.LINK_URL && !definition.allowInUrl) {
            return '';
        }

        String value = values == null ? null : values.get(key);
        Boolean hasValue = String.isNotBlank(value);
        if (renderMode == Mode.HTML_CONTENT) {
            return hasValue ? value.escapeHtml4() : fallback;
        }
        String chosen = hasValue ? value : fallback;
        if (renderMode == Mode.LINK_URL) {
            return EncodingUtil.urlEncode(chosen, 'UTF-8');
        }
        return chosen;
    }
}

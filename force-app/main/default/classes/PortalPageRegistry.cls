/**
 * PortalPageRegistry
 *
 * Keeps UST_Portal_Zone_Placement__c up to date: a record of which widget zones exist on which
 * Experience Cloud pages. ustWidgetZone calls registerPlacement() only while an admin is working
 * in Experience Builder, so site visitors never cause a write. The Portal Widget editor calls
 * getPlacements() so its Page Context picker only offers pages that really have the chosen zone.
 *
 * Runs in the calling user's context (with sharing, user-mode DML). Users without create access to
 * the registry object (guests, regular alumni, non-admins) are silently ignored.
 *
 * Key format: lowercased page API name + '|' + zone, for example home|body.
 * A zone in a shared theme layout is stored once as *|zone and covers every page.
 */
public with sharing class PortalPageRegistry {

    /** Page name used for zones that live in a shared theme layout. */
    public static final String LAYOUT_PAGE_NAME = '*';
    public static final String SCOPE_PAGE = 'Page';
    public static final String SCOPE_LAYOUT = 'Layout';

    /** Re-registering the same placement within this window does not write again. */
    @TestVisible
    private static final Integer TOUCH_INTERVAL_MINUTES = 10;

    private static final Integer MAX_PAGE_NAME_LENGTH = 80;
    private static final Pattern PAGE_NAME_PATTERN = Pattern.compile('^[a-z0-9_\\-]+$');

    /**
     * One row of the registry as the editor needs it.
     */
    public class PlacementDto {
        @AuraEnabled public String id;
        @AuraEnabled public String pageName;
        @AuraEnabled public String pageLabel;
        @AuraEnabled public String zone;
        @AuraEnabled public String scope;
        @AuraEnabled public Datetime lastSeen;
    }

    /**
     * Records that a zone exists on a page. Safe to call on every Experience Builder page load.
     *
     * @param pageName Page API name as read from CurrentPageReference (any case)
     * @param zoneName Zone value (body, sidebar, banner, above_footer)
     * @param scope    Page or Layout; Layout stores the zone once for every page
     * @return created, updated, covered (a layout zone already covers it), or skipped
     */
    @AuraEnabled
    public static String registerPlacement(String pageName, String zoneName, String scope) {
        if (!canRegister()) {
            return 'skipped';
        }
        String zone = normalizeZone(zoneName);
        Boolean isLayout = scope == SCOPE_LAYOUT;
        String page = isLayout ? LAYOUT_PAGE_NAME : normalizePageName(pageName);
        if (zone == null || page == null) {
            return 'skipped';
        }

        String key = buildKey(page, zone);
        String layoutKey = buildKey(LAYOUT_PAGE_NAME, zone);
        Map<String, UST_Portal_Zone_Placement__c> existing = new Map<String, UST_Portal_Zone_Placement__c>();
        for (UST_Portal_Zone_Placement__c row : [
                SELECT Id, Placement_Key__c, Last_Seen__c, Scope__c
                FROM UST_Portal_Zone_Placement__c
                WHERE Placement_Key__c IN :new List<String>{ key, layoutKey }
                WITH USER_MODE
        ]) {
            existing.put(row.Placement_Key__c, row);
        }

        // A layout-level zone already covers every page; do not add a per-page duplicate.
        if (!isLayout && existing.containsKey(layoutKey)) {
            return 'covered';
        }

        UST_Portal_Zone_Placement__c current = existing.get(key);
        Datetime now = Datetime.now();
        if (current != null && current.Last_Seen__c != null
                && current.Last_Seen__c > now.addMinutes(-TOUCH_INTERVAL_MINUTES)) {
            return 'skipped';
        }

        UST_Portal_Zone_Placement__c record = new UST_Portal_Zone_Placement__c(
                Placement_Key__c = key,
                Page_Name__c = page,
                Zone__c = zone,
                Scope__c = isLayout ? SCOPE_LAYOUT : SCOPE_PAGE,
                Last_Seen__c = now
        );
        if (current == null) {
            record.Page_Label__c = prettifyPageName(page);
        }
        Database.UpsertResult result = Database.upsert(
                record, UST_Portal_Zone_Placement__c.Placement_Key__c, false, AccessLevel.USER_MODE);
        if (!result.isSuccess()) {
            return 'skipped';
        }
        return result.isCreated() ? 'created' : 'updated';
    }

    /**
     * Returns the visible (not hidden) placements for the editor, ordered by page then zone.
     * Not cacheable so the editor always sees placements registered a moment ago.
     *
     * @return Placements; empty if the user cannot read the registry
     */
    @AuraEnabled
    public static List<PlacementDto> getPlacements() {
        List<PlacementDto> results = new List<PlacementDto>();
        if (!Schema.SObjectType.UST_Portal_Zone_Placement__c.isAccessible()) {
            return results;
        }
        for (UST_Portal_Zone_Placement__c row : [
                SELECT Id, Page_Name__c, Page_Label__c, Zone__c, Scope__c, Last_Seen__c
                FROM UST_Portal_Zone_Placement__c
                WHERE Hidden__c = FALSE
                WITH USER_MODE
                ORDER BY Page_Name__c ASC, Zone__c ASC
        ]) {
            PlacementDto dto = new PlacementDto();
            dto.id = row.Id;
            dto.pageName = row.Page_Name__c;
            dto.pageLabel = String.isNotBlank(row.Page_Label__c) ? row.Page_Label__c : prettifyPageName(row.Page_Name__c);
            dto.zone = row.Zone__c;
            dto.scope = row.Scope__c;
            dto.lastSeen = row.Last_Seen__c;
            results.add(dto);
        }
        return results;
    }

    /**
     * Idempotently seeds the placements known from the site bundle: the banner and above_footer
     * zones in the shared theme layout, and the body/sidebar zones on Home and the Alumni Directory.
     * Anything missing or misnamed is corrected later by Experience Builder registration.
     * Run once per org (CumulusCI task seed_zone_placements).
     *
     * @return Number of placements created
     */
    public static Integer seedKnownPlacements() {
        List<List<String>> known = new List<List<String>>{
                new List<String>{ LAYOUT_PAGE_NAME, 'banner', SCOPE_LAYOUT },
                new List<String>{ LAYOUT_PAGE_NAME, 'above_footer', SCOPE_LAYOUT },
                new List<String>{ 'home', 'body', SCOPE_PAGE },
                new List<String>{ 'home', 'sidebar', SCOPE_PAGE },
                new List<String>{ 'alumni_directory__c', 'sidebar', SCOPE_PAGE }
        };
        Set<String> keys = new Set<String>();
        for (List<String> entry : known) {
            keys.add(buildKey(entry[0], entry[1]));
        }
        Set<String> existingKeys = new Set<String>();
        for (UST_Portal_Zone_Placement__c row : [
                SELECT Placement_Key__c FROM UST_Portal_Zone_Placement__c
                WHERE Placement_Key__c IN :keys WITH USER_MODE
        ]) {
            existingKeys.add(row.Placement_Key__c);
        }
        List<UST_Portal_Zone_Placement__c> toInsert = new List<UST_Portal_Zone_Placement__c>();
        for (List<String> entry : known) {
            String key = buildKey(entry[0], entry[1]);
            if (!existingKeys.contains(key)) {
                toInsert.add(new UST_Portal_Zone_Placement__c(
                        Placement_Key__c = key,
                        Page_Name__c = entry[0],
                        Zone__c = entry[1],
                        Scope__c = entry[2],
                        Page_Label__c = prettifyPageName(entry[0]),
                        Last_Seen__c = Datetime.now()
                ));
            }
        }
        if (!toInsert.isEmpty()) {
            insert as user toInsert;
        }
        return toInsert.size();
    }

    // ----- Helpers -----

    private static Boolean canRegister() {
        Schema.DescribeSObjectResult describe = Schema.SObjectType.UST_Portal_Zone_Placement__c;
        return describe.isCreateable() && describe.isUpdateable();
    }

    private static String buildKey(String page, String zone) {
        return page + '|' + zone;
    }

    /**
     * Lowercases and validates a page API name.
     *
     * @param pageName Raw page name
     * @return Normalized name, or null if blank, too long, or containing unexpected characters
     */
    @TestVisible
    private static String normalizePageName(String pageName) {
        if (String.isBlank(pageName)) {
            return null;
        }
        String normalized = pageName.trim().toLowerCase();
        if (normalized.length() > MAX_PAGE_NAME_LENGTH || !PAGE_NAME_PATTERN.matcher(normalized).matches()) {
            return null;
        }
        return normalized;
    }

    /**
     * Checks a zone against the active Zone__c picklist values.
     *
     * @param zoneName Raw zone
     * @return The zone value, or null if it is not a defined zone
     */
    private static String normalizeZone(String zoneName) {
        if (String.isBlank(zoneName)) {
            return null;
        }
        String candidate = zoneName.trim();
        for (Schema.PicklistEntry entry : UST_Portal_Zone_Placement__c.Zone__c.getDescribe().getPicklistValues()) {
            if (entry.isActive() && entry.getValue() == candidate) {
                return entry.getValue();
            }
        }
        return null;
    }

    /**
     * Turns a page API name into a friendly default label (alumni_directory__c becomes Alumni Directory).
     *
     * @param pageName Normalized page name
     * @return Label, or 'All pages' for the layout wildcard
     */
    @TestVisible
    private static String prettifyPageName(String pageName) {
        if (pageName == LAYOUT_PAGE_NAME) {
            return 'All pages';
        }
        List<String> words = new List<String>();
        for (String word : pageName.removeEnd('__c').replace('-', '_').split('_')) {
            if (String.isNotBlank(word)) {
                words.add(word.substring(0, 1).toUpperCase() + word.substring(1));
            }
        }
        return String.join(words, ' ');
    }
}
/**
 * Tests for PortalPageRegistry. Zone values come from the schema, never hardcoded.
 */
@IsTest
private class PortalPageRegistry_TEST {

    private static List<String> activeZones() {
        List<String> zones = new List<String>();
        for (Schema.PicklistEntry entry : UST_Portal_Zone_Placement__c.Zone__c.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                zones.add(entry.getValue());
            }
        }
        return zones;
    }

    private static Integer placementCount() {
        return [SELECT COUNT() FROM UST_Portal_Zone_Placement__c];
    }

    @IsTest
    static void registersPageZoneWithPrettyLabel() {
        String zone = activeZones()[0];

        String outcome = PortalPageRegistry.registerPlacement('Alumni_Directory__c', zone, PortalPageRegistry.SCOPE_PAGE);

        System.assertEquals('created', outcome, 'First registration should create a record');
        UST_Portal_Zone_Placement__c row = [
                SELECT Placement_Key__c, Page_Name__c, Page_Label__c, Scope__c, Last_Seen__c
                FROM UST_Portal_Zone_Placement__c
        ];
        System.assertEquals('alumni_directory__c|' + zone, row.Placement_Key__c, 'Key uses the lowercased page name');
        System.assertEquals('alumni_directory__c', row.Page_Name__c, 'Page name is lowercased');
        System.assertEquals('Alumni Directory', row.Page_Label__c, 'Default label is prettified');
        System.assertEquals(PortalPageRegistry.SCOPE_PAGE, row.Scope__c, 'Scope should be Page');
        System.assertNotEquals(null, row.Last_Seen__c, 'Last seen should be set');
    }

    @IsTest
    static void repeatedRegistrationDoesNotDuplicateOrRewrite() {
        String zone = activeZones()[0];
        PortalPageRegistry.registerPlacement('home', zone, PortalPageRegistry.SCOPE_PAGE);

        String second = PortalPageRegistry.registerPlacement('Home', zone, PortalPageRegistry.SCOPE_PAGE);

        System.assertEquals('skipped', second, 'A fresh record is not rewritten inside the touch window');
        System.assertEquals(1, placementCount(), 'Exactly one record should exist');
    }

    @IsTest
    static void staleRegistrationUpdatesLastSeenAndKeepsEditedLabel() {
        String zone = activeZones()[0];
        PortalPageRegistry.registerPlacement('home', zone, PortalPageRegistry.SCOPE_PAGE);
        UST_Portal_Zone_Placement__c row = [SELECT Id FROM UST_Portal_Zone_Placement__c];
        row.Last_Seen__c = Datetime.now().addDays(-3);
        row.Page_Label__c = 'Landing Page';
        update row;

        String outcome = PortalPageRegistry.registerPlacement('home', zone, PortalPageRegistry.SCOPE_PAGE);

        System.assertEquals('updated', outcome, 'A stale record should be touched');
        UST_Portal_Zone_Placement__c after = [SELECT Page_Label__c, Last_Seen__c FROM UST_Portal_Zone_Placement__c];
        System.assertEquals('Landing Page', after.Page_Label__c, 'An admin-edited label must survive re-registration');
        System.assert(after.Last_Seen__c > Datetime.now().addMinutes(-5), 'Last seen should be refreshed');
        System.assertEquals(1, placementCount(), 'Still one record');
    }

    @IsTest
    static void layoutZoneIsStoredOnceForAllPagesAndCoversPages() {
        String zone = activeZones()[0];

        String layoutOutcome = PortalPageRegistry.registerPlacement('home', zone, PortalPageRegistry.SCOPE_LAYOUT);
        String pageOutcome = PortalPageRegistry.registerPlacement('alumni_notes__c', zone, PortalPageRegistry.SCOPE_PAGE);

        System.assertEquals('created', layoutOutcome, 'Layout zone should be created');
        System.assertEquals('covered', pageOutcome, 'A page registration is covered by the layout zone');
        UST_Portal_Zone_Placement__c row = [SELECT Page_Name__c, Scope__c, Page_Label__c FROM UST_Portal_Zone_Placement__c];
        System.assertEquals(PortalPageRegistry.LAYOUT_PAGE_NAME, row.Page_Name__c, 'Layout zones use the wildcard page');
        System.assertEquals(PortalPageRegistry.SCOPE_LAYOUT, row.Scope__c, 'Scope should be Layout');
        System.assertEquals('All pages', row.Page_Label__c, 'Wildcard label');
    }

    @IsTest
    static void invalidInputsAreIgnored() {
        String zone = activeZones()[0];

        System.assertEquals('skipped', PortalPageRegistry.registerPlacement(null, zone, 'Page'), 'Blank page');
        System.assertEquals('skipped', PortalPageRegistry.registerPlacement('home', 'not_a_zone', 'Page'), 'Unknown zone');
        System.assertEquals('skipped', PortalPageRegistry.registerPlacement('bad page!', zone, 'Page'), 'Bad characters');
        System.assertEquals('skipped', PortalPageRegistry.registerPlacement('x'.repeat(81), zone, 'Page'), 'Too long');
        System.assertEquals(0, placementCount(), 'Nothing should be written');
    }

    @IsTest
    static void usersWithoutRegistryAccessCannotRegister() {
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String uniqueName = 'registry' + String.valueOf(Crypto.getRandomInteger()).replace('-', '');
        User plainUser = new User(
                Alias = 'plain', Email = uniqueName + '@example.com', EmailEncodingKey = 'UTF-8',
                LastName = 'Plain', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
                ProfileId = standardProfile.Id, TimeZoneSidKey = 'America/Chicago',
                Username = uniqueName + '@example.com'
        );
        insert plainUser;
        String zone = activeZones()[0];

        String outcome;
        System.runAs(plainUser) {
            outcome = PortalPageRegistry.registerPlacement('home', zone, 'Page');
            System.assertEquals(0, PortalPageRegistry.getPlacements().size(), 'No registry access means no rows');
        }

        System.assertEquals('skipped', outcome, 'A user without create access is ignored');
        System.assertEquals(0, placementCount(), 'Nothing should be written');
    }

    @IsTest
    static void getPlacementsExcludesHiddenAndOrders() {
        List<String> zones = activeZones();
        PortalPageRegistry.registerPlacement('zeta_page', zones[0], 'Page');
        PortalPageRegistry.registerPlacement('alpha_page', zones[0], 'Page');
        PortalPageRegistry.registerPlacement('hidden_page', zones[0], 'Page');
        UST_Portal_Zone_Placement__c hidden = [SELECT Id FROM UST_Portal_Zone_Placement__c WHERE Page_Name__c = 'hidden_page'];
        hidden.Hidden__c = true;
        update hidden;

        List<PortalPageRegistry.PlacementDto> placements = PortalPageRegistry.getPlacements();

        System.assertEquals(2, placements.size(), 'Hidden rows are excluded');
        System.assertEquals('alpha_page', placements[0].pageName, 'Ordered by page name');
        System.assertEquals('Alpha Page', placements[0].pageLabel, 'Label is returned');
        System.assertEquals('zeta_page', placements[1].pageName, 'Ordered by page name');
    }

    @IsTest
    static void seedIsIdempotent() {
        Integer first = PortalPageRegistry.seedKnownPlacements();
        Integer second = PortalPageRegistry.seedKnownPlacements();

        System.assertEquals(5, first, 'Five known placements are seeded');
        System.assertEquals(0, second, 'A second run creates nothing');
        System.assertEquals(5, placementCount(), 'Five records exist');
        System.assertEquals(2, [SELECT COUNT() FROM UST_Portal_Zone_Placement__c WHERE Scope__c = :PortalPageRegistry.SCOPE_LAYOUT],
                'Two layout zones are seeded');
    }
}
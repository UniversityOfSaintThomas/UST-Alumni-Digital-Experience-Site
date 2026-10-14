/**
 * Tests for AlumniConnectionsController. Written first (TDD) - this is the highest-risk
 * class in the Connected Alumni Profile feature, since it is the first place profile,
 * news, and business data for a THIRD PARTY (not the viewer's own record) are joined
 * together and returned to the client. Every privacy/approval gate already enforced by the
 * existing single-purpose controllers must be reproduced exactly here, or this new unified
 * view becomes a way to leak unpublished news or unapproved business listings that the
 * existing list views already correctly hide.
 *
 * Gates being asserted against the real controller source (not just this class's own
 * assumptions):
 * - Alumni_News__c: Reviewed_for_Community_Display__c = true AND Public_Display__c = true
 *   (AlumniNewsListController.generateWhere)
 * - Professional_Directory__c: RecordTypeId = Alumni_Business, Alumni__c != null,
 *   Company_Status__c = 'Approved', UST_Test_Contact__c = false
 *   (AlumniBusinessDirectoryController.buildWhereClause)
 *
 * Does not use TestAlumniCommunityDataFactory (see AlumniFavoriteController_TEST for why -
 * required fixtures don't exist in this scratch org). No portal User/System.runAs needed
 * here since getConnectedProfile() takes an explicit Contact Id parameter rather than
 * resolving the running user - it is deliberately a "view someone else" read path, not a
 * "view my own" path, so tests run as the default test-context user.
 *
 * Real-world correction hit while writing this class: Professional_Directory__c.
 * UST_Test_Contact__c is a FORMULA field (rolling up Alumni__r.UST_Test_Contact__c on
 * Contact - a field that exists live in this org but is not tracked in this repo's Contact
 * metadata source) and cannot be set directly on insert ("Field is not writeable"). The
 * "excluded because test contact" case is exercised by setting UST_Test_Contact__c=true on
 * the linked Contact instead, letting the formula roll up naturally. Also,
 * Company_Status__c is a restricted picklist whose active values in this org are
 * Submitted/Under Review/Approved/Inactive (queried live via getPicklistValues, not
 * assumed) - "Pending" is not a valid value here; "Submitted" is used for the
 * not-yet-approved test case instead.
 */
@isTest
private class AlumniConnectionsController_TEST {

    @TestSetup
    static void makeData() {
        Contact contactWithEverything = new Contact(FirstName = 'Everything', LastName = 'ConnectionsTest');
        Contact contactWithNothing = new Contact(FirstName = 'Nothing', LastName = 'ConnectionsTest');
        Contact contactNewsOnly = new Contact(FirstName = 'NewsOnly', LastName = 'ConnectionsTest');
        Contact contactUnpublishedNews = new Contact(FirstName = 'UnpublishedNews', LastName = 'ConnectionsTest');
        Contact contactUnapprovedBusiness = new Contact(FirstName = 'UnapprovedBusiness', LastName = 'ConnectionsTest');
        // UST_Test_Contact__c on Professional_Directory__c is a formula that rolls up from
        // Alumni__r.UST_Test_Contact__c (Contact) - set it here, not on the junction record.
        Contact contactTestFlagged = new Contact(FirstName = 'TestFlagged', LastName = 'ConnectionsTest', UST_Test_Contact__c = true);
        insert new List<Contact>{
                contactWithEverything, contactWithNothing, contactNewsOnly,
                contactUnpublishedNews, contactUnapprovedBusiness, contactTestFlagged
        };

        Alumni_Directory__c directoryWithEverything = new Alumni_Directory__c(
                Name = 'Everything ConnectionsTest',
                First_Name_Text__c = 'Everything',
                Last_Name_Text__c = 'ConnectionsTest',
                Class_Year_Text__c = '2015',
                Contact__c = contactWithEverything.Id
        );
        Alumni_Directory__c directoryWithNothing = new Alumni_Directory__c(
                Name = 'Nothing ConnectionsTest',
                First_Name_Text__c = 'Nothing',
                Last_Name_Text__c = 'ConnectionsTest',
                Contact__c = contactWithNothing.Id
        );
        Alumni_Directory__c directoryNewsOnly = new Alumni_Directory__c(
                Name = 'NewsOnly ConnectionsTest',
                First_Name_Text__c = 'NewsOnly',
                Last_Name_Text__c = 'ConnectionsTest',
                Contact__c = contactNewsOnly.Id
        );
        Alumni_Directory__c directoryUnpublishedNews = new Alumni_Directory__c(
                Name = 'UnpublishedNews ConnectionsTest',
                First_Name_Text__c = 'UnpublishedNews',
                Last_Name_Text__c = 'ConnectionsTest',
                Contact__c = contactUnpublishedNews.Id
        );
        Alumni_Directory__c directoryUnapprovedBusiness = new Alumni_Directory__c(
                Name = 'UnapprovedBusiness ConnectionsTest',
                First_Name_Text__c = 'UnapprovedBusiness',
                Last_Name_Text__c = 'ConnectionsTest',
                Contact__c = contactUnapprovedBusiness.Id
        );
        insert new List<Alumni_Directory__c>{
                directoryWithEverything, directoryWithNothing, directoryNewsOnly,
                directoryUnpublishedNews, directoryUnapprovedBusiness
        };

        List<Alumni_News__c> newsRecords = new List<Alumni_News__c>{
                new Alumni_News__c(
                        Contact__c = contactWithEverything.Id,
                        Category__c = 'Career News',
                        Alumni_News__c = 'Published news for Everything',
                        Reviewed_for_Community_Display__c = true,
                        Public_Display__c = true,
                        News_Date__c = Date.valueOf('2020-01-01')
                ),
                new Alumni_News__c(
                        Contact__c = contactNewsOnly.Id,
                        Category__c = 'Career News',
                        Alumni_News__c = 'Published news for NewsOnly',
                        Reviewed_for_Community_Display__c = true,
                        Public_Display__c = true,
                        News_Date__c = Date.valueOf('2020-01-02')
                ),
                // Reviewed but not marked for public display - must be excluded.
                new Alumni_News__c(
                        Contact__c = contactUnpublishedNews.Id,
                        Category__c = 'Career News',
                        Alumni_News__c = 'Reviewed but not public',
                        Reviewed_for_Community_Display__c = true,
                        Public_Display__c = false,
                        News_Date__c = Date.valueOf('2020-01-03')
                ),
                // Marked public but never reviewed - must also be excluded.
                new Alumni_News__c(
                        Contact__c = contactUnpublishedNews.Id,
                        Category__c = 'Career News',
                        Alumni_News__c = 'Public but not reviewed',
                        Reviewed_for_Community_Display__c = false,
                        Public_Display__c = true,
                        News_Date__c = Date.valueOf('2020-01-04')
                )
        };
        insert newsRecords;

        Id alumniBusinessRecordTypeId = Schema.SObjectType.Professional_Directory__c
                .getRecordTypeInfosByDeveloperName()
                .get('Alumni_Business')?.getRecordTypeId();

        List<Professional_Directory__c> businessRecords = new List<Professional_Directory__c>{
                new Professional_Directory__c(
                        Company_Name__c = 'Approved Co',
                        Company_City__c = 'St. Paul',
                        Company_State__c = 'MN',
                        Alumni__c = contactWithEverything.Id,
                        RecordTypeId = alumniBusinessRecordTypeId,
                        Company_Status__c = 'Approved'
                ),
                // Not yet approved - must be excluded.
                new Professional_Directory__c(
                        Company_Name__c = 'Pending Co',
                        Company_City__c = 'Minneapolis',
                        Company_State__c = 'MN',
                        Alumni__c = contactUnapprovedBusiness.Id,
                        RecordTypeId = alumniBusinessRecordTypeId,
                        Company_Status__c = 'Submitted'
                ),
                // Approved status but the Alumni's Contact is flagged as a test contact
                // (UST_Test_Contact__c is a formula rolling up from Alumni__r.UST_Test_Contact__c)
                // - must also be excluded.
                new Professional_Directory__c(
                        Company_Name__c = 'Test Contact Co',
                        Company_City__c = 'Duluth',
                        Company_State__c = 'MN',
                        Alumni__c = contactTestFlagged.Id,
                        RecordTypeId = alumniBusinessRecordTypeId,
                        Company_Status__c = 'Approved'
                )
        };
        insert businessRecords;
    }

    @isTest
    static void getConnectedProfile_returnsProfileNewsAndBusiness_whenAllThreeExist() {
        Alumni_Directory__c directory = queryDirectoryByLastName('Everything');
        Contact contact = queryContact('Everything');

        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(contact.Id);
        Test.stopTest();

        System.assertEquals(true, result.hasProfile, 'Expected a profile to be found.');
        System.assertEquals(directory.Id, result.alumniDirectoryId);
        System.assertEquals(1, result.newsItems.size(), 'Expected exactly the one published news item.');
        System.assertEquals(1, result.businessListings.size(), 'Expected exactly the one approved business listing.');
        System.assertEquals('Approved Co', result.businessListings[0].Company_Name__c);
    }

    @isTest
    static void getConnectedProfile_returnsEmptyListsButHasProfile_whenNoConnectedRecordsExist() {
        Contact contact = queryContact('Nothing');

        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(contact.Id);
        Test.stopTest();

        System.assertEquals(true, result.hasProfile, 'A directory record exists even with no news/business.');
        System.assertEquals(0, result.newsItems.size());
        System.assertEquals(0, result.businessListings.size());
    }

    @isTest
    static void getConnectedProfile_returnsNewsOnly_whenNoBusinessListingsExist() {
        Contact contact = queryContact('NewsOnly');

        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(contact.Id);
        Test.stopTest();

        System.assertEquals(1, result.newsItems.size());
        System.assertEquals(0, result.businessListings.size());
    }

    @isTest
    static void getConnectedProfile_excludesNewsThatIsNotBothReviewedAndPublic() {
        Contact contact = queryContact('UnpublishedNews');

        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(contact.Id);
        Test.stopTest();

        System.assertEquals(
                0,
                result.newsItems.size(),
                'Both seeded news rows fail the Reviewed_for_Community_Display__c AND Public_Display__c gate and must not appear.'
        );
    }

    @isTest
    static void getConnectedProfile_excludesUnapprovedBusinessListing() {
        Contact contact = queryContact('UnapprovedBusiness');

        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(contact.Id);
        Test.stopTest();

        System.assertEquals(
                0,
                result.businessListings.size(),
                'The seeded business row for this contact is Company_Status__c=Submitted (not Approved) and must not appear.'
        );
    }

    @isTest
    static void getConnectedProfile_excludesBusinessListingWhenAlumniContactIsFlaggedAsTest() {
        Contact contact = queryContact('TestFlagged');

        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(contact.Id);
        Test.stopTest();

        System.assertEquals(
                0,
                result.businessListings.size(),
                'The seeded business row is Approved but its Alumni Contact has UST_Test_Contact__c=true, which rolls up via formula and must exclude it.'
        );
    }

    @isTest
    static void getConnectedProfile_returnsHasProfileFalse_whenContactHasNoDirectoryRecord() {
        Contact orphanContact = new Contact(FirstName = 'NoDirectory', LastName = 'ConnectionsTest');
        insert orphanContact;

        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(orphanContact.Id);
        Test.stopTest();

        System.assertEquals(false, result.hasProfile);
        System.assertEquals(0, result.newsItems.size());
        System.assertEquals(0, result.businessListings.size());
    }

    @isTest
    static void getConnectedProfile_returnsHasProfileFalse_whenContactIdIsNull() {
        Test.startTest();
        AlumniConnectionsController.ConnectedProfileDto result = AlumniConnectionsController.getConnectedProfile(null);
        Test.stopTest();

        System.assertEquals(false, result.hasProfile);
    }

    // ─── Test data helpers ──────────────────────────────────────────────────

    private static Contact queryContact(String firstName) {
        return [SELECT Id FROM Contact WHERE FirstName = :firstName AND LastName = 'ConnectionsTest' LIMIT 1];
    }

    private static Alumni_Directory__c queryDirectoryByLastName(String firstName) {
        return [SELECT Id FROM Alumni_Directory__c WHERE First_Name_Text__c = :firstName AND Last_Name_Text__c = 'ConnectionsTest' LIMIT 1];
    }
}

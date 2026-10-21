/**
 * Proves that a signed-in portal user with the Alumni_Community permission set can use the portal, and that the
 * permission set (not something else) is what grants it. Everything runs as a real Customer Community user.
 *
 * Notes on what runAs can and cannot show:
 *  - runAs does NOT enforce Apex-class permissions, so the class grants are checked from the permission set itself.
 *  - Object and field access IS enforced inside WITH USER_MODE queries, which is where a missing grant would fail.
 *  - A user (setup object) and a Contact (not setup) cannot be created in one transaction, so setup is split across
 *    runAs blocks. Only one portal user is created per test: a scratch org has just five Community licenses.
 */
@IsTest
private class Alumni_Community_TEST {

    private static final String BANNER_ID = '99999991';
    private static final String OTHER_BANNER_ID = '99999992';

    private static final Set<String> PORTAL_CLASSES = new Set<String>{
        'AlumniProfileController', 'AlumniConnectionsController', 'AlumniBusinessDirectoryController',
        'AlumniDirectoryListController', 'AlumniNewsListController', 'PortalWidgetController', 'AlumniFavoriteController'
    };

    /** A role-holding owner for the portal Contact's Account (Experience Cloud requires the owner to have a role). */
    private static User createAccountOwner() {
        UserRole role = new UserRole(Name = 'Alumni Portal Test Owner', DeveloperName = 'Alumni_Portal_Test_Owner');
        insert role;
        User owner = new User(
            Alias = 'aptown', Username = 'aptowner' + System.currentTimeMillis() + '@example.com',
            Email = 'aptowner@example.com', LastName = 'Owner', EmailEncodingKey = 'UTF-8',
            TimeZoneSidKey = 'America/Chicago', LocaleSidKey = 'en_US', LanguageLocaleKey = 'en_US',
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator' LIMIT 1].Id,
            UserRoleId = role.Id
        );
        insert owner;
        // The Alumni Business record type is only visible through a permission set, and the owner has to see it
        // to create the business listings below. Setup DML, so it goes with the user insert.
        insert new PermissionSetAssignment(
            AssigneeId = owner.Id,
            PermissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Community' LIMIT 1].Id
        );
        return owner;
    }

    /** Creates the people and their directory records, returning the signed-in person's Contact Id. */
    private static Id createAlumni(User owner) {
        Id signedInContactId;
        System.runAs(owner) {
            Account account = new Account(Name = 'Portal Test Household', OwnerId = owner.Id);
            insert account;
            Contact signedIn = new Contact(
                FirstName = 'Jordan', LastName = 'Portaltest', Email = 'jordan.portaltest@example.com',
                University_Banner_ID__c = BANNER_ID, AccountId = account.Id, Degree_s_Formatted__c = '2021 BA'
            );
            Contact other = new Contact(
                FirstName = 'Avery', LastName = 'Neighbor', Email = 'avery.neighbor@example.com',
                University_Banner_ID__c = OTHER_BANNER_ID, AccountId = account.Id
            );
            insert new List<Contact>{ signedIn, other };

            insert new List<Alumni_Directory__c>{
                new Alumni_Directory__c(
                    Name = 'Jordan Portaltest', First_Name_Text__c = 'Jordan', Last_Name_Text__c = 'Portaltest',
                    Class_Year_Text__c = '2021', Employer_Text__c = 'North Star', Contact__c = signedIn.Id
                ),
                new Alumni_Directory__c(
                    Name = 'Avery Neighbor', First_Name_Text__c = 'Avery', Last_Name_Text__c = 'Neighbor',
                    Class_Year_Text__c = '1999', Contact__c = other.Id
                )
            };
            // an approved, active business listing for each person (read with user permissions by two controllers)
            Id businessType = Schema.SObjectType.Professional_Directory__c.getRecordTypeInfosByDeveloperName().get('Alumni_Business').getRecordTypeId();
            insert new List<Professional_Directory__c>{
                new Professional_Directory__c(
                    RecordTypeId = businessType, Alumni__c = signedIn.Id, Company_Name__c = 'Portal Test Coffee',
                    Title__c = 'Owner', Company_City__c = 'Saint Paul', Company_State__c = 'MN',
                    Company_Website__c = 'https://example.com/coffee', Company_Status__c = 'Approved', Active_Display__c = 'Active',
                    Company_Description__c = 'Fresh roasted', Company_Phone__c = '555-0100'
                ),
                new Professional_Directory__c(
                    RecordTypeId = businessType, Alumni__c = other.Id, Company_Name__c = 'Neighbor Bakery',
                    Title__c = 'Baker', Company_City__c = 'Edina', Company_State__c = 'MN',
                    Company_Website__c = 'https://example.com/bakery', Company_Status__c = 'Approved', Active_Display__c = 'Active'
                )
            };
            // public news for the neighbour, to exercise the connected-profile view
            insert new Alumni_News__c(
                Contact__c = other.Id, Category__c = firstPicklistValue(Alumni_News__c.Category__c),
                Alumni_News__c = 'Started a new job', Public_Display__c = true, Reviewed_for_Community_Display__c = true
            );
            signedInContactId = signedIn.Id;
        }
        return signedInContactId;
    }

    private static User createPortalUser(User owner, Id contactId, Boolean withPermissionSet) {
        User portalUser;
        System.runAs(owner) {
            portalUser = new User(
                Alias = 'aptuser', Username = 'aptuser' + System.currentTimeMillis() + '@example.com',
                Email = 'jordan.portaltest@example.com', FirstName = 'Jordan', LastName = 'Portaltest',
                CommunityNickname = 'aptuser' + System.currentTimeMillis(), ContactId = contactId,
                ProfileId = [SELECT Id FROM Profile WHERE UserLicense.Name = 'Customer Community Login' LIMIT 1].Id,
                EmailEncodingKey = 'UTF-8', TimeZoneSidKey = 'America/Chicago', LocaleSidKey = 'en_US',
                LanguageLocaleKey = 'en_US'
            );
            insert portalUser;
            if (withPermissionSet) {
                insert new PermissionSetAssignment(
                    AssigneeId = portalUser.Id,
                    PermissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Community' LIMIT 1].Id
                );
            }
        }
        return portalUser;
    }

    private static String firstPicklistValue(Schema.SObjectField field) {
        for (Schema.PicklistEntry entry : field.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                return entry.getValue();
            }
        }
        return null;
    }

    @IsTest
    static void permissionSetGrantsEveryPortalControllerToApexClasses() {
        Id permissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Community' LIMIT 1].Id;
        Set<String> granted = new Set<String>();
        for (SetupEntityAccess access : [
            SELECT SetupEntityId FROM SetupEntityAccess
            WHERE ParentId = :permissionSetId AND SetupEntityType = 'ApexClass'
        ]) {
            granted.add(String.valueOf(access.SetupEntityId));
        }
        Set<String> names = new Set<String>();
        for (ApexClass apexClass : [SELECT Id, Name FROM ApexClass WHERE Name IN :PORTAL_CLASSES]) {
            if (granted.contains(String.valueOf(apexClass.Id))) {
                names.add(apexClass.Name);
            }
        }
        System.assertEquals(PORTAL_CLASSES, names, 'The permission set must grant every controller the portal calls');
    }

    @IsTest
    static void guestPermissionSetGrantsThePublicControllers() {
        Id permissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Community_Guest' LIMIT 1].Id;
        Set<String> granted = new Set<String>();
        for (SetupEntityAccess access : [
            SELECT SetupEntityId FROM SetupEntityAccess
            WHERE ParentId = :permissionSetId AND SetupEntityType = 'ApexClass'
        ]) {
            granted.add(String.valueOf(access.SetupEntityId));
        }
        Set<String> names = new Set<String>();
        for (ApexClass apexClass : [
            SELECT Id, Name FROM ApexClass WHERE Name IN ('PortalWidgetController', 'AlumniBusinessDirectoryController')
        ]) {
            if (granted.contains(String.valueOf(apexClass.Id))) {
                names.add(apexClass.Name);
            }
        }
        System.assertEquals(
            new Set<String>{ 'PortalWidgetController', 'AlumniBusinessDirectoryController' }, names,
            'Guests need the widget and business directory controllers'
        );
    }

    @IsTest
    static void portalUserWithThePermissionSetCanUseThePortal() {
        User owner = createAccountOwner();
        Id contactId = createAlumni(owner);
        User portalUser = createPortalUser(owner, contactId, true);
        Id ownDirectoryId = [SELECT Id FROM Alumni_Directory__c WHERE Contact__c = :contactId LIMIT 1].Id;
        Id neighborContactId = [SELECT Id FROM Contact WHERE University_Banner_ID__c = :OTHER_BANNER_ID LIMIT 1].Id;

        System.runAs(portalUser) {
            // my profile (USER_MODE read of the directory)
            AlumniProfileController.AlumniProfileDto mine = AlumniProfileController.getMyProfile();
            System.assertEquals(true, mine.hasRecord, 'Own profile is found');
            System.assertEquals('Jordan', mine.firstNameText, 'Own first name');
            System.assertEquals(true, mine.canEdit, 'Own profile is editable');
            System.assertEquals(1, mine.businessDirectoryRecords.size(), 'My own business listing is read with the granted fields');
            System.assertEquals('Portal Test Coffee', mine.businessDirectoryRecords[0].Company_Name__c, 'Business name');

            // editing my own profile (update of the whitelisted fields)
            AlumniProfileController.AlumniProfileSaveInput input = new AlumniProfileController.AlumniProfileSaveInput();
            input.recordId = ownDirectoryId;
            input.firstNameText = 'Jordan';
            input.lastNameText = 'Portaltest';
            input.employerText = 'Updated Employer';
            System.assertEquals('Updated Employer', AlumniProfileController.saveMyProfile(input).employerText, 'Save works');

            // someone else's profile can be read, but not edited
            System.assertEquals(false, AlumniProfileController.getProfileByRecordId(
                [SELECT Id FROM Alumni_Directory__c WHERE Contact__c = :neighborContactId LIMIT 1].Id).canEdit,
                'Other people are read-only');

            // connected profile with public news
            AlumniConnectionsController.ConnectedProfileDto connected = AlumniConnectionsController.getConnectedProfile(neighborContactId);
            System.assertEquals(true, connected.hasProfile, 'Connected profile is found');
            System.assertEquals(1, connected.businessListings.size(), 'The neighbour\'s approved business listing is read with the granted fields');
            System.assertEquals('Neighbor Bakery', connected.businessListings[0].Company_Name__c, 'Business name');

            // directory search and news (without USER_MODE, but they still must be callable)
            System.assertEquals(1, AlumniDirectoryListController.getAlumniDirectory(1, 10, 10, 'Avery', null).size(), 'Directory search finds the neighbour');
            System.assertNotEquals(null, AlumniNewsListController.getNews(1, 10, null, null), 'News list works');

            // The business directory controller itself runs in system mode (it is public), so it needs no field grants.
            // It still looks the record type up for the running user, so the Alumni Business record type must be visible.
            System.assertNotEquals(null, Schema.SObjectType.Professional_Directory__c.getRecordTypeInfosByDeveloperName().get('Alumni_Business'), 'The Alumni Business record type is visible');
        }
    }

    @IsTest
    static void publicBusinessDirectoryNeedsNoFieldGrantsBecauseItRunsInSystemMode() {
        User owner = createAccountOwner();
        Id contactId = createAlumni(owner);
        User portalUser = createPortalUser(owner, contactId, true);

        // The portal user is NOT granted these fields (the permission set only has the nine the profile pages use),
        // yet the public directory returns them: it runs in system mode, so its SELECT list is the only gate.
        Id permissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Community' LIMIT 1].Id;
        System.assertEquals(0, [
            SELECT COUNT() FROM FieldPermissions
            WHERE ParentId = :permissionSetId AND Field = 'Professional_Directory__c.Company_Description__c'
        ], 'Test setup: the description is not one of the fields this permission set grants');

        System.runAs(portalUser) {
            List<Professional_Directory__c> page = AlumniBusinessDirectoryController.alumniBusinessDirectory(
                null, null, null, null, null, 10, 0);
            System.assertEquals(2, page.size(), 'Both approved listings are returned');
            Map<String, Professional_Directory__c> byName = new Map<String, Professional_Directory__c>();
            for (Professional_Directory__c row : page) {
                byName.put(row.Company_Name__c, row);
            }
            System.assertEquals('Fresh roasted', byName.get('Portal Test Coffee').Company_Description__c, 'A field the user has no grant for is returned');
            System.assertEquals('2021 BA', byName.get('Portal Test Coffee').Alumni__r.Degree_s_Formatted__c, 'The alumnus\'s formatted degree comes with it');
            System.assertEquals(2, AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(null, null, null, null, null), 'Count matches');

            // the filters still narrow it
            System.assertEquals(1, AlumniBusinessDirectoryController.alumniBusinessDirectory(
                'Bakery', null, null, null, null, 10, 0).size(), 'Search narrows the results');
        }
    }

    @IsTest
    static void newsSearchWorksForAPortalUserIncludingTheCityAndStateMatch() {
        User owner = createAccountOwner();
        Id contactId = createAlumni(owner);
        User portalUser = createPortalUser(owner, contactId, true);

        System.runAs(portalUser) {
            // The search builds a dynamic query that also matches Contact.Community_Address_Range__c (city + state), so the
            // portal user needs read access to that field or the whole search fails with "No such column".
            List<AlumniNewsListController.AlumniNews> byName = AlumniNewsListController.getNews(1, 10, 'Avery', null);
            System.assertNotEquals(null, byName, 'A name search finds the neighbour\'s news');
            System.assertEquals(1, byName.size(), 'One news item for Avery');
            System.assertEquals('Started a new job', byName[0].newsItem, 'News text comes back');

            System.assertEquals(0, AlumniNewsListController.getNews(1, 10, 'Nobodyhasthisname', null).size(), 'No match returns an empty list');
        }
    }

    @IsTest
    static void widgetsAreServedToAPortalUser() {
        User owner = createAccountOwner();
        Id contactId = createAlumni(owner);
        User portalUser = createPortalUser(owner, contactId, true);
        System.runAs(owner) {
            insert new UST_Portal_Widget__c(
                Name = 'Portal test widget', Component_Name__c = 'ust_static_content', Zone__c = 'body',
                Page_Context__c = 'home', Is_Active__c = true, Static_Content_Header__c = 'Hello {{First_Name}}'
            );
        }

        System.runAs(portalUser) {
            List<PortalWidgetController.PortalWidgetDto> widgets = PortalWidgetController.getWidgetsForZone('body', 'home');
            System.assertEquals(1, widgets.size(), 'The active widget is served');
            System.assert(widgets[0].staticContentHeader.contains('Jordan'), 'The data tag is filled in for this person: ' + widgets[0].staticContentHeader);
        }
    }

    @IsTest
    static void withoutThePermissionSetThePortalDataIsNotReadable() {
        User owner = createAccountOwner();
        Id contactId = createAlumni(owner);
        User portalUser = createPortalUser(owner, contactId, false);

        System.runAs(portalUser) {
            Boolean blocked = false;
            try {
                AlumniProfileController.getMyProfile();
            } catch (Exception caught) {
                blocked = true;
            }
            System.assert(blocked, 'The permission set is what lets the user read the directory fields');
        }
    }
}

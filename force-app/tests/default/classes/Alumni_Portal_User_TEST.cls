/**
 * Proves that a signed-in portal user with the Alumni_Portal_User permission set can use the portal, and that the
 * permission set (not something else) is what grants it. Everything runs as a real Customer Community user.
 *
 * Notes on what runAs can and cannot show:
 *  - runAs does NOT enforce Apex-class permissions, so the class grants are checked from the permission set itself.
 *  - Object and field access IS enforced inside WITH USER_MODE queries, which is where a missing grant would fail.
 *  - A user (setup object) and a Contact (not setup) cannot be created in one transaction, so setup is split across
 *    runAs blocks. Only one portal user is created per test: a scratch org has just five Community licenses.
 */
@IsTest
private class Alumni_Portal_User_TEST {

    private static final String BANNER_ID = '99999991';
    private static final String OTHER_BANNER_ID = '99999992';

    private static final Set<String> PORTAL_CLASSES = new Set<String>{
        'AlumniProfileController', 'AlumniConnectionsController', 'AlumniBusinessDirectoryController',
        'AlumniDirectoryListController', 'AlumniNewsListController', 'PortalWidgetController'
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
                University_Banner_ID__c = BANNER_ID, AccountId = account.Id
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
                    PermissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Portal_User' LIMIT 1].Id
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
        Id permissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Portal_User' LIMIT 1].Id;
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

            // directory search and news (without USER_MODE, but they still must be callable)
            System.assertEquals(1, AlumniDirectoryListController.getAlumniDirectory(1, 10, 10, 'Avery', null).size(), 'Directory search finds the neighbour');
            System.assertNotEquals(null, AlumniNewsListController.getNews(1, 10, null, null), 'News list works');

            // the business directory is read in USER_MODE: the object, its fields, and the record type must be granted
            System.assertNotEquals(null, [SELECT Id, Company_Name__c, Company_Status__c FROM Professional_Directory__c WITH USER_MODE LIMIT 1], 'Business directory objects and fields are readable');
            System.assertNotEquals(null, Schema.SObjectType.Professional_Directory__c.getRecordTypeInfosByDeveloperName().get('Alumni_Business'), 'The Alumni Business record type is visible');
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

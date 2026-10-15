/**
 * Tests for AlumniFavoriteController.
 *
 * Deliberately does NOT use TestAlumniCommunityDataFactory - that factory requires
 * fixtures that only exist after the full config_dev CumulusCI flow has run (a System
 * Administrator user literally named "ETL User" and a profile named "Alumni Community User";
 * see AGENTS.md "Testing Gotchas"). Confirmed in this scratch org: neither fixture exists yet
 * (the actual community profile here is "Alumni Profile", and there is no "ETL User"). These
 * tests only need resolveCurrentContactId() to resolve under System.runAs, which requires a
 * real portal user - Contact.ContactId on a User is rejected with FIELD_INTEGRITY_EXCEPTION
 * unless the user has a portal license, so a lightweight test user on "Customer Community
 * Login User" (a standard, portal-licensed profile always available in any org) is used
 * instead, with an Account on each Contact as portal users require.
 *
 * Along the way, two dead ends were confirmed against this specific scratch org and are
 * worth recording: "Alumni Profile" (the only profile in this org with "Alumni" in its name)
 * is actually a Guest User License profile, not a logged-in community profile, so it cannot
 * be assigned to a real User at all. And none of the standard Customer Community profiles
 * have any pre-existing FieldPermissions/ObjectPermissions grant on Alumni_Directory__c or
 * Professional_Directory__c in this org (confirmed via a live query) - whatever grants let
 * AlumniProfileController/AlumniBusinessDirectoryController work for real alumni today must
 * live on a site-specific profile this scratch org has not yet been provisioned with. Rather
 * than depend on that org-setup state, the new Alumni_Favorites_User permission set below
 * explicitly grants Read on the small field set getMyFavorites() actually selects, so these
 * tests do not depend on any Experience Cloud site configuration having run.
 *
 * The Alumni_Favorites_User permission set (object CRUD on Alumni_Favorite__c, plus Read on
 * Alumni_Directory__c/Professional_Directory__c and the handful of display fields
 * getMyFavorites() resolves) is assigned to each test user in @TestSetup, since a fresh
 * Private custom object grants no access to non-admin profiles by default.
 */
@isTest
private class AlumniFavoriteController_TEST {

    @TestSetup
    static void makeData() {
        Account ownerAccount = new Account(Name = 'Owner AlumniFavoriteTest Account');
        Account otherAccount = new Account(Name = 'Other AlumniFavoriteTest Account');
        insert new List<Account>{ ownerAccount, otherAccount };

        Contact ownerContact = new Contact(FirstName = 'Owner', LastName = 'AlumniFavoriteTest', AccountId = ownerAccount.Id);
        Contact otherContact = new Contact(FirstName = 'Other', LastName = 'AlumniFavoriteTest', AccountId = otherAccount.Id);
        insert new List<Contact>{ ownerContact, otherContact };

        Alumni_Directory__c favoritedAlumni = new Alumni_Directory__c(
                Name = 'Favorited Alum',
                First_Name_Text__c = 'Favorited',
                Last_Name_Text__c = 'Alum',
                Class_Year_Text__c = '2010',
                Contact__c = otherContact.Id
        );
        insert favoritedAlumni;

        Id recTypeId = Schema.SObjectType.Professional_Directory__c
                .getRecordTypeInfosByDeveloperName()
                .get('Alumni_Business')?.getRecordTypeId();

        Professional_Directory__c favoritedBusiness = new Professional_Directory__c(
                Company_Name__c = 'Favorited Business',
                Company_City__c = 'St. Paul',
                Company_State__c = 'MN',
                Alumni__c = otherContact.Id,
                RecordTypeId = recTypeId
        );
        insert favoritedBusiness;

        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Customer Community Login User' LIMIT 1];

        User ownerUser = new User(
                LanguageLocaleKey = 'en_US',
                TimeZoneSidKey = 'America/Chicago',
                LocaleSidKey = 'en_US',
                FirstName = 'Owner',
                LastName = 'FavoriteTestUser',
                Username = 'owner.favtest' + Crypto.getRandomInteger() + '@example.com.test',
                CommunityNickname = 'ownerfavtest' + Crypto.getRandomInteger(),
                EmailEncodingKey = 'UTF-8',
                Alias = 'ownft',
                Email = 'owner.favtest@example.com',
                ContactId = ownerContact.Id,
                ProfileId = standardProfile.Id
        );
        insert ownerUser;

        User otherUser = new User(
                LanguageLocaleKey = 'en_US',
                TimeZoneSidKey = 'America/Chicago',
                LocaleSidKey = 'en_US',
                FirstName = 'Other',
                LastName = 'FavoriteTestUser',
                Username = 'other.favtest' + Crypto.getRandomInteger() + '@example.com.test',
                CommunityNickname = 'otherfavtest' + Crypto.getRandomInteger(),
                EmailEncodingKey = 'UTF-8',
                Alias = 'othft',
                Email = 'other.favtest@example.com',
                ContactId = otherContact.Id,
                ProfileId = standardProfile.Id
        );
        insert otherUser;

        // PermissionSetAssignment is a "setup object" - inserting it in the same transaction
        // as the Account/Contact/Alumni_Directory__c/Professional_Directory__c DML above
        // throws MIXED_DML_OPERATION. Wrapping it in System.runAs (even as the running admin
        // user) isolates it into its own transaction context, which is the standard pattern
        // for this restriction in test methods.
        System.runAs(new User(Id = UserInfo.getUserId())) {
            PermissionSet favoritesPermSet = [SELECT Id FROM PermissionSet WHERE Name = 'Alumni_Favorites_User' LIMIT 1];
            insert new List<PermissionSetAssignment>{
                    new PermissionSetAssignment(AssigneeId = ownerUser.Id, PermissionSetId = favoritesPermSet.Id),
                    new PermissionSetAssignment(AssigneeId = otherUser.Id, PermissionSetId = favoritesPermSet.Id)
            };
        }
    }

    @isTest
    static void isFavorited_returnsFalse_whenNoFavoriteExists() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c target = queryFavoritedAlumniDirectory();

        Boolean result;
        System.runAs(ownerUser) {
            Test.startTest();
            result = AlumniFavoriteController.isFavorited(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            Test.stopTest();
        }

        System.assertEquals(false, result, 'Expected no favorite to exist yet.');
    }

    @isTest
    static void addFavorite_thenIsFavorited_returnsTrue_forAlumniDirectory() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c target = queryFavoritedAlumniDirectory();

        System.runAs(ownerUser) {
            Test.startTest();
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            Boolean result = AlumniFavoriteController.isFavorited(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            Test.stopTest();

            System.assertEquals(true, result, 'Expected favorite to exist after addFavorite.');
        }
    }

    @isTest
    static void addFavorite_thenIsFavorited_returnsTrue_forProfessionalDirectory() {
        User ownerUser = queryUser('owner.favtest');
        Professional_Directory__c target = queryFavoritedBusiness();

        System.runAs(ownerUser) {
            Test.startTest();
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_PROFESSIONAL_DIRECTORY,
                    target.Id
            );
            Boolean result = AlumniFavoriteController.isFavorited(
                    AlumniFavoriteController.TARGET_TYPE_PROFESSIONAL_DIRECTORY,
                    target.Id
            );
            Test.stopTest();

            System.assertEquals(true, result, 'Expected business favorite to exist after addFavorite.');
        }
    }

    @isTest
    static void addFavorite_isIdempotent_whenCalledTwice() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c target = queryFavoritedAlumniDirectory();

        System.runAs(ownerUser) {
            Test.startTest();
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            Test.stopTest();
        }

        Integer favoriteCount = [
                SELECT COUNT()
                FROM Alumni_Favorite__c
                WHERE Owner_Contact__c = :ownerUser.ContactId
                AND Target_Type__c = :AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY
                AND Target_Record_Id__c = :target.Id
        ];
        System.assertEquals(1, favoriteCount, 'Calling addFavorite twice should not create a duplicate row.');
    }

    @isTest
    static void removeFavorite_removesExistingFavorite() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c target = queryFavoritedAlumniDirectory();

        System.runAs(ownerUser) {
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );

            Test.startTest();
            AlumniFavoriteController.removeFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            Boolean result = AlumniFavoriteController.isFavorited(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            Test.stopTest();

            System.assertEquals(false, result, 'Expected favorite to be gone after removeFavorite.');
        }
    }

    @isTest
    static void removeFavorite_onNonExistentFavorite_isNoOp() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c target = queryFavoritedAlumniDirectory();

        System.runAs(ownerUser) {
            Test.startTest();
            // No addFavorite call first - removing something that was never favorited
            // should not throw.
            AlumniFavoriteController.removeFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
            Test.stopTest();
        }

        System.assert(true, 'removeFavorite on a non-existent favorite should not throw.');
    }

    @isTest
    static void getMyFavorites_isIsolatedPerUser() {
        User ownerUser = queryUser('owner.favtest');
        User otherUser = queryUser('other.favtest');
        Alumni_Directory__c target = queryFavoritedAlumniDirectory();

        System.runAs(ownerUser) {
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    target.Id
            );
        }

        List<AlumniFavoriteController.AlumniFavoriteDto> otherUsersFavorites;
        System.runAs(otherUser) {
            Test.startTest();
            otherUsersFavorites = AlumniFavoriteController.getMyFavorites();
            Test.stopTest();
        }

        System.assertEquals(
                0,
                otherUsersFavorites.size(),
                'A different user must never see another user\'s favorites.'
        );
    }

    @isTest
    static void getMyFavorites_resolvesDisplayFields_forBothTargetTypes() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c alumniTarget = queryFavoritedAlumniDirectory();
        Professional_Directory__c businessTarget = queryFavoritedBusiness();

        List<AlumniFavoriteController.AlumniFavoriteDto> favorites;
        System.runAs(ownerUser) {
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    alumniTarget.Id
            );
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_PROFESSIONAL_DIRECTORY,
                    businessTarget.Id
            );

            Test.startTest();
            favorites = AlumniFavoriteController.getMyFavorites();
            Test.stopTest();
        }

        System.assertEquals(2, favorites.size(), 'Expected both favorites to be returned.');

        Boolean foundAlumni = false;
        Boolean foundBusiness = false;
        for (AlumniFavoriteController.AlumniFavoriteDto dto : favorites) {
            System.assertEquals(false, dto.isOrphaned, 'Neither favorite should be orphaned.');
            if (dto.targetType == AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY) {
                foundAlumni = true;
                System.assertEquals('Favorited Alum', dto.title);
                System.assertEquals('2010', dto.subtitle);
            } else if (dto.targetType == AlumniFavoriteController.TARGET_TYPE_PROFESSIONAL_DIRECTORY) {
                foundBusiness = true;
                System.assertEquals('Favorited Business', dto.title);
                System.assertEquals('St. Paul, MN', dto.subtitle);
            }
        }
        System.assert(foundAlumni, 'Expected the alumni favorite to be present.');
        System.assert(foundBusiness, 'Expected the business favorite to be present.');
    }

    @isTest
    static void getMyFavorites_marksOrphanedFavorite_whenTargetDeleted() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c alumniTarget = queryFavoritedAlumniDirectory();

        System.runAs(ownerUser) {
            AlumniFavoriteController.addFavorite(
                    AlumniFavoriteController.TARGET_TYPE_ALUMNI_DIRECTORY,
                    alumniTarget.Id
            );
        }

        delete alumniTarget;

        List<AlumniFavoriteController.AlumniFavoriteDto> favorites;
        System.runAs(ownerUser) {
            Test.startTest();
            favorites = AlumniFavoriteController.getMyFavorites();
            Test.stopTest();
        }

        System.assertEquals(1, favorites.size(), 'Expected the favorite row to still be returned even though the target is gone.');
        System.assertEquals(true, favorites[0].isOrphaned, 'Expected the favorite to be marked orphaned once its target is deleted.');
    }

    @isTest
    static void addFavorite_throws_forUnsupportedTargetType() {
        User ownerUser = queryUser('owner.favtest');
        Alumni_Directory__c target = queryFavoritedAlumniDirectory();

        Boolean threw = false;
        System.runAs(ownerUser) {
            Test.startTest();
            try {
                AlumniFavoriteController.addFavorite('Not_A_Real_Type', target.Id);
            } catch (AuraHandledException caught) {
                threw = true;
            }
            Test.stopTest();
        }

        System.assert(threw, 'Expected addFavorite to reject an unsupported target type.');
    }

    // ─── Test data helpers ──────────────────────────────────────────────────

    private static User queryUser(String usernamePrefix) {
        return [
                SELECT Id, ContactId
                FROM User
                WHERE Username LIKE :(usernamePrefix + '%')
                LIMIT 1
        ];
    }

    private static Alumni_Directory__c queryFavoritedAlumniDirectory() {
        return [SELECT Id FROM Alumni_Directory__c WHERE Name = 'Favorited Alum' LIMIT 1];
    }

    private static Professional_Directory__c queryFavoritedBusiness() {
        return [SELECT Id FROM Professional_Directory__c WHERE Company_Name__c = 'Favorited Business' LIMIT 1];
    }
}
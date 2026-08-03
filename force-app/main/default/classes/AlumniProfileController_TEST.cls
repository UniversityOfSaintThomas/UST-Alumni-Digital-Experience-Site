/**
 * Test class for AlumniProfileController.
 * Reuses TestAlumniCommunityDataFactory to create linked Contact/User/
 * Alumni_Directory__c test data, since that factory already builds the
 * exact owner/non-owner relationship this feature needs to verify.
 */
@IsTest
private class AlumniProfileController_TEST {

    private static final String RT_ALUMNI_BUSINESS = 'Alumni_Business';

    // ─── Test Data Setup ─────────────────────────────────────────────────────

    @TestSetup
    static void makeData() {
        TestAlumniCommunityDataFactory.createTestDATA(2);

        // Populate the display fields the factory doesn't set.
        List<Alumni_Directory__c> directories = [
                SELECT Id, Contact__c FROM Alumni_Directory__c ORDER BY Name
        ];
        for (Alumni_Directory__c directory : directories) {
            directory.Nickname__c = 'Nick';
            directory.Student_Last_Name_Text__c = 'DifferentLastName';
            directory.City_State__c = 'St. Paul, MN';
            directory.St_Thomas_Degree_text__c = 'B.A.';
        }
        update directories;

        // Business Directory listings for the first alumni's Contact:
        // one Active (should be returned), one Pending (should not).
        Id rtId = Schema.SObjectType.Professional_Directory__c
                .getRecordTypeInfosByDeveloperName()
                .get(RT_ALUMNI_BUSINESS)
                .getRecordTypeId();

        insert new List<Professional_Directory__c>{
                new Professional_Directory__c(
                        RecordTypeId = rtId,
                        Alumni__c = directories[0].Contact__c,
                        Active_Display__c = 'Active',
                        Company_Name__c = 'Active Co'
                ),
                new Professional_Directory__c(
                        RecordTypeId = rtId,
                        Alumni__c = directories[0].Contact__c,
                        Active_Display__c = 'Pending',
                        Company_Name__c = 'Pending Co'
                )
        };
    }

    private static User getTestUser(Integer index) {
        return [SELECT Id, ContactId FROM User WHERE CommunityNickname = :('testUser' + index) LIMIT 1];
    }

    private static Alumni_Directory__c getDirectoryForUser(User u) {
        return [SELECT Id, Contact__c FROM Alumni_Directory__c WHERE Contact__c = :u.ContactId LIMIT 1];
    }

    // ─── getMyProfile ─────────────────────────────────────────────────────────

    @IsTest
    static void testGetMyProfile_positive_ownerSeesOwnRecordAndActiveBusinessListings() {
        User owner = getTestUser(1);

        AlumniProfileController.AlumniProfileDto dto;
        System.runAs(owner) {
            Test.startTest();
            dto = AlumniProfileController.getMyProfile();
            Test.stopTest();
        }

        System.assertEquals(true, dto.hasRecord, 'Owner should have a profile record');
        System.assertEquals(true, dto.canEdit, 'Owner should be able to edit their own record');
        System.assertEquals('Nick', dto.nickname);
        System.assertEquals(1, dto.businessDirectoryRecords.size(), 'Only the Active listing should be returned');
        System.assertEquals('Active Co', dto.businessDirectoryRecords[0].Company_Name__c);
    }

    @IsTest
    static void testGetMyProfile_negative_userWithNoContactReturnsHasRecordFalse() {
        User adminUser = [
                SELECT Id, ContactId
                FROM User
                WHERE Profile.Name = 'System Administrator' AND Name = 'ETL User'
                LIMIT 1
        ];

        AlumniProfileController.AlumniProfileDto dto;
        System.runAs(adminUser) {
            Test.startTest();
            dto = AlumniProfileController.getMyProfile();
            Test.stopTest();
        }

        System.assertEquals(false, dto.hasRecord, 'User with no linked Contact should not see a profile record');
        System.assertEquals(false, dto.canEdit);
        System.assertEquals(0, dto.businessDirectoryRecords.size());
    }

    // ─── saveMyProfile ──────────────────────────────────────────────────────────

    @IsTest
    static void testSaveMyProfile_positive_ownerCanUpdateOwnRecord() {
        User owner = getTestUser(1);
        Alumni_Directory__c ownRecord = getDirectoryForUser(owner);

        AlumniProfileController.AlumniProfileSaveInput input = new AlumniProfileController.AlumniProfileSaveInput();
        input.recordId = ownRecord.Id;
        input.nickname = 'UpdatedNick';
        input.cityState = 'Minneapolis, MN';
        input.occupationText = 'Updated Title';
        input.employerText = 'Updated Employer';

        AlumniProfileController.AlumniProfileDto dto;
        System.runAs(owner) {
            Test.startTest();
            dto = AlumniProfileController.saveMyProfile(input);
            Test.stopTest();
        }

        System.assertEquals('UpdatedNick', dto.nickname);
        Alumni_Directory__c persisted = [
                SELECT Nickname__c, City_State__c, Occupation_Text__c, Employer_Text__c
                FROM Alumni_Directory__c
                WHERE Id = :ownRecord.Id
        ];
        System.assertEquals('UpdatedNick', persisted.Nickname__c, 'Update should be persisted to the database');
        System.assertEquals('Minneapolis, MN', persisted.City_State__c);
    }

    @IsTest
    static void testSaveMyProfile_negative_nonOwnerCannotUpdateAnotherContactsRecord() {
        User owner = getTestUser(1);
        User otherUser = getTestUser(2);
        Alumni_Directory__c ownersRecord = getDirectoryForUser(owner);

        AlumniProfileController.AlumniProfileSaveInput input = new AlumniProfileController.AlumniProfileSaveInput();
        input.recordId = ownersRecord.Id;
        input.nickname = 'ShouldNotBeSaved';

        Boolean exceptionThrown = false;
        System.runAs(otherUser) {
            Test.startTest();
            try {
                AlumniProfileController.saveMyProfile(input);
                System.assert(false, 'Expected an AuraHandledException when a non-owner attempts to edit another Contact\'s record');
            } catch (AuraHandledException expected) {
                exceptionThrown = true;
            }
            Test.stopTest();
        }

        System.assertEquals(true, exceptionThrown);
        Alumni_Directory__c unchanged = [SELECT Nickname__c FROM Alumni_Directory__c WHERE Id = :ownersRecord.Id];
        System.assertNotEquals('ShouldNotBeSaved', unchanged.Nickname__c, 'Record must not be modified by a non-owner');
    }

    // ─── Isolation across multiple users ─────────────────────────────────────

    @IsTest
    static void testGetMyProfile_multipleUsersEachSeeOnlyOwnRecord() {
        User userOne = getTestUser(1);
        User userTwo = getTestUser(2);
        Alumni_Directory__c directoryOne = getDirectoryForUser(userOne);
        Alumni_Directory__c directoryTwo = getDirectoryForUser(userTwo);

        AlumniProfileController.AlumniProfileDto dtoOne;
        AlumniProfileController.AlumniProfileDto dtoTwo;

        Test.startTest();
        System.runAs(userOne) {
            dtoOne = AlumniProfileController.getMyProfile();
        }
        System.runAs(userTwo) {
            dtoTwo = AlumniProfileController.getMyProfile();
        }
        Test.stopTest();

        System.assertEquals(directoryOne.Id, dtoOne.recordId, 'User one should only see their own record');
        System.assertEquals(directoryTwo.Id, dtoTwo.recordId, 'User two should only see their own record');
        System.assertNotEquals(dtoOne.recordId, dtoTwo.recordId);
    }
}

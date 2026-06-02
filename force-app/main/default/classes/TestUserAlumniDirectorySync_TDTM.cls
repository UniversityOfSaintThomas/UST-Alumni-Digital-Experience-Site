/**
 * Created by dahl3702 on 7/17/2019.
 */

@IsTest
public class TestUserAlumniDirectorySync_TDTM {
    public static List<TestAlumniCommunityDataFactory.testDataIds> testIds { get; set; }

    @IsTest static void testDirectoryListing() {

        //Generate some Data
        testIds = TestAlumniCommunityDataFactory.createTestDATA(1);

        Alumni_Directory__c newAlumniDirectory = new Alumni_Directory__c(Contact__c = testIds[0].contactId);
        insert newAlumniDirectory;

        Contact testContact = [SELECT Id FROM Contact WHERE Id = :testIds[0].contactId];
        testContact.Alumni_Directory_Record__c = newAlumniDirectory.Id;
        update testContact;

        User testUser = [SELECT Id, Alumni_Directory__c, CompanyName, City, State, Country, Title FROM User WHERE Id = :testIds[0].userId];

        Test.startTest();

        User AdminUser = [SELECT Id, Name FROM User WHERE Profile.Name = 'System Administrator' AND Name = 'ETL User'][0];

        String usCountryValue = 'United States';
        if (TestAlumniCommunityDataFactory.doesPicklistContain(Schema.Interaction__c.Country__c, 'United States of America')) {
            usCountryValue = 'United States of America';
        }

        System.runAs(AdminUser) {

            //Don't change anything
            System.debug(testIds[0].userId);
            update testUser;
            System.debug(testUser.Alumni_Directory__c);

            Alumni_Directory__c testDirectory = [
                    SELECT Id, City_State__c, Contact_Country__c, Employer_Text__c, Occupation_Text__c
                    FROM Alumni_Directory__c
                    WHERE Id = :testUser.Alumni_Directory__c
            ];
            System.assertEquals(null, testDirectory.Employer_Text__c);

            //Change Employer
            testUser.CompanyName = 'Now This Ltd';
            update testUser;
            testDirectory = [
                    SELECT Id, City_State__c, Contact_Country__c, Employer_Text__c, Occupation_Text__c
                    FROM Alumni_Directory__c
                    WHERE Id = :testUser.Alumni_Directory__c
            ];
            System.assertEquals('Now This Ltd', testDirectory.Employer_Text__c);
            System.assertEquals(null, testDirectory.Occupation_Text__c);
            System.assertEquals('null, null', testDirectory.City_State__c);

            //Change Job Title
            testUser.Title = 'Superhero';
            update testUser;
            testDirectory = [
                    SELECT Id, City_State__c, Contact_Country__c, Employer_Text__c, Occupation_Text__c
                    FROM Alumni_Directory__c
                    WHERE Id = :testUser.Alumni_Directory__c
            ];
            System.assertEquals('Superhero', testDirectory.Occupation_Text__c);
            System.assertEquals('Now This Ltd', testDirectory.Employer_Text__c);
            System.assertEquals('null, null', testDirectory.City_State__c);

            testUser.City = 'TestVille';
            testUser.State = 'MT';
            testUser.Country = usCountryValue;
            update testUser;

            testDirectory = [
                    SELECT Id, City_State__c, Contact_Country__c, Employer_Text__c, Occupation_Text__c
                    FROM Alumni_Directory__c
                    WHERE Id = :testUser.Alumni_Directory__c
            ];
            System.assertEquals('Superhero', testDirectory.Occupation_Text__c);
            System.assertEquals('Now This Ltd', testDirectory.Employer_Text__c);
            System.assertEquals('TestVille, MT', testDirectory.City_State__c);
            System.assertEquals(usCountryValue, testDirectory.Contact_Country__c);

        }
        Test.stopTest();
    }
}
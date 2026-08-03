/**
 * Created by dahl3702 on 7/16/2019.
 */
@isTest
public class TestAlumniCommunityDataFactory {

    public class testDataIds {
        public Integer testNumber { get; set; }
        public Id contactId { get; set; }
        public Id userId { get; set; }
        public Id alumniDirectoryId { get; set; }
    }

    public static List<testDataIds> createTestDATA(Integer howMany) {

        Profile pr = [Select Id From Profile Where Name = 'Alumni Community User'][0];
        List<testDataIds> testDataIdsOut = new List<testDataIds>();
        User AdminUser = [SELECT Id, Name FROM User WHERE Profile.Name = 'System Administrator' AND Name = 'ETL User'][0];

        System.runAs(AdminUser) {
            /* Set up TDTM triggers for testing */

            // first retrieve default EDA trigger handlers
            List<hed.TDTM_Global_API.TdtmToken> tokens = hed.TDTM_Global_API.getTdtmConfig();

            // Create our trigger handler using the constructor
            tokens.add(new hed.TDTM_Global_API.TdtmToken('UserAlumniDirectorySync_TDTM', 'User', 'AfterInsert;AfterUpdate;AfterDelete;AfterUndelete', 2.00));

            // Pass trigger handler config to set method for this test run
            hed.TDTM_Global_API.setTdtmConfig(tokens);


            //Create array of available news categories
            List<String> newsCategories = new List<String>{
                    'Birth Announcements',
                    'Career News',
                    'In Memoriam',
                    'Marriages',
                    'Misc.'
            };
            Integer categoryCount = 0;

            //Loop through and create as many records as defined in parameter -- UP TO 9
            for (Integer xx = 1; xx <= howMany; xx++) {

                //Create account
                Account a = new Account(Name = 'Test Account Name ' + xx);
                insert a;

                //Create Contact
                Contact testContact = new Contact(
                        firstName = 'Hello' + xx,
                        lastName = 'Kitty' + xx,
                        middleName = 'T' + xx,
                        Previous_Last_Name__c = 'Dog' + xx,
                        Preferred_First_Name__c = 'D' + xx,
                        Preferred_Class_Year__c = '200' + xx,
                        MailingStreet = 'Pet Co. Ave.' + xx,
                        MailingCountryCode = 'US',
                        MailingCity = 'Snake City' + xx,
                        MailingStateCode = 'IL',
                        MailingPostalCode = '5541' + xx,
                        Employer__c = 'Dog Walker Inc. ' + xx,
                        Job_Title__c = 'Leash Tester ' + xx,
                        Title = 'Leash Tester ' + xx,
                        hed__Deceased__c = false,
                        Email = 'thad+helloKitty' + xx + '@valleyhill.net',
                        Primary_University_Relationship__c = 'ALND',
                        University_Banner_ID__c = '00000000' + xx,
                        Birthdate = Date.valueOf('1971-03-2' + xx),
                        AccountId = a.Id
                );
                insert testContact;

                //Create User
                User testUser = new User(
                        LanguageLocaleKey = 'en_US',
                        TimeZoneSidKey = 'America/Chicago',
                        LocaleSidKey = 'en_US',
                        FirstName = testContact.firstName,
                        LastName = testContact.lastName,
                        Username = testContact.Email,
                        CommunityNickname = 'testUser' + xx,
                        EmailEncodingKey = 'UTF-8',
                        Alias = 't' + xx,
                        Email = testContact.Email,
                        ContactId = testContact.Id,
                        CompanyName = 'Test Ltd ' + xx,
                        ProfileId = pr.Id
                );

                insert testUser;


                //Create AlumniDirectory
                Alumni_Directory__c testAlumniDirectory = new Alumni_Directory__c(
                        Name = testContact.Name,
                        First_Name_Text__c = testContact.firstName,
                        Last_Name_Text__c = testContact.lastName,
                        Contact__c = testContact.Id,
                        Employer_Text__c = testContact.Employer__c,
                        Occupation_Text__c = testContact.Title,
                        Class_Year_Text__c = testContact.Preferred_Class_Year__c
                );
                insert testAlumniDirectory;

                //Creat AlumniNews
                //Make sure categories are always within scope of size of category array
                if (xx > newsCategories.size() && categoryCount > newsCategories.size()) {
                    categoryCount = 0;
                }

                Alumni_News__c testAlumniNews = new Alumni_News__c(
                        Contact__c = testContact.Id,
                        Category__c = newsCategories[categoryCount],
                        Alumni_Directory__c = testAlumniDirectory.Id,
                        Alumni_News__c = 'This is the news ' + xx,
                        News_Source__c = 'source',
                        Image__c = '/image' + xx + '.jpg',
                        External_Link__c = 'https://google.com/' + xx,
                        Reviewed_for_Community_Display__c = true,
                        Public_Display__c = true,
                        News_Date__c = Date.valueOf('1989-08-1' + xx)
                );
                insert testAlumniNews;

                //Add to Wrapper Class
                testDataIds testIds = new testDataIds();
                testIds.testNumber = xx;
                testIds.ContactId = testContact.Id;
                testIds.alumniDirectoryId = testAlumniDirectory.Id;
                testIds.userId = testUser.Id;
                testDataIdsOut.add(testIds);
            }

        }
        return testDataIdsOut;
    }

    public static Boolean doesPicklistContain(Schema.sObjectField activeField, String valueToCheck) {
        Schema.DescribeFieldResult fieldDetail = activeField.getDescribe();
        List<Schema.PicklistEntry> picklistEntries = fieldDetail.getPicklistValues();
        for (Schema.PicklistEntry ple : picklistEntries) {
            if (ple.getValue().equals(valueToCheck)) {
                return true;
            }
        }
        return false;
    }

}
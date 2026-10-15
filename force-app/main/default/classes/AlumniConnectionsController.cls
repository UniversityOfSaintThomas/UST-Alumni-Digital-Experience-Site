/**
 * Read-only "connected profile" lookup for the Alumni Connections page - given a target
 * Contact Id (any alumnus, not just the viewer's own), returns the same limited
 * Alumni_Directory__c field set already exposed by AlumniProfileController, plus that
 * alumnus's public Alumni_News__c mentions and approved Professional_Directory__c business
 * listings, joined together in a single call for the connected-profile detail view.
 *
 * This is deliberately a separate class from AlumniProfileController, which owns "my own"
 * profile semantics and canEdit. This class never returns canEdit and never accepts writes -
 * it exists purely to render someone else's public-facing connections.
 *
 * HIGH RISK: this is the first place data from three previously-siloed single-purpose
 * controllers (AlumniProfileController, AlumniNewsListController,
 * AlumniBusinessDirectoryController) is joined for a THIRD PARTY. The privacy/approval gates
 * below are copied verbatim from those controllers' WHERE clauses - do not loosen them here.
 * - News: Reviewed_for_Community_Display__c = true AND Public_Display__c = true
 *   (see AlumniNewsListController.generateWhere)
 * - Business: RecordTypeId = Alumni_Business, Alumni__c != null,
 *   Company_Status__c = 'Approved', UST_Test_Contact__c = false
 *   (see AlumniBusinessDirectoryController.buildWhereClause)
 *
 * Runs without sharing for the same reason as AlumniProfileController - the community user
 * profile only has Read access to Alumni_Directory__c at the org-wide default level; there is
 * no ownership check needed here since every method is read-only and only exposes fields
 * already publicly surfaced by the existing single-purpose list views.
 */
public without sharing class AlumniConnectionsController {

    private static final String ALUMNI_BUSINESS_RT = 'Alumni_Business';
    private static final String BUSINESS_STATUS_APPROVED = 'Approved';

    @AuraEnabled(cacheable=true)
    public static ConnectedProfileDto getConnectedProfile(Id contactId) {
        try {
            ConnectedProfileDto dto = new ConnectedProfileDto();
            dto.newsItems = new List<Alumni_News__c>();
            dto.businessListings = new List<Professional_Directory__c>();

            if (contactId == null) {
                dto.hasProfile = false;
                return dto;
            }

            List<Alumni_Directory__c> directories = [
                    SELECT Id, Contact__c, First_Name_Text__c, Nickname__c,
                            Last_Name_Text__c, Student_Last_Name_Text__c,
                            Class_Year_Text__c, St_Thomas_Degree_text__c,
                            City_State__c, Occupation_Text__c, Employer_Text__c
                    FROM Alumni_Directory__c
                    WHERE Contact__c = :contactId
                    WITH USER_MODE
                    LIMIT 1
            ];

            if (directories.isEmpty()) {
                dto.hasProfile = false;
                return dto;
            }

            Alumni_Directory__c directory = directories[0];
            dto.hasProfile = true;
            dto.alumniDirectoryId = directory.Id;
            dto.firstNameText = directory.First_Name_Text__c;
            dto.nickname = directory.Nickname__c;
            dto.lastNameText = directory.Last_Name_Text__c;
            dto.studentLastNameText = directory.Student_Last_Name_Text__c;
            dto.classYearText = directory.Class_Year_Text__c;
            dto.stThomasDegreeText = directory.St_Thomas_Degree_text__c;
            dto.cityState = directory.City_State__c;
            dto.occupationText = directory.Occupation_Text__c;
            dto.employerText = directory.Employer_Text__c;
            dto.newsItems = getPublicNews(contactId);
            dto.businessListings = getApprovedBusinessListings(contactId);

            return dto;
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to load this alumni connection: ' + caught.getMessage());
        }
    }

    private static List<Alumni_News__c> getPublicNews(Id contactId) {
        return [
                SELECT Id, Category__c, Alumni_News__c, Details_Link__c, News_Date__c
                FROM Alumni_News__c
                WHERE Contact__c = :contactId
                AND Reviewed_for_Community_Display__c = true
                AND Public_Display__c = true
                WITH USER_MODE
                ORDER BY News_Date__c DESC
        ];
    }

    private static List<Professional_Directory__c> getApprovedBusinessListings(Id contactId) {
        Id recTypeId = Schema.SObjectType.Professional_Directory__c
                .getRecordTypeInfosByDeveloperName()
                .get(ALUMNI_BUSINESS_RT)?.getRecordTypeId();

        if (recTypeId == null) {
            return new List<Professional_Directory__c>();
        }

        return [
                SELECT Id, Company_Name__c, Title__c, Company_City__c,
                        Company_State__c, Company_Website__c
                FROM Professional_Directory__c
                WHERE Alumni__c = :contactId
                AND RecordTypeId = :recTypeId
                AND Company_Status__c = :BUSINESS_STATUS_APPROVED
                AND UST_Test_Contact__c = false
                WITH USER_MODE
                ORDER BY Company_Name__c NULLS LAST
        ];
    }

    public class ConnectedProfileDto {
        @AuraEnabled public Boolean hasProfile;
        @AuraEnabled public Id alumniDirectoryId;
        @AuraEnabled public String firstNameText;
        @AuraEnabled public String nickname;
        @AuraEnabled public String lastNameText;
        @AuraEnabled public String studentLastNameText;
        @AuraEnabled public String classYearText;
        @AuraEnabled public String stThomasDegreeText;
        @AuraEnabled public String cityState;
        @AuraEnabled public String occupationText;
        @AuraEnabled public String employerText;
        @AuraEnabled public List<Alumni_News__c> newsItems;
        @AuraEnabled public List<Professional_Directory__c> businessListings;
    }
}
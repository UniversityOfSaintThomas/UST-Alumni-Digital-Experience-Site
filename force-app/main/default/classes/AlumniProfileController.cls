/**
 * Returns the current community user's own Alumni Directory profile plus
 * their active Business (Professional) Directory listings, and allows the
 * user to update their own profile fields.
 *
 * Runs without sharing because the community user profile has only Read
 * access to Alumni_Directory__c at the org-wide default level
 * (externalSharingModel = Read); ownership is instead verified explicitly
 * in Apex before any update is permitted, mirroring the rationale
 * documented in AI-TOOLS-CONFIG.md - Experience Cloud Guest User Access.
 */
public without sharing class AlumniProfileController {

    private static final String ALUMNI_BUSINESS_RT = 'Alumni_Business';
    private static final String ACTIVE_DISPLAY_ACTIVE = 'Active';

    @AuraEnabled(cacheable=true)
    public static AlumniProfileDto getMyProfile() {
        try {
            Id contactId = resolveCurrentContactId();

            if (contactId == null) {
                return emptyDto();
            }

            List<Alumni_Directory__c> records = [
                    SELECT Id, Contact__c, First_Name_Text__c, Nickname__c,
                            Last_Name_Text__c, Student_Last_Name_Text__c,
                            Class_Year_Text__c, St_Thomas_Degree_text__c,
                            City_State__c, Occupation_Text__c, Employer_Text__c
                    FROM Alumni_Directory__c
                    WHERE Contact__c = :contactId
                    WITH SECURITY_ENFORCED
                    LIMIT 1
            ];

            if (records.isEmpty()) {
                return emptyDto();
            }

            return toDto(records[0], contactId);
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to load your alumni profile: ' + caught.getMessage());
        }
    }

    /**
     * Loads any alumnus's profile by their Alumni_Directory__c record Id, for
     * the read-only "view another member's profile" experience (e.g. from the
     * Alumni Directory/News lists). canEdit is still computed against the
     * viewing user's own Contact, so a viewer only gets edit rights when the
     * requested record happens to be their own.
     */
    @AuraEnabled(cacheable=true)
    public static AlumniProfileDto getProfileByRecordId(Id recordId) {
        try {
            if (recordId == null) {
                return emptyDto();
            }

            List<Alumni_Directory__c> records = [
                    SELECT Id, Contact__c, First_Name_Text__c, Nickname__c,
                            Last_Name_Text__c, Student_Last_Name_Text__c,
                            Class_Year_Text__c, St_Thomas_Degree_text__c,
                            City_State__c, Occupation_Text__c, Employer_Text__c
                    FROM Alumni_Directory__c
                    WHERE Id = :recordId
                    WITH SECURITY_ENFORCED
                    LIMIT 1
            ];

            if (records.isEmpty()) {
                return emptyDto();
            }

            return toDto(records[0], resolveCurrentContactId());
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to load this alumni profile: ' + caught.getMessage());
        }
    }

    private static AlumniProfileDto toDto(Alumni_Directory__c record, Id viewerContactId) {
        AlumniProfileDto dto = new AlumniProfileDto();
        dto.hasRecord = true;
        dto.canEdit = (viewerContactId != null && record.Contact__c == viewerContactId);
        dto.recordId = record.Id;
        dto.firstNameText = record.First_Name_Text__c;
        dto.nickname = record.Nickname__c;
        dto.lastNameText = record.Last_Name_Text__c;
        dto.studentLastNameText = record.Student_Last_Name_Text__c;
        dto.classYearText = record.Class_Year_Text__c;
        dto.stThomasDegreeText = record.St_Thomas_Degree_text__c;
        dto.cityState = record.City_State__c;
        dto.occupationText = record.Occupation_Text__c;
        dto.employerText = record.Employer_Text__c;
        dto.businessDirectoryRecords = getActiveBusinessDirectoryRecords(record.Contact__c);
        return dto;
    }

    private static AlumniProfileDto emptyDto() {
        AlumniProfileDto dto = new AlumniProfileDto();
        dto.hasRecord = false;
        dto.canEdit = false;
        dto.businessDirectoryRecords = new List<Professional_Directory__c>();
        return dto;
    }

    @AuraEnabled
    public static AlumniProfileDto saveMyProfile(AlumniProfileSaveInput input) {
        try {
            if (input == null || input.recordId == null) {
                throw new AuraHandledException('No profile record specified.');
            }

            Id contactId = resolveCurrentContactId();
            if (contactId == null) {
                throw new AuraHandledException('You are not permitted to edit this record.');
            }

            List<Alumni_Directory__c> records = [
                    SELECT Id, Contact__c
                    FROM Alumni_Directory__c
                    WHERE Id = :input.recordId
                    WITH SECURITY_ENFORCED
                    LIMIT 1
            ];

            if (records.isEmpty() || records[0].Contact__c != contactId) {
                throw new AuraHandledException('You are not permitted to edit this record.');
            }

            Alumni_Directory__c record = new Alumni_Directory__c(
                    Id = input.recordId,
                    First_Name_Text__c = input.firstNameText,
                    Nickname__c = input.nickname,
                    Last_Name_Text__c = input.lastNameText,
                    Student_Last_Name_Text__c = input.studentLastNameText,
                    Class_Year_Text__c = input.classYearText,
                    St_Thomas_Degree_text__c = input.stThomasDegreeText,
                    City_State__c = input.cityState,
                    Occupation_Text__c = input.occupationText,
                    Employer_Text__c = input.employerText
            );

            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Alumni_Directory__c>{ record });
            update decision.getRecords();

            return getMyProfile();
        } catch (AuraHandledException caught) {
            throw caught;
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to save your alumni profile: ' + caught.getMessage());
        }
    }

    private static Id resolveCurrentContactId() {
        List<User> users = [
                SELECT ContactId
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
        ];
        return (users.isEmpty()) ? null : users[0].ContactId;
    }

    private static List<Professional_Directory__c> getActiveBusinessDirectoryRecords(Id contactId) {
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
                AND Active_Display__c = :ACTIVE_DISPLAY_ACTIVE
                WITH SECURITY_ENFORCED
                ORDER BY Company_Name__c NULLS LAST
        ];
    }

    public class AlumniProfileDto {
        @AuraEnabled public Boolean hasRecord;
        @AuraEnabled public Boolean canEdit;
        @AuraEnabled public Id recordId;
        @AuraEnabled public String firstNameText;
        @AuraEnabled public String nickname;
        @AuraEnabled public String lastNameText;
        @AuraEnabled public String studentLastNameText;
        @AuraEnabled public String classYearText;
        @AuraEnabled public String stThomasDegreeText;
        @AuraEnabled public String cityState;
        @AuraEnabled public String occupationText;
        @AuraEnabled public String employerText;
        @AuraEnabled public List<Professional_Directory__c> businessDirectoryRecords;
    }

    public class AlumniProfileSaveInput {
        @AuraEnabled public Id recordId;
        @AuraEnabled public String firstNameText;
        @AuraEnabled public String nickname;
        @AuraEnabled public String lastNameText;
        @AuraEnabled public String studentLastNameText;
        @AuraEnabled public String classYearText;
        @AuraEnabled public String stThomasDegreeText;
        @AuraEnabled public String cityState;
        @AuraEnabled public String occupationText;
        @AuraEnabled public String employerText;
    }
}

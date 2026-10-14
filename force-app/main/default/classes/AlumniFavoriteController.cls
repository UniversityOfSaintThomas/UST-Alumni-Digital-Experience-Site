/**
 * Manages the current community user's personal favorites list - a one-directional,
 * private curation of Alumni_Directory__c (alumni profiles) and Professional_Directory__c
 * (business listings) records.
 *
 * Runs without sharing because Alumni_Favorite__c is Private and community users have no
 * declarative access to any row but their own; every method instead explicitly resolves
 * the running user's Contact and filters/writes only against Owner_Contact__c = that
 * Contact, mirroring the ownership-check rationale in AlumniProfileController.
 *
 * Target_Record_Id__c has no declarative lookup to the favorited record (it can point at
 * either Alumni_Directory__c or Professional_Directory__c depending on Target_Type__c), so
 * duplicate prevention is enforced here via an existence check before insert rather than a
 * database-level unique constraint (a formula-based unique key is not permitted by the
 * platform - see Alumni_Favorite__c.object-meta.xml).
 */
public without sharing class AlumniFavoriteController {

    public static final String TARGET_TYPE_ALUMNI_DIRECTORY = 'Alumni_Directory';
    public static final String TARGET_TYPE_PROFESSIONAL_DIRECTORY = 'Professional_Directory';

    @AuraEnabled(cacheable=true)
    public static Boolean isFavorited(String targetType, Id targetRecordId) {
        try {
            Id contactId = resolveCurrentContactId();
            if (contactId == null || String.isBlank(targetType) || targetRecordId == null) {
                return false;
            }

            List<Alumni_Favorite__c> existing = [
                    SELECT Id
                    FROM Alumni_Favorite__c
                    WHERE Owner_Contact__c = :contactId
                    AND Target_Type__c = :targetType
                    AND Target_Record_Id__c = :targetRecordId
                    WITH USER_MODE
                    LIMIT 1
            ];

            return !existing.isEmpty();
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to check favorite status: ' + caught.getMessage());
        }
    }

    @AuraEnabled
    public static void addFavorite(String targetType, Id targetRecordId) {
        try {
            Id contactId = resolveCurrentContactId();
            if (contactId == null) {
                throw new AuraHandledException('You must be logged in to favorite a record.');
            }
            validateTargetType(targetType);
            if (targetRecordId == null) {
                throw new AuraHandledException('No record specified to favorite.');
            }

            List<Alumni_Favorite__c> existing = [
                    SELECT Id
                    FROM Alumni_Favorite__c
                    WHERE Owner_Contact__c = :contactId
                    AND Target_Type__c = :targetType
                    AND Target_Record_Id__c = :targetRecordId
                    WITH USER_MODE
                    LIMIT 1
            ];

            if (!existing.isEmpty()) {
                return;
            }

            Alumni_Favorite__c favorite = new Alumni_Favorite__c(
                    Owner_Contact__c = contactId,
                    Target_Type__c = targetType,
                    Target_Record_Id__c = targetRecordId
            );

            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<Alumni_Favorite__c>{ favorite });
            insert decision.getRecords();
        } catch (AuraHandledException caught) {
            throw caught;
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to add favorite: ' + caught.getMessage());
        }
    }

    @AuraEnabled
    public static void removeFavorite(String targetType, Id targetRecordId) {
        try {
            Id contactId = resolveCurrentContactId();
            if (contactId == null || String.isBlank(targetType) || targetRecordId == null) {
                return;
            }

            List<Alumni_Favorite__c> existing = [
                    SELECT Id
                    FROM Alumni_Favorite__c
                    WHERE Owner_Contact__c = :contactId
                    AND Target_Type__c = :targetType
                    AND Target_Record_Id__c = :targetRecordId
                    WITH USER_MODE
            ];

            if (existing.isEmpty()) {
                return;
            }

            delete as user existing;
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to remove favorite: ' + caught.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<AlumniFavoriteDto> getMyFavorites() {
        try {
            Id contactId = resolveCurrentContactId();
            if (contactId == null) {
                return new List<AlumniFavoriteDto>();
            }

            List<Alumni_Favorite__c> favorites = [
                    SELECT Id, Target_Type__c, Target_Record_Id__c
                    FROM Alumni_Favorite__c
                    WHERE Owner_Contact__c = :contactId
                    WITH USER_MODE
                    ORDER BY CreatedDate DESC
            ];

            return toDtos(favorites);
        } catch (Exception caught) {
            throw new AuraHandledException('Unable to load your favorites: ' + caught.getMessage());
        }
    }

    private static List<AlumniFavoriteDto> toDtos(List<Alumni_Favorite__c> favorites) {
        List<AlumniFavoriteDto> dtos = new List<AlumniFavoriteDto>();
        if (favorites.isEmpty()) {
            return dtos;
        }

        Set<Id> alumniDirectoryIds = new Set<Id>();
        Set<Id> professionalDirectoryIds = new Set<Id>();

        for (Alumni_Favorite__c favorite : favorites) {
            if (favorite.Target_Type__c == TARGET_TYPE_ALUMNI_DIRECTORY) {
                alumniDirectoryIds.add(favorite.Target_Record_Id__c);
            } else if (favorite.Target_Type__c == TARGET_TYPE_PROFESSIONAL_DIRECTORY) {
                professionalDirectoryIds.add(favorite.Target_Record_Id__c);
            }
        }

        Map<Id, Alumni_Directory__c> alumniDirectoryById = new Map<Id, Alumni_Directory__c>(
                [
                        SELECT Id, Name, First_Name_Text__c, Last_Name_Text__c, Class_Year_Text__c
                        FROM Alumni_Directory__c
                        WHERE Id IN :alumniDirectoryIds
                        WITH USER_MODE
                ]
        );

        Map<Id, Professional_Directory__c> professionalDirectoryById = new Map<Id, Professional_Directory__c>(
                [
                        SELECT Id, Company_Name__c, Company_City__c, Company_State__c
                        FROM Professional_Directory__c
                        WHERE Id IN :professionalDirectoryIds
                        WITH USER_MODE
                ]
        );

        for (Alumni_Favorite__c favorite : favorites) {
            AlumniFavoriteDto dto = new AlumniFavoriteDto();
            dto.favoriteId = favorite.Id;
            dto.targetType = favorite.Target_Type__c;
            dto.targetRecordId = favorite.Target_Record_Id__c;

            if (favorite.Target_Type__c == TARGET_TYPE_ALUMNI_DIRECTORY) {
                Alumni_Directory__c alumniDirectory = alumniDirectoryById.get(favorite.Target_Record_Id__c);
                if (alumniDirectory != null) {
                    dto.isOrphaned = false;
                    dto.title = String.isNotBlank(alumniDirectory.Name)
                            ? alumniDirectory.Name
                            : (alumniDirectory.First_Name_Text__c + ' ' + alumniDirectory.Last_Name_Text__c).trim();
                    dto.subtitle = alumniDirectory.Class_Year_Text__c;
                } else {
                    dto.isOrphaned = true;
                }
            } else if (favorite.Target_Type__c == TARGET_TYPE_PROFESSIONAL_DIRECTORY) {
                Professional_Directory__c professionalDirectory = professionalDirectoryById.get(favorite.Target_Record_Id__c);
                if (professionalDirectory != null) {
                    dto.isOrphaned = false;
                    dto.title = professionalDirectory.Company_Name__c;
                    dto.subtitle = String.join(
                            new List<String>{ professionalDirectory.Company_City__c, professionalDirectory.Company_State__c },
                            ', '
                    );
                } else {
                    dto.isOrphaned = true;
                }
            } else {
                dto.isOrphaned = true;
            }

            dtos.add(dto);
        }

        return dtos;
    }

    private static void validateTargetType(String targetType) {
        if (targetType != TARGET_TYPE_ALUMNI_DIRECTORY && targetType != TARGET_TYPE_PROFESSIONAL_DIRECTORY) {
            throw new AuraHandledException('Unsupported favorite type: ' + targetType);
        }
    }

    private static Id resolveCurrentContactId() {
        List<User> users = [
                SELECT ContactId
                FROM User
                WHERE Id = :UserInfo.getUserId()
                WITH SYSTEM_MODE
                LIMIT 1
        ];
        return (users.isEmpty()) ? null : users[0].ContactId;
    }

    public class AlumniFavoriteDto {
        @AuraEnabled public Id favoriteId;
        @AuraEnabled public String targetType;
        @AuraEnabled public String targetRecordId;
        @AuraEnabled public String title;
        @AuraEnabled public String subtitle;
        @AuraEnabled public Boolean isOrphaned;
    }
}

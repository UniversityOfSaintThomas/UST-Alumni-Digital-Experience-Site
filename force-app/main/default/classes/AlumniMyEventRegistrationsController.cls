/**
 * Created by nguy0092 on 7/31/2026.
 *
 * Returns the current Experience Cloud user's current and future Summit Event
 * registrations (Registered or Confirmed status), sorted by Event Instance
 * start date ascending, for the Alumni My Event Registrations widget.
 */
public without sharing class AlumniMyEventRegistrationsController {

    private static final Id recordTypeId = Schema.SObjectType.summit__Summit_Events__c.getRecordTypeInfosByDeveloperName().get('University_Advancement').getRecordTypeId();
    private static final Set<String> ACTIVE_REGISTRATION_STATUSES = new Set<String>{
            'Registered',
            'Confirmed'
    };

    @AuraEnabled(Cacheable=true)
    public static List<EventRegistration> getCurrentAndFutureRegistrations(Id contactId) {
        System.debug('Fetching current and future registrations for contactId: ' + contactId);
        List<EventRegistration> results = new List<EventRegistration>();

        if (contactId == null) {
            return results;
        }

        List<summit__Summit_Events_Registration__c> registrations = [
                SELECT Id,
                        summit__Event__r.summit__Event_Name__c,
                        summit__Event__r.summit__Event_description__c,
                        summit__Event__r.summit__Event_Short_Listing_Description__c,
                        summit__Event_Instance__r.summit__Instance_Start_Date__c,
                        summit__Event_Instance__r.summit__Instance_Start_Time__c,
                        summit__Event_Instance__r.summit__Instance_End_Date__c,
                        summit__Event_Instance__r.summit__Instance_End_Time__c,
                        summit__Event_Instance__r.summit__Instance_Time_Zone__c
                FROM summit__Summit_Events_Registration__c
                WHERE summit__Contact__c = :contactId
                AND summit__Event__r.RecordTypeId = :recordTypeId
                AND summit__Status__c IN :ACTIVE_REGISTRATION_STATUSES
                AND summit__Event_Instance__r.summit__Instance_Start_Date__c >= TODAY
                ORDER BY summit__Event_Instance__r.summit__Instance_Start_Date__c ASC
        ];

        for (summit__Summit_Events_Registration__c registration : registrations) {
            results.add(new EventRegistration(registration));
        }

        System.debug('Event registrations: ' + results);

        return results;
    }

    public class EventRegistration {
        @AuraEnabled public Id registrationId;
        @AuraEnabled public String eventTitle;
        @AuraEnabled public String description;
        @AuraEnabled public Date startDate;
        @AuraEnabled public String startTime;
        @AuraEnabled public String eventSchedule;

        public EventRegistration(summit__Summit_Events_Registration__c registration) {
            this.registrationId = registration.Id;
            this.eventTitle = registration.summit__Event__r?.summit__Event_Name__c;
            this.description = String.isNotBlank(registration.summit__Event__r?.summit__Event_Short_Listing_Description__c)
                    ? registration.summit__Event__r?.summit__Event_Short_Listing_Description__c
                    : registration.summit__Event__r?.summit__Event_description__c;
            this.startDate = registration.summit__Event_Instance__r?.summit__Instance_Start_Date__c;
            this.startTime = formatInstanceTime(
                    registration.summit__Event_Instance__r?.summit__Instance_Start_Date__c,
                    registration.summit__Event_Instance__r?.summit__Instance_Start_Time__c,
                    registration.summit__Event_Instance__r?.summit__Instance_Time_Zone__c
            );
            this.eventSchedule = buildEventSchedule(registration.summit__Event_Instance__r);
        }
    }

    private static String formatInstanceTime(Date instanceDate, Time instanceTime, String timeZoneName) {
        if (instanceDate == null || instanceTime == null) {
            return null;
        }

        Datetime instanceDateTime = Datetime.newInstance(instanceDate, instanceTime);
        String timeZoneId = extractTimeZoneId(timeZoneName);
        if (String.isNotBlank(timeZoneId)) {
            try {
                return instanceDateTime.format('h:mm a zzz', timeZoneId);
            } catch (Exception e) {
                // Falls through to the org default timezone below if the stored
                // zone name/ID cannot be resolved by Datetime.format().
            }
        }
        return instanceDateTime.format('h:mm a zzz');
    }

    private static String buildEventSchedule(summit__Summit_Events_Instance__c instance) {
        if (instance == null) {
            return null;
        }

        String timeZoneName = instance.summit__Instance_Time_Zone__c;

        String startPortion = formatInstanceDateTime(
                instance.summit__Instance_Start_Date__c,
                instance.summit__Instance_Start_Time__c,
                timeZoneName
        );
        String endPortion = formatInstanceDateTime(
                instance.summit__Instance_End_Date__c,
                instance.summit__Instance_End_Time__c,
                timeZoneName
        );

        if (startPortion == null) {
            return null;
        }
        if (endPortion == null) {
            return startPortion;
        }
        return startPortion + ' - ' + endPortion;
    }

    private static String extractTimeZoneId(String rawTimeZoneValue) {
        if (String.isBlank(rawTimeZoneValue)) {
            return null;
        }
        // Summit Events stores this picklist as a display label with the IANA
        // zone ID in parentheses, e.g. "Central Daylight Time (America/Chicago)".
        Matcher zoneIdMatcher = Pattern.compile('\\(([^)]+)\\)').matcher(rawTimeZoneValue);
        if (zoneIdMatcher.find()) {
            return zoneIdMatcher.group(1).trim();
        }
        return rawTimeZoneValue.trim();
    }

    private static String formatInstanceDateTime(Date instanceDate, Time instanceTime, String timeZoneName) {
        if (instanceDate == null) {
            return null;
        }

        Time effectiveTime = (instanceTime != null) ? instanceTime : Time.newInstance(0, 0, 0, 0);
        Datetime instanceDateTime = Datetime.newInstance(instanceDate, effectiveTime);

        String timeZoneId = extractTimeZoneId(timeZoneName);
        if (String.isNotBlank(timeZoneId)) {
            try {
                return instanceDateTime.format('EEEE, MMMM d, yyyy, h:mm a zzz', timeZoneId);
            } catch (Exception e) {
                // Falls through to the org default timezone below if the stored
                // zone name/ID cannot be resolved by Datetime.format().
            }
        }
        return instanceDateTime.format('EEEE, MMMM d, yyyy, h:mm a zzz');
    }
}

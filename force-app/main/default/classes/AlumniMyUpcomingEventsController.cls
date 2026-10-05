/**
 * Created by nguy0092 on 10/1/2026.
 */

public without sharing class AlumniMyUpcomingEventsController {
    private static final Id recordTypeId = Schema.SObjectType.summit__Summit_Events__c.getRecordTypeInfosByDeveloperName().get('University_Advancement').getRecordTypeId();

    @AuraEnabled(cacheable=true)
    public static List<UpcomingEvent> getFilteredUpcomingEvents(Id contactId) {
        List<UpcomingEvent> results = new List<UpcomingEvent>();

        List<Alumni_Directory__c> alumniDirectoryRecord = [
                SELECT Id,
                        Contact__c,
                        Academic_Major_s__c,
                        Athletic_Affiliation_s__c,
                        Class_Year__c,
                        College__c,
                        Content_Sender_Keys__c,
                        Degree_Level_s__c,
                        Event_Location_Type_s__c,
                        Geo_Locations__c,
                        St_Thomas_Connection__c,
                        Volunteer_Status__c
                FROM Alumni_Directory__c
                WHERE Contact__c = :contactId
                LIMIT 1
        ];

        if (alumniDirectoryRecord.isEmpty()) {
            return results;
        }

        List<summit__Summit_Events_Instance__c> eventInstances = [
                SELECT Id,
                        summit__Event__c,
                        summit__Event__r.summit__Event_Name__c,
                        summit__Event__r.summit__Start_Date__c,
                        summit__Event__r.summit__Event_description__c,
                        summit__Event__r.summit__Event_Short_Listing_Description__c,
                        summit__Event__r.summit__Location_Title__c,
                        summit__Location_Title_Override__c,
                        summit__Event__r.Academic_Major_s__c,
                        summit__Event__r.Athletic_Affiliation_s__c,
                        summit__Event__r.Class_Year__c,
                        summit__Event__r.College__c,
                        summit__Event__r.Content_Sender_Keys__c,
                        summit__Event__r.Degree_Level_s__c,
                        summit__Event__r.Event_Location_Type_s__c,
                        summit__Event__r.Geo_Locations__c,
                        summit__Event__r.St_Thomas_Connection__c,
                        summit__Event__r.Volunteer_Status__c,
                        summit__Instance_Start_Date__c,
                        summit__Instance_Start_Time__c,
                        summit__Instance_End_Date__c,
                        summit__Instance_End_Time__c,
                        summit__Instance_Time_Zone__c,
                        summit__Registration_Link__c
                FROM summit__Summit_Events_Instance__c
                WHERE summit__Event__r.RecordTypeId = :recordTypeId
                AND summit__Active_Status__c = 'Active'
                AND summit__Open_Registration__c = TRUE
                AND summit__Private_Instance__c = FALSE
                AND summit__Instance_Start_Date__c >= TODAY
                ORDER BY summit__Instance_Start_Date__c ASC
        ];

        Alumni_Directory__c alumni = alumniDirectoryRecord[0];

        Map<Id, UpcomingEvent> upcomingEventsByEventId = new Map<Id, UpcomingEvent>();
        List<Id> orderedEventIds = new List<Id>();

        for (summit__Summit_Events_Instance__c instance : eventInstances) {
            if (!matchesAnyFilter(alumni, instance)) {
                continue;
            }

            Id eventId = instance.summit__Event__c;
            UpcomingEvent upcomingEvent = upcomingEventsByEventId.get(eventId);
            if (upcomingEvent == null) {
                upcomingEvent = new UpcomingEvent(instance);
                upcomingEventsByEventId.put(eventId, upcomingEvent);
                orderedEventIds.add(eventId);
            }
            upcomingEvent.instances.add(new UpcomingEventInstance(instance, contactId));
        }

        for (Id eventId : orderedEventIds) {
            results.add(upcomingEventsByEventId.get(eventId));
        }

        System.debug('Upcoming events: ' + results);

        return results;
    }

    public class UpcomingEvent {
        @AuraEnabled public Id eventId;
        @AuraEnabled public String eventTitle;
        @AuraEnabled public String description;
        @AuraEnabled public String locationTitle;
        @AuraEnabled public List<UpcomingEventInstance> instances = new List<UpcomingEventInstance>();

        public UpcomingEvent(summit__Summit_Events_Instance__c instance) {
            this.eventId = instance.summit__Event__c;
            this.eventTitle = instance.summit__Event__r?.summit__Event_Name__c;
            this.description = String.isNotBlank(instance.summit__Event__r?.summit__Event_Short_Listing_Description__c)
                    ? instance.summit__Event__r?.summit__Event_Short_Listing_Description__c
                    : instance.summit__Event__r?.summit__Event_description__c;
            this.locationTitle = String.isNotBlank(instance?.summit__Location_Title_Override__c)
                    ? instance?.summit__Location_Title_Override__c
                    : instance.summit__Event__r?.summit__Location_Title__c;
        }
    }

    public class UpcomingEventInstance {
        @AuraEnabled public Id instanceId;
        @AuraEnabled public Date startDate;
        @AuraEnabled public String startTime;
        @AuraEnabled public String eventSchedule;
        @AuraEnabled public String registrationLink;
        @AuraEnabled public Boolean registeredStatus;

        public UpcomingEventInstance(summit__Summit_Events_Instance__c instance,  Id contactId) {
            this.instanceId = instance.Id;
            this.startDate = instance?.summit__Instance_Start_Date__c;
            this.startTime = formatInstanceTime(
                    instance?.summit__Instance_Start_Date__c,
                    instance?.summit__Instance_Start_Time__c,
                    instance?.summit__Instance_Time_Zone__c
            );
            this.eventSchedule = buildEventSchedule(instance);
            this.registrationLink = extractHrefUrl(instance.summit__Registration_Link__c);
            this.registeredStatus = getregisteredStatus(instance.Id, contactId);
        }
    }

    /**
     * summit__Registration_Link__c is a formula field that returns a ready-made
     * HTML anchor tag (e.g. '<a href="https://...">Register</a>'). The LWC template
     * binds registrationLink to a native <a href> element, so pull just the URL
     * out of the formula's HTML rather than passing the HTML through as-is.
     *  @param registrationLinkHtml The HTML anchor tag from the formula field
     *  @return The URL extracted from the HTML anchor tag
     */
    private static String extractHrefUrl(String registrationLinkHtml) {
        if (String.isBlank(registrationLinkHtml)) {
            return null;
        }

        Matcher hrefMatcher = Pattern.compile('href\\s*=\\s*"([^"]*)"').matcher(registrationLinkHtml);
        if (hrefMatcher.find()) {
            return hrefMatcher.group(1);
        }

        Matcher hrefMatcherSingleQuote = Pattern.compile('href\\s*=\\s*\'([^\']*)\'').matcher(registrationLinkHtml);
        if (hrefMatcherSingleQuote.find()) {
            return hrefMatcherSingleQuote.group(1);
        }

        // Fall back to treating the value as a plain URL if no href attribute is found.
        return registrationLinkHtml;
    }

    private static Boolean getregisteredStatus(Id eventInstanceId, Id contactId) {
        final Set<String> ACTIVE_REGISTRATION_STATUSES = new Set<String>{
                'Registered',
                'Confirmed'
        };

        List<summit__Summit_Events_Registration__c> registrations = [
                SELECT Id
                FROM summit__Summit_Events_Registration__c
                WHERE summit__Contact__c = :contactId
                AND summit__Status__c IN :ACTIVE_REGISTRATION_STATUSES
                AND summit__Event_Instance__r.Id = :eventInstanceId
                LIMIT 1
        ];

        return !registrations.isEmpty();
    }

    /**
     * Returns true if the alumni's data qualifies them for the event's filter criteria.
     * @param alumni Alumni Directory record
     * @param instance Summit Event Instance record
     * @return true if the alumnus qualifies for the event's filter criteria
     * For each dimension:
     *   - If the event's filter field is blank, every alumnus qualifies for that dimension.
     *   - If the event's filter field has values, the alumnus's corresponding
     *     Alumni_Directory__c field must contain at least one matching value (OR within dimension).
     * The alumnus must qualify for ALL non-blank filter dimensions (AND across dimensions).
     */
    private static Boolean matchesAnyFilter(Alumni_Directory__c alumni, summit__Summit_Events_Instance__c instance) {
        summit__Summit_Events__c event = instance.summit__Event__r;

        return dimensionMatches(event.Academic_Major_s__c, alumni.Academic_Major_s__c)
                && dimensionMatches(event.Athletic_Affiliation_s__c, alumni.Athletic_Affiliation_s__c)
                && dimensionMatches(event.Class_Year__c, alumni.Class_Year__c)
                && dimensionMatches(event.College__c, alumni.College__c)
                && dimensionMatches(event.Content_Sender_Keys__c, alumni.Content_Sender_Keys__c)
                && dimensionMatches(event.Degree_Level_s__c, alumni.Degree_Level_s__c)
                && dimensionMatches(event.Event_Location_Type_s__c, alumni.Event_Location_Type_s__c)
                && dimensionMatches(event.Geo_Locations__c, alumni.Geo_Locations__c)
                && dimensionMatches(event.St_Thomas_Connection__c, alumni.St_Thomas_Connection__c)
                && dimensionMatches(event.Volunteer_Status__c, alumni.Volunteer_Status__c);
    }

    /**
     * Checks one filter dimension: if the event has no filter values for this dimension,
     * every alumnus passes. If the event has filter values, the alumnus must have at least
     * one value in common with the event's filter (OR logic within the dimension).
     *
     * @param eventValue  Semicolon-delimited filter values from the event record (may be null)
     * @param alumniValue Semicolon-delimited values from the alumni record (may be null)
     * @return true if the alumnus qualifies for this filter dimension
     */
    private static Boolean dimensionMatches(String eventValue, String alumniValue) {
        if (String.isBlank(eventValue)) {
            return true; // No filter on this dimension - all alumni qualify
        }
        if (String.isBlank(alumniValue)) {
            return false;
        }

        Set<String> alumniValues = new Set<String>(alumniValue.split(';'));
        for (String value : eventValue.split(';')) {
            if (alumniValues.contains(value.trim())) {
                return true;
            }
        }

        return false;
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

    private static String formatInstanceTime(Date instanceDate, Time instanceTime, String timeZoneName) {
        if (instanceDate == null || instanceTime == null) {
            return null;
        }

        String timeZoneId = extractTimeZoneId(timeZoneName);
        Datetime instanceDateTime = buildZonedDatetime(instanceDate, instanceTime, timeZoneId);

        if (String.isNotBlank(timeZoneId)) {
            try {
                return instanceDateTime.format('h:mm a zzz', timeZoneId);
            } catch (Exception e) {
                // Falls through if the zone ID can't be resolved by format().
            }
        }
        return instanceDateTime.format('h:mm a zzz');
    }

    private static String formatInstanceDateTime(Date instanceDate, Time instanceTime, String timeZoneName) {
        if (instanceDate == null) {
            return null;
        }

        Time effectiveTime = (instanceTime != null) ? instanceTime : Time.newInstance(0, 0, 0, 0);
        String timeZoneId = extractTimeZoneId(timeZoneName);
        Datetime instanceDateTime = buildZonedDatetime(instanceDate, effectiveTime, timeZoneId);

        if (String.isNotBlank(timeZoneId)) {
            try {
                return instanceDateTime.format('EEEE, MMMM d, yyyy, h:mm a zzz', timeZoneId);
            } catch (Exception e) {
                // Falls through if the zone ID can't be resolved by format().
            }
        }
        return instanceDateTime.format('EEEE, MMMM d, yyyy, h:mm a zzz');
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

    /**
     * Builds the correct Datetime instant for a wall-clock date/time that is
     * expressed in the given IANA timezone (not the org/user default timezone).
     * @param instanceDate  Semicolon-delimited filter values from the event record (may be null)
     * @param instanceTime Semicolon-delimited values from the alumni record (may be null)
     * @param timeZoneId Semicolon-delimited values from the alumni record (may be null)
     * @return Datetime for timezone
     */
    private static Datetime buildZonedDatetime(Date instanceDate, Time instanceTime, String timeZoneId) {
        if (String.isBlank(timeZoneId)) {
            return Datetime.newInstance(instanceDate, instanceTime);
        }
        TimeZone tz = TimeZone.getTimeZone(timeZoneId);
        // First guess the instant as if the wall-clock time were UTC, then
        // subtract that zone's offset (at this date) to get the true instant.
        Datetime utcGuess = Datetime.newInstanceGmt(instanceDate, instanceTime);
        Integer offsetMillis = tz.getOffset(utcGuess);
        return utcGuess.addSeconds(-offsetMillis / 1000);
    }

}
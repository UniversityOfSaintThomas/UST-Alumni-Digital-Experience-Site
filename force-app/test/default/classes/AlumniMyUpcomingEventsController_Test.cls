/**
 * Unit tests for AlumniMyUpcomingEventsController.
 */
@isTest
private class AlumniMyUpcomingEventsController_Test {

    private static Id universityAdvancementRecordTypeId() {
        return Schema.SObjectType.summit__Summit_Events__c.getRecordTypeInfosByDeveloperName().get('University_Advancement').getRecordTypeId();
    }

    private static Contact createContact() {
        Contact c = new Contact(LastName = 'Tommie');
        insert c;
        return c;
    }

    private static Alumni_Directory__c createAlumniDirectory(Id contactId) {
        return createAlumniDirectory(contactId, null, null);
    }

    private static Alumni_Directory__c createAlumniDirectory(Id contactId, String classYear, String academicMajors) {
        Alumni_Directory__c alumni = new Alumni_Directory__c(
                Contact__c = contactId,
                Class_Year__c = classYear,
                Academic_Major_s__c = academicMajors
        );
        insert alumni;
        return alumni;
    }

    private static summit__Summit_Events__c createEvent(String name, String description) {
        return createEvent(name, description, null, null, null, null);
    }

    private static summit__Summit_Events__c createEvent(
            String name,
            String description,
            String shortDescription,
            String locationTitle,
            String classYearFilter,
            String academicMajorsFilter
    ) {
        summit__Summit_Events__c evt = new summit__Summit_Events__c(
                Name = name,
                RecordTypeId = universityAdvancementRecordTypeId(),
                summit__Event_Name__c = name,
                summit__Event_description__c = description,
                summit__Event_Short_Listing_Description__c = shortDescription,
                summit__Location_Title__c = locationTitle,
                Class_Year__c = classYearFilter,
                Academic_Major_s__c = academicMajorsFilter
        );
        insert evt;
        return evt;
    }

    private static summit__Summit_Events_Instance__c createInstance(Id eventId, Date startDate) {
        return createInstance(eventId, startDate, startDate, null, null, null, null, null);
    }

    private static summit__Summit_Events_Instance__c createInstance(
            Id eventId,
            Date startDate,
            Date endDate,
            Time startTime,
            Time endTime,
            String timeZone,
            String locationTitleOverride,
            Boolean isPrivate
    ) {
        summit__Summit_Events_Instance__c instance = new summit__Summit_Events_Instance__c(
                summit__Event__c = eventId,
                summit__Instance_Start_Date__c = startDate,
                summit__Instance_End_Date__c = endDate != null ? endDate : startDate,
                summit__Instance_Start_Time__c = startTime,
                summit__Instance_End_Time__c = endTime,
                summit__Instance_Time_Zone__c = timeZone,
                summit__Location_Title_Override__c = locationTitleOverride,
                summit__Active_Status__c = 'Active',
                summit__Private_Instance__c = isPrivate != null ? isPrivate : false,
                summit__Capacity__c = 100
        );
        insert instance;
        return instance;
    }

    private static summit__Summit_Events_Registration__c createRegistration(Id contactId, Id eventId, Id instanceId, String status) {
        summit__Summit_Events_Registration__c registration = new summit__Summit_Events_Registration__c(
                summit__Contact__c = contactId,
                summit__Event__c = eventId,
                summit__Event_Instance__c = instanceId,
                summit__Status__c = status
        );
        insert registration;
        return registration;
    }

    @isTest
    static void returnsEmptyListWhenNoAlumniDirectoryRecord() {
        Contact c = createContact();
        // No Alumni_Directory__c record created for this contact.

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'No alumni directory record should yield an empty list');
    }

    @isTest
    static void returnsUnfilteredEventWhenEventHasNoFilterCriteria() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Homecoming', 'Come celebrate homecoming.');
        createInstance(evt.Id, Date.today().addDays(5));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Events with no filter criteria should be visible to all alumni');
        System.assertEquals('Homecoming', results[0].eventTitle);
        System.assertEquals(1, results[0].instances.size());
    }

    @isTest
    static void excludesPastDatedInstance() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Old Reunion', 'A past event.');
        createInstance(evt.Id, Date.today().addDays(-3));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Past-dated instances should be excluded');
    }

    @isTest
    static void excludesPrivateInstance() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Board Retreat', 'Invite only.');
        createInstance(evt.Id, Date.today().addDays(2), Date.today().addDays(2), null, null, null, null, true);

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Private instances should be excluded');
    }

    @isTest
    static void includesAlumniMatchingFilterDimension() {
        Contact c = createContact();
        createAlumniDirectory(c.Id, '2026', null);
        summit__Summit_Events__c evt = createEvent(
                'Class of 2026 Reunion', 'Reunion for the class of 2026.', null, null, '2026', null
        );
        createInstance(evt.Id, Date.today().addDays(3));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Alumni matching the Class Year filter should see the event');
        System.assertEquals('Class of 2026 Reunion', results[0].eventTitle);
    }

    @isTest
    static void excludesAlumniNotMatchingFilterDimension() {
        Contact c = createContact();
        createAlumniDirectory(c.Id, '2020', null);
        summit__Summit_Events__c evt = createEvent(
                'Class of 2026 Reunion', 'Reunion for the class of 2026.', null, null, '2026', null
        );
        createInstance(evt.Id, Date.today().addDays(3));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Alumni not matching the Class Year filter should not see the event');
    }

    @isTest
    static void excludesAlumniWithBlankValueWhenEventHasFilter() {
        Contact c = createContact();
        createAlumniDirectory(c.Id, null, null);
        summit__Summit_Events__c evt = createEvent(
                'Class of 2026 Reunion', 'Reunion for the class of 2026.', null, null, '2026', null
        );
        createInstance(evt.Id, Date.today().addDays(3));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Alumni with no value for a filtered dimension should not qualify');
    }

    @isTest
    static void usesShortListingDescriptionWhenPresent() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent(
                'Reunion Weekend',
                'Full long-form description of the event.',
                'Short teaser description.',
                null,
                null,
                null
        );
        createInstance(evt.Id, Date.today().addDays(1));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Short teaser description.', results[0].description,
                'Short listing description should take precedence over the full description');
    }

    @isTest
    static void fallsBackToFullDescriptionWhenShortListingBlank() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Alumni Mixer', 'Full long-form description of the event.');
        createInstance(evt.Id, Date.today().addDays(1));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Full long-form description of the event.', results[0].description,
                'Should fall back to the full description when the short listing description is blank');
    }

    @isTest
    static void usesLocationTitleOverrideWhenPresent() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Golf Outing', 'Annual golf outing.', null, 'Clubhouse', null, null);
        createInstance(evt.Id, Date.today().addDays(1), Date.today().addDays(1), null, null, null, 'Lakeside Pavilion', null);

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Lakeside Pavilion', results[0].locationTitle,
                'Instance location override should take precedence over the event location title');
    }

    @isTest
    static void fallsBackToEventLocationTitleWhenNoOverride() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Golf Outing', 'Annual golf outing.', null, 'Clubhouse', null, null);
        createInstance(evt.Id, Date.today().addDays(1));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Clubhouse', results[0].locationTitle,
                'Should fall back to the event location title when no instance override is set');
    }

    @isTest
    static void groupsMultipleInstancesUnderSameEvent() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Lecture Series', 'Multi-session lecture series.');
        createInstance(evt.Id, Date.today().addDays(10));
        createInstance(evt.Id, Date.today().addDays(2));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Instances of the same event should be grouped under one UpcomingEvent');
        System.assertEquals(2, results[0].instances.size());
        System.assertEquals(Date.today().addDays(2), results[0].minStartDate,
                'minStartDate should be the earliest instance start date');
    }

    @isTest
    static void ordersEventsByEarliestInstanceStartDateThenName() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);

        summit__Summit_Events__c laterEvent = createEvent('Later Event', 'Happens later.');
        createInstance(laterEvent.Id, Date.today().addDays(10));

        summit__Summit_Events__c soonerEvent = createEvent('Sooner Event', 'Happens sooner.');
        createInstance(soonerEvent.Id, Date.today().addDays(1));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(2, results.size());
        System.assertEquals('Sooner Event', results[0].eventTitle, 'Sooner event should be listed first');
        System.assertEquals('Later Event', results[1].eventTitle, 'Later event should be listed second');
    }

    @isTest
    static void marksInstanceAsRegisteredWhenContactHasActiveRegistration() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Career Fair', 'Meet employers.');
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(1));
        createRegistration(c.Id, evt.Id, instance.Id, 'Confirmed');

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(1, results[0].instances.size());
        System.assertEquals(true, results[0].instances[0].registeredStatus,
                'Instance should be marked registered when the contact has an active registration');
    }

    @isTest
    static void marksInstanceAsNotRegisteredWhenNoRegistrationExists() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Career Fair', 'Meet employers.');
        createInstance(evt.Id, Date.today().addDays(1));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(false, results[0].instances[0].registeredStatus,
                'Instance should not be marked registered when there is no active registration');
    }

    @isTest
    static void buildsEventScheduleWithStartAndEndTimes() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Alumni Gala', 'An evening gala.');
        createInstance(
                evt.Id,
                Date.today().addDays(1),
                Date.today().addDays(1),
                Time.newInstance(18, 0, 0, 0),
                Time.newInstance(21, 0, 0, 0),
                'Central Daylight Time (America/Chicago)',
                null,
                null
        );

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        AlumniMyUpcomingEventsController.UpcomingEventInstance instance = results[0].instances[0];
        System.assertNotEquals(null, instance.eventSchedule, 'Event schedule should be populated when start/end times are present');
        System.assert(instance.eventSchedule.contains(' - '), 'Event schedule should contain a start and end portion separated by a dash');
        System.assertNotEquals(null, instance.startTime, 'Start time should be formatted when a start time is present');
    }

    @isTest
    static void eventScheduleAndStartTimeNullWhenNoTimesProvided() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Silent Auction', 'Bid on items.');
        createInstance(evt.Id, Date.today().addDays(1));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        AlumniMyUpcomingEventsController.UpcomingEventInstance instance = results[0].instances[0];
        System.assertEquals(null, instance.startTime, 'Start time should be null when no start time is set on the instance');
    }

    @isTest
    static void extractsHrefUrlFromRegistrationLinkFormula() {
        Contact c = createContact();
        createAlumniDirectory(c.Id);
        summit__Summit_Events__c evt = createEvent('Career Fair', 'Meet employers.');
        createInstance(evt.Id, Date.today().addDays(1));

        Test.startTest();
        List<AlumniMyUpcomingEventsController.UpcomingEvent> results =
                AlumniMyUpcomingEventsController.getFilteredUpcomingEvents(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        String registrationLink = results[0].instances[0].registrationLink;
        System.assertNotEquals(null, registrationLink, 'Registration link should be extracted from the formula field HTML');
        System.assert(!registrationLink.contains('<a'), 'Registration link should be the bare URL, not the HTML anchor tag');
    }
}

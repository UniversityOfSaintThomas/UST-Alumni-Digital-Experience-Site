/**
 * Unit tests for AlumniMyEventRegistrationsController.
 */
@isTest
private class AlumniMyEventRegistrationsCntrl_Test {

    private static Id universityAdvancementRecordTypeId() {
        return Schema.SObjectType.summit__Summit_Events__c.getRecordTypeInfosByDeveloperName().get('University_Advancement').getRecordTypeId();
    }

    private static summit__Summit_Events__c createEvent(String name, String description) {
        return createEvent(name, description, null, null);
    }

    private static summit__Summit_Events__c createEvent(String name, String description, String shortDescription, String locationTitle) {
        summit__Summit_Events__c evt = new summit__Summit_Events__c(
                Name = name,
                RecordTypeId = universityAdvancementRecordTypeId(),
                summit__Event_Name__c = name,
                summit__Event_description__c = description,
                summit__Event_Short_Listing_Description__c = shortDescription,
                summit__Location_Title__c = locationTitle
        );
        insert evt;
        return evt;
    }

    private static summit__Summit_Events_Instance__c createInstance(Id eventId, Date startDate) {
        return createInstance(eventId, startDate, null, null, null, null, null);
    }

    private static summit__Summit_Events_Instance__c createInstance(
            Id eventId,
            Date startDate,
            Time startTime,
            Date endDate,
            Time endTime,
            String timeZone,
            String locationTitleOverride
    ) {
        summit__Summit_Events_Instance__c instance = new summit__Summit_Events_Instance__c(
                summit__Event__c = eventId,
                summit__Instance_Start_Date__c = startDate,
                summit__Instance_Start_Time__c = startTime,
                summit__Instance_End_Date__c = endDate,
                summit__Instance_End_Time__c = endTime,
                summit__Instance_Time_Zone__c = timeZone,
                summit__Location_Title_Override__c = locationTitleOverride
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

    private static Contact createContact() {
        Contact c = new Contact(LastName = 'Tommie');
        insert c;
        return c;
    }

    @isTest
    static void returnsFutureRegisteredRegistration() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Homecoming', 'Come celebrate homecoming.');
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(5));
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Expected one registration to be returned');
        System.assertEquals('Homecoming', results[0].eventTitle);
        System.assertEquals('Come celebrate homecoming.', results[0].description);
        System.assertEquals(Date.today().addDays(5), results[0].startDate);
    }

    @isTest
    static void excludesPastDatedRegistration() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Old Reunion', 'A past event.');
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(-3));
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Past events should be excluded');
    }

    @isTest
    static void excludesOtherStatuses() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Gala', 'Annual gala.');
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(2));
        createRegistration(c.Id, evt.Id, instance.Id, 'Started');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Non Registered/Confirmed statuses should be excluded');
    }

    @isTest
    static void includesConfirmedStatus() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Career Fair', 'Meet employers.');
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today());
        createRegistration(c.Id, evt.Id, instance.Id, 'Confirmed');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Confirmed status should be included');
        System.assertEquals('Career Fair', results[0].eventTitle);
    }

    @isTest
    static void returnsEmptyListForNullContactId() {
        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(null);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Null contactId should return an empty list');
    }

    @isTest
    static void sortsRegistrationsByStartDateAscending() {
        Contact c = createContact();

        summit__Summit_Events__c laterEvent = createEvent('Later Event', 'Happens later.');
        summit__Summit_Events_Instance__c laterInstance = createInstance(laterEvent.Id, Date.today().addDays(10));
        createRegistration(c.Id, laterEvent.Id, laterInstance.Id, 'Registered');

        summit__Summit_Events__c soonerEvent = createEvent('Sooner Event', 'Happens sooner.');
        summit__Summit_Events_Instance__c soonerInstance = createInstance(soonerEvent.Id, Date.today().addDays(1));
        createRegistration(c.Id, soonerEvent.Id, soonerInstance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(2, results.size());
        System.assertEquals('Sooner Event', results[0].eventTitle, 'Sooner event should be listed first');
        System.assertEquals('Later Event', results[1].eventTitle, 'Later event should be listed second');
    }

    @isTest
    static void usesShortListingDescriptionWhenPresent() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent(
                'Reunion Weekend',
                'Full long-form description of the event.',
                'Short teaser description.',
                null
        );
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(1));
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Short teaser description.', results[0].description,
                'Short listing description should take precedence over the full description');
    }

    @isTest
    static void fallsBackToFullDescriptionWhenShortListingBlank() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent(
                'Alumni Mixer',
                'Full long-form description of the event.',
                null,
                null
        );
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(1));
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Full long-form description of the event.', results[0].description,
                'Should fall back to the full description when the short listing description is blank');
    }

    @isTest
    static void usesLocationTitleOverrideWhenPresent() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Golf Outing', 'Annual golf outing.', null, 'Clubhouse');
        summit__Summit_Events_Instance__c instance = createInstance(
                evt.Id,
                Date.today().addDays(1),
                null,
                null,
                null,
                null,
                'Lakeside Pavilion'
        );
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Lakeside Pavilion', results[0].locationTitle,
                'Instance location override should take precedence over the event location title');
    }

    @isTest
    static void fallsBackToEventLocationTitleWhenNoOverride() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Golf Outing', 'Annual golf outing.', null, 'Clubhouse');
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(1));
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Clubhouse', results[0].locationTitle,
                'Should fall back to the event location title when no instance override is set');
    }

    @isTest
    static void buildsEventScheduleWithStartAndEndTimes() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Alumni Gala', 'An evening gala.');
        summit__Summit_Events_Instance__c instance = createInstance(
                evt.Id,
                Date.today().addDays(1),
                Time.newInstance(18, 0, 0, 0),
                Date.today().addDays(1),
                Time.newInstance(21, 0, 0, 0),
                'Central Daylight Time (America/Chicago)',
                null
        );
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertNotEquals(null, results[0].eventSchedule, 'Event schedule should be populated when start/end times are present');
        System.assert(results[0].eventSchedule.contains(' - '), 'Event schedule should contain a start and end portion separated by a dash');
        System.assertNotEquals(null, results[0].startTime, 'Start time should be formatted when a start time is present');
    }

    @isTest
    static void buildsEventScheduleWithOnlyStartTime() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Breakfast Social', 'Morning social.');
        summit__Summit_Events_Instance__c instance = createInstance(
                evt.Id,
                Date.today().addDays(1),
                Time.newInstance(8, 0, 0, 0),
                null,
                null,
                null,
                null
        );
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertNotEquals(null, results[0].eventSchedule, 'Event schedule should be populated when only a start time is present');
        System.assert(!results[0].eventSchedule.contains(' - '), 'Event schedule should only contain the start portion when there is no end time');
    }

    @isTest
    static void eventScheduleAndStartTimeNullWhenNoTimesProvided() {
        Contact c = createContact();
        summit__Summit_Events__c evt = createEvent('Silent Auction', 'Bid on items.');
        summit__Summit_Events_Instance__c instance = createInstance(evt.Id, Date.today().addDays(1));
        createRegistration(c.Id, evt.Id, instance.Id, 'Registered');

        Test.startTest();
        List<AlumniMyEventRegistrationsController.EventRegistration> results =
                AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations(c.Id);
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(null, results[0].startTime, 'Start time should be null when no start time is set on the instance');
    }
}

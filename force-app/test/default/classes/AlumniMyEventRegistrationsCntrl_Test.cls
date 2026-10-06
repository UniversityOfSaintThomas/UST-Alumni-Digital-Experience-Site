/**
 * Unit tests for AlumniMyEventRegistrationsController.
 */
@isTest
private class AlumniMyEventRegistrationsCntrl_Test {

    private static Id universityAdvancementRecordTypeId() {
        return Schema.SObjectType.summit__Summit_Events__c.getRecordTypeInfosByDeveloperName().get('University_Advancement').getRecordTypeId();
    }

    private static summit__Summit_Events__c createEvent(String name, String description) {
        summit__Summit_Events__c evt = new summit__Summit_Events__c(
                Name = name,
                RecordTypeId = universityAdvancementRecordTypeId(),
                summit__Event_Name__c = name,
                summit__Event_description__c = description
        );
        insert evt;
        return evt;
    }

    private static summit__Summit_Events_Instance__c createInstance(Id eventId, Date startDate) {
        summit__Summit_Events_Instance__c instance = new summit__Summit_Events_Instance__c(
                summit__Event__c = eventId,
                summit__Instance_Start_Date__c = startDate
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
}

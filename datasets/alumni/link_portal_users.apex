// Links the sample portal users back to their Contacts and Alumni Directory records
// (cci task: link_sample_portal_users). Runs after create_portal_users.apex, in its own transaction because a
// User (setup object) and a Contact (non-setup) cannot be changed together.
//
// Sets Contact.Portal_User__c (which drives Is_Portal_User__c and Alumni_Directory__c.Is_Contact_a_Portal_User__c)
// and Alumni_Directory__c.Community_Profile__c. Safe to run again: it only changes values that differ.

Map<Id, User> userByContact = new Map<Id, User>();
for (User sampleUser : [SELECT Id, ContactId FROM User WHERE Alias IN ('smp1', 'smp2', 'smp3', 'smp4')]) {
    userByContact.put(sampleUser.ContactId, sampleUser);
}
System.assertEquals(4, userByContact.size(), 'Run create_sample_portal_users first.');

List<Contact> contactsToUpdate = new List<Contact>();
for (Contact person : [SELECT Id, Portal_User__c FROM Contact WHERE Id IN :userByContact.keySet()]) {
    Id userId = userByContact.get(person.Id).Id;
    if (person.Portal_User__c != userId) {
        person.Portal_User__c = userId;
        contactsToUpdate.add(person);
    }
}

List<Alumni_Directory__c> directoriesToUpdate = new List<Alumni_Directory__c>();
for (Alumni_Directory__c directory : [
    SELECT Id, Contact__c, Community_Profile__c FROM Alumni_Directory__c WHERE Contact__c IN :userByContact.keySet()
]) {
    Id userId = userByContact.get(directory.Contact__c).Id;
    if (directory.Community_Profile__c != userId) {
        directory.Community_Profile__c = userId;
        directoriesToUpdate.add(directory);
    }
}

update contactsToUpdate;
update directoriesToUpdate;
System.debug('LINKED|contacts=' + contactsToUpdate.size() + '|directories=' + directoriesToUpdate.size());

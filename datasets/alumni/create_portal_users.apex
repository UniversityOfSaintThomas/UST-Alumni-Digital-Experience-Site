// Creates the sample portal users for the "alumni" dataset (cci task: create_sample_portal_users).
//
// Why Apex and not the Snowfakery recipe: the recipe loader insists on all 119 platform-defaulted User
// checkboxes, so User cannot go through it. This script runs after the Contacts exist (load_sample_data) and
// before link_sample_portal_users, because a User (setup object) and a Contact (non-setup) cannot be changed
// in the same transaction.
//
// Safe to run again: users that already exist are skipped. No passwords are set and no emails are sent; sign in
// as one of them with Setup > Users > (user) > Login, or "Log in to Experience as User".
//
//   alias  banner id  person
//   smp1   90000001   Jordan Newgrad      recent graduate
//   smp2   90000002   Morgan Lawalum      alumni + donor, volunteer
//   smp3   90000003   Casey Parent        parent
//   smp4   90000004   Riley Nodirectory   no Alumni Directory record

Map<String, String> aliasByBannerId = new Map<String, String>{
    '90000001' => 'smp1', '90000002' => 'smp2', '90000003' => 'smp3', '90000004' => 'smp4'
};

// Usernames are unique across every Salesforce org, so end them with a key from this org's admin username.
String adminUsername = [SELECT Username FROM User WHERE Alias = 'UUser' LIMIT 1].Username;
String orgKey = adminUsername.substringBefore('@').toLowerCase().replace('-', '');

Id profileId = [SELECT Id FROM Profile WHERE Name = 'Customer Community Login User' LIMIT 1].Id;
List<PermissionSet> permissionSets = [
    SELECT Id, Name FROM PermissionSet WHERE Name = 'Alumni_Community'
];
System.assertEquals(1, permissionSets.size(), 'Deploy the Alumni_Community permission set first.');

Map<Id, String> existingByContact = new Map<Id, String>();
for (User existing : [SELECT ContactId, Username FROM User WHERE Alias IN :aliasByBannerId.values()]) {
    existingByContact.put(existing.ContactId, existing.Username);
}

List<Contact> contacts = [
    SELECT Id, FirstName, LastName, Email, University_Banner_ID__c
    FROM Contact
    WHERE University_Banner_ID__c IN :aliasByBannerId.keySet()
    ORDER BY University_Banner_ID__c
];
System.assertEquals(aliasByBannerId.size(), contacts.size(), 'Load the alumni dataset first (cci task run load_sample_data --dataset alumni).');

Database.DMLOptions options = new Database.DMLOptions();
options.EmailHeader.triggerUserEmail = false;
options.EmailHeader.triggerOtherEmail = false;
options.EmailHeader.triggerAutoResponseEmail = false;

List<User> newUsers = new List<User>();
for (Contact person : contacts) {
    if (existingByContact.containsKey(person.Id)) {
        continue;
    }
    String alias = aliasByBannerId.get(person.University_Banner_ID__c);
    newUsers.add(new User(
        Alias = alias,
        Username = (person.FirstName + '.' + person.LastName).toLowerCase() + '@' + orgKey + '.example.com',
        Email = person.Email,
        FirstName = person.FirstName,
        LastName = person.LastName,
        CommunityNickname = alias + '-' + orgKey,
        ContactId = person.Id,
        ProfileId = profileId,
        TimeZoneSidKey = 'America/Chicago',
        LocaleSidKey = 'en_US',
        LanguageLocaleKey = 'en_US',
        EmailEncodingKey = 'UTF-8',
        IsActive = true
    ));
}

if (!newUsers.isEmpty()) {
    List<Database.SaveResult> results = Database.insert(newUsers, options);
    for (Integer i = 0; i < results.size(); i++) {
        if (!results[i].isSuccess()) {
            System.debug(LoggingLevel.ERROR, 'USERFAIL|' + newUsers[i].Alias + '|' + results[i].getErrors()[0].getMessage());
        }
    }
}

// The Alumni_Community permission set for every sample user (new or existing), skipping assignments that already exist.
List<User> sampleUsers = [SELECT Id, Alias, Username FROM User WHERE Alias IN :aliasByBannerId.values() ORDER BY Alias];
Set<String> assigned = new Set<String>();
for (PermissionSetAssignment current : [
    SELECT AssigneeId, PermissionSetId FROM PermissionSetAssignment
    WHERE AssigneeId IN :sampleUsers AND PermissionSetId IN :permissionSets
]) {
    assigned.add(current.AssigneeId + ':' + current.PermissionSetId);
}
List<PermissionSetAssignment> newAssignments = new List<PermissionSetAssignment>();
for (User sampleUser : sampleUsers) {
    for (PermissionSet permissionSet : permissionSets) {
        if (!assigned.contains(sampleUser.Id + ':' + permissionSet.Id)) {
            newAssignments.add(new PermissionSetAssignment(AssigneeId = sampleUser.Id, PermissionSetId = permissionSet.Id));
        }
    }
}
if (!newAssignments.isEmpty()) {
    insert newAssignments;
}

System.debug('SAMPLEUSERS|created=' + newUsers.size() + '|total=' + sampleUsers.size() + '|permsetAssignmentsAdded=' + newAssignments.size());
for (User sampleUser : sampleUsers) {
    System.debug('SAMPLEUSER|' + sampleUser.Alias + '|' + sampleUser.Username);
}

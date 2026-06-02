/**
 * Created by dahl3702 on 7/15/2019.
 */

global class UserAlumniDirectorySync_TDTM extends hed.TDTM_Runnable {
    global override hed.TDTM_Runnable.DmlWrapper run(List<SObject> newlist, List<SObject> oldList, hed.TDTM_Runnable.Action triggerAction, Schema.DescribeSObjectResult objResult) {
        hed.TDTM_Runnable.DmlWrapper dmlWrapper = new hed.TDTM_Runnable.DmlWrapper();

        if (triggerAction == hed.TDTM_Runnable.Action.AfterInsert || triggerAction == hed.TDTM_Runnable.Action.AfterUpdate || triggerAction == hed.TDTM_Runnable.Action.AfterDelete || triggerAction == hed.TDTM_Runnable.Action.AfterUndelete) {

            Map<Id, User> newListMap = (newlist != null) ? new Map<Id, User>((List<User>) newlist) : new Map<Id, User>() ;
            Map<Id, User> oldListMap = (oldList != null) ? new Map<Id, User>((List<User>) oldList) : new Map<Id, User>() ;
            List<Alumni_Directory__c> alumniDirectoryUpdates = new List<Alumni_Directory__c>();

            /* Align Alumni Directory with following User record updates:
                User.Company = Alumni_Directory_c.Employer_Text_c
                User.Title = Alumni_Directory_c.Occupation_Text_c
                If User.City or User.State/Province changes then concatenate the values in ("User.City"", ""User.State/Province") = Alumni_Directory_c.City_State_c
            */
            for (Id nlm : newListMap.keySet()) {
                User changedUsr = (User) newListMap.get(nlm);
                //Must be a Cspliteportal user
                if (changedUsr.UserType.equalsIgnoreCase('CspLitePortal')) {
                    Id AlumniDirectoryId = null;
                    //Must have a Alumni directory id on the user record
                    if (String.isNotBlank(changedUsr.Alumni_Directory__c)) {
                        AlumniDirectoryId = changedUsr.Alumni_Directory__c;
                        Alumni_Directory__c updatedDir = new Alumni_Directory__c(
                                Id = AlumniDirectoryId,
                                Employer_Text__c = changedUsr.CompanyName,
                                Occupation_Text__c = changedUsr.Title,
                                City_State__c = changedUsr.City + ', ' + changedUsr.State
                        );
                        if (oldListMap.containsKey(nlm)) {
                            User changedOldUsr = (User) oldListMap.get(nlm);
                            if (changedUsr.CompanyName != changedOldUsr.CompanyName ||
                                    changedUsr.Title != changedOldUsr.Title ||
                                    changedUsr.City != changedOldUsr.City ||
                                    changedUsr.State != changedOldUsr.State) {
                                alumniDirectoryUpdates.add(updatedDir);
                            }
                        }
                    }
                }
            }

            if (alumniDirectoryUpdates.size() > 0) {
                upsert alumniDirectoryUpdates;
            }
        }
        return dmlWrapper;
    }
}
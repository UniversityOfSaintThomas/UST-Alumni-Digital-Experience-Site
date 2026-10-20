/**
 * The UST_Portal_Widget_Admin permission set must let a widget editor call every Apex class the widget editor
 * uses. runAs does not enforce Apex class access, so the grants are read from SetupEntityAccess instead. A
 * missing grant only shows up for a user who is not a System Administrator, which is easy to miss in a browser.
 */
@IsTest
private class PortalWidgetAdminAccess_TEST {

    private static final String ADMIN_PERMISSION_SET = 'UST_Portal_Widget_Admin';

    private static Set<String> grantedClasses() {
        Set<String> granted = new Set<String>();
        for (SetupEntityAccess access : [
                SELECT SetupEntityId
                FROM SetupEntityAccess
                WHERE Parent.Name = :ADMIN_PERMISSION_SET AND SetupEntityType = 'ApexClass'
        ]) {
            granted.add(access.SetupEntityId);
        }
        Set<String> names = new Set<String>();
        for (ApexClass apexClass : [SELECT Name FROM ApexClass WHERE Id IN :granted]) {
            names.add(apexClass.Name);
        }
        return names;
    }

    @IsTest
    static void widgetAdminsCanCallEveryClassTheEditorUses() {
        Set<String> granted = grantedClasses();
        for (String needed : new List<String>{
                'PortalButtons', 'PortalCardGrid', 'PortalDataTags', 'PortalHero', 'PortalPageRegistry' }) {
            System.assert(granted.contains(needed),
                    ADMIN_PERMISSION_SET + ' must grant ' + needed + ' (granted: ' + granted + ')');
        }
    }
}

/**
 * Tests for PortalWidgetController.getWidgetsForZone, focused on the Static Content
 * fields passed to the portal, including the widget-wide Content_CSS_Class__c.
 * Picklist values are read from the org schema, never hardcoded.
 */
@IsTest
private class PortalWidgetController_TEST {

    /**
     * Returns the first active value of a picklist field.
     *
     * @param field The picklist SObjectField
     * @return First active picklist value, or null if none
     */
    private static String firstPicklistValue(Schema.SObjectField field) {
        for (Schema.PicklistEntry entry : field.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static UST_Portal_Widget__c buildWidget(String widgetName, String zone, String pageContext) {
        return new UST_Portal_Widget__c(
                Name = widgetName,
                Zone__c = zone,
                Page_Context__c = pageContext,
                Is_Active__c = true,
                Component_Name__c = 'ust_static_content',
                Static_Content_Header__c = 'Header text',
                Static_Content__c = '<h2>Title</h2><p>Body</p>'
        );
    }

    @IsTest
    static void returnsStaticContentAndStyleClass() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        String styleClass = firstPicklistValue(UST_Portal_Widget__c.Content_CSS_Class__c);

        UST_Portal_Widget__c widget = buildWidget('Styled widget', zone, pageContext);
        widget.Content_CSS_Class__c = styleClass;
        insert widget;

        Test.startTest();
        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'The active widget should be returned');
        System.assertEquals(styleClass, results[0].contentCssClass, 'Style class should be passed through');
        System.assertEquals('Header text', results[0].staticContentHeader, 'Header should be passed through');
        System.assertEquals('<h2>Title</h2><p>Body</p>', results[0].staticContent, 'Heading markup should be preserved');
        System.assertEquals(true, results[0].isStaticContent, 'Widget should be flagged as static content');
    }

    @IsTest
    static void styleClassIsBlankWhenNotSet() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        insert buildWidget('Plain widget', zone, pageContext);

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(1, results.size(), 'The active widget should be returned');
        System.assertEquals(null, results[0].contentCssClass, 'No style class should be set');
    }

    @IsTest
    static void dataTagsAreResolvedForTheCurrentUserInBodyAndHeader() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c widget = buildWidget('Tagged widget', zone, pageContext);
        widget.Static_Content_Header__c = 'Welcome back, {{First_Name|friend}}';
        widget.Static_Content__c = '<p>Hi {{First_Name}} from {{Employer}} &amp; {{Not_A_Tag}}</p>';
        insert widget;
        PortalDataTags.testValues = new Map<String, String>{ 'first_name' => 'Jordan', 'employer' => 'Summit & Co' };

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(1, results.size(), 'The widget should be returned');
        System.assertEquals('Welcome back, Jordan', results[0].staticContentHeader, 'Header resolved as plain text');
        System.assertEquals('<p>Hi Jordan from Summit &amp; Co &amp; {{Not_A_Tag}}</p>', results[0].staticContent,
                'Body resolved with the value escaped; unknown tags untouched');
    }

    @IsTest
    static void guestsGetFallbacksAndEmptyValues() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c widget = buildWidget('Tagged widget', zone, pageContext);
        widget.Static_Content_Header__c = 'Hello {{First_Name|Alum}}';
        widget.Static_Content__c = '<p>Class of {{Class_Year}}.</p>';
        insert widget;
        PortalDataTags.testValues = new Map<String, String>();

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals('Hello Alum', results[0].staticContentHeader, 'Fallback used when there is no data');
        System.assertEquals('<p>Class of .</p>', results[0].staticContent, 'No value and no fallback is empty');
    }

    @IsTest
    static void contentWithoutTagsIsUntouchedAndSkipsTheLookup() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        insert buildWidget('Plain widget', zone, pageContext);
        PortalDataTags.testValues = new Map<String, String>{ 'first_name' => 'ShouldNotAppear' };

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals('<h2>Title</h2><p>Body</p>', results[0].staticContent, 'Content is unchanged');
        System.assertEquals('Header text', results[0].staticContentHeader, 'Header is unchanged');
    }

    @IsTest
    static void inactiveWidgetsAreExcluded() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c widget = buildWidget('Inactive widget', zone, pageContext);
        widget.Is_Active__c = false;
        insert widget;

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(0, results.size(), 'Inactive widgets must not be returned');
    }

    @IsTest
    static void blankArgumentsReturnEmptyList() {
        System.assertEquals(0, PortalWidgetController.getWidgetsForZone('', 'home').size(), 'Blank zone');
        System.assertEquals(0, PortalWidgetController.getWidgetsForZone('body', null).size(), 'Blank page');
    }
}

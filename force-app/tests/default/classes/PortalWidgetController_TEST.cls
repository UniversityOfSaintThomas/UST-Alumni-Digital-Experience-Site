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
    static void sectionBackgroundAndAccentReachThePortalAndStayBlankWhenNotSet() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c styled = buildWidget('Panel widget', zone, pageContext);
        styled.Section_Background__c = 'dark_purple';
        styled.Section_Accent__c = 'green_circles';
        styled.Sort_Order__c = 1;
        UST_Portal_Widget__c plain = buildWidget('Plain widget', zone, pageContext);
        plain.Sort_Order__c = 2;
        insert new List<UST_Portal_Widget__c>{ styled, plain };

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(2, results.size(), 'Both widgets are returned');
        System.assertEquals('dark_purple', results[0].sectionBackground, 'Section background is passed through');
        System.assertEquals('green_circles', results[0].sectionAccent, 'Section accent is passed through');
        System.assertEquals(null, results[1].sectionBackground, 'No background stays blank (no default value on the field)');
        System.assertEquals(null, results[1].sectionAccent, 'No accent stays blank');
    }

    @IsTest
    static void cardGridWidgetsCarryTheirCardsInOrderAndOtherWidgetsDoNot() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c grid = buildWidget('Grid', zone, pageContext);
        grid.Component_Name__c = PortalCardGrid.COMPONENT_NAME;
        grid.Grid_Columns__c = '4';
        grid.Card_Bottom_Bar__c = 'none';
        grid.Sort_Order__c = 1;
        UST_Portal_Widget__c plain = buildWidget('Plain', zone, pageContext);
        plain.Sort_Order__c = 2;
        UST_Portal_Widget__c inactiveGrid = buildWidget('Inactive grid', zone, pageContext);
        inactiveGrid.Component_Name__c = PortalCardGrid.COMPONENT_NAME;
        inactiveGrid.Is_Active__c = false;
        insert new List<UST_Portal_Widget__c>{ grid, plain, inactiveGrid };
        insert new List<UST_Portal_Widget_Item__c>{
            new UST_Portal_Widget_Item__c(Widget__c = grid.Id, Name = 'Apple', Sort_Order__c = 2, Link_URL__c = '/alumni-directory'),
            new UST_Portal_Widget_Item__c(Widget__c = grid.Id, Name = 'Zebra', Sort_Order__c = 1),
            new UST_Portal_Widget_Item__c(Widget__c = inactiveGrid.Id, Name = 'Never shown')
        };

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(2, results.size(), 'The inactive grid is not returned');
        System.assertNotEquals(null, results[0].grid, 'The Card Grid carries its grid');
        System.assertEquals('4', results[0].grid.columns, 'Columns reach the portal');
        System.assertEquals('none', results[0].grid.bottomBar, 'Bottom bar reaches the portal');
        System.assertEquals(2, results[0].grid.cards.size(), 'Only this widget\'s cards');
        System.assertEquals('Zebra', results[0].grid.cards[0].title, 'Cards are in sort order, not title order');
        System.assertEquals('portal', results[0].grid.cards[1].linkType, 'Links are cleaned and typed');
        System.assertEquals(null, results[1].grid, 'A widget that is not a Card Grid has no grid');
    }

    @IsTest
    static void aCardGridWithNoCardsStillReturnsAnEmptyGrid() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c grid = buildWidget('Empty grid', zone, pageContext);
        grid.Component_Name__c = PortalCardGrid.COMPONENT_NAME;
        insert grid;

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(1, results.size(), 'The grid is returned');
        System.assertNotEquals(null, results[0].grid, 'An empty grid object, not null');
        System.assertEquals(0, results[0].grid.cards.size(), 'No cards');
        System.assertEquals('3', results[0].grid.columns, 'Default columns when blank');
    }

    @IsTest
    static void aWidgetForAllPagesShowsOnEveryPageAndItsZone() {
        UST_Portal_Widget__c everywhere = buildWidget('Everywhere', 'banner', 'all');
        UST_Portal_Widget__c twoPages = buildWidget('Two pages', 'banner', 'home;events');
        UST_Portal_Widget__c elsewhere = buildWidget('Another zone', 'above_footer', 'all');
        insert new List<UST_Portal_Widget__c>{ everywhere, twoPages, elsewhere };

        List<PortalWidgetController.PortalWidgetDto> onHome = PortalWidgetController.getWidgetsForZone('banner', 'home');
        List<PortalWidgetController.PortalWidgetDto> onEvents = PortalWidgetController.getWidgetsForZone('banner', 'events');
        List<PortalWidgetController.PortalWidgetDto> onGiving = PortalWidgetController.getWidgetsForZone('banner', 'giving');
        List<PortalWidgetController.PortalWidgetDto> footerOnHome = PortalWidgetController.getWidgetsForZone('above_footer', 'home');

        System.assertEquals(2, onHome.size(), 'All Pages and the two-page widget both show on home');
        System.assertEquals(2, onEvents.size(), 'All Pages and the two-page widget both show on events');
        System.assertEquals(1, onGiving.size(), 'Only All Pages shows on a page the other widget does not list');
        System.assertEquals('Everywhere', onGiving[0].widgetLabel, 'The All Pages widget');
        System.assertEquals(1, footerOnHome.size(), 'All Pages applies in its own zone only');
        System.assertEquals('Another zone', footerOnHome[0].widgetLabel, 'The widget placed in that zone');
    }

    @IsTest
    static void aWidgetForOtherPagesDoesNotShowWhereItWasNotChosen() {
        insert buildWidget('Home only', 'banner', 'home');

        System.assertEquals(0, PortalWidgetController.getWidgetsForZone('banner', 'events').size(),
                'A widget chosen for home must not show on events');
        System.assertEquals(1, PortalWidgetController.getWidgetsForZone('banner', 'home').size(),
                'It still shows on home');
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
    static void buttonsAreCleanedResolvedAndCarryPlacementAndSize() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c widget = buildWidget('Button widget', zone, pageContext);
        widget.Button_Placement__c = 'Above';
        widget.Button_Size__c = 'ust-buttons-wide';
        widget.Buttons_JSON__c = '{"version":1,"buttons":['
                + '{"id":"a","label":"Hi {{First_Name|friend}}","type":"external","url":"https://example.edu/f?id={{Banner_ID}}","style":"brand"},'
                + '{"id":"b","label":"Bad","type":"external","url":"javascript:alert(1)"},'
                + '{"id":"c","label":"Directory","type":"portal","url":"/alumni-directory"}]}';
        insert widget;
        PortalDataTags.testValues = new Map<String, String>{ 'first_name' => 'Jordan', 'banner_id' => 'A001' };

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(1, results.size(), 'The widget is returned');
        System.assertEquals('Above', results[0].buttonPlacement, 'Placement');
        System.assertEquals('ust-buttons-wide', results[0].buttonSize, 'Size');
        System.assertEquals(2, results[0].buttons.size(), 'The unsafe button is dropped');
        System.assertEquals('Hi Jordan', results[0].buttons[0].label, 'Label resolved');
        System.assertEquals('https://example.edu/f?id=A001', results[0].buttons[0].url, 'URL resolved');
        System.assertEquals('/alumni-directory', results[0].buttons[1].url, 'Portal path kept');
    }

    @IsTest
    static void buttonDefaultsApplyAndAButtonOnlyWidgetStillRenders() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c widget = buildWidget('Buttons only', zone, pageContext);
        widget.Static_Content__c = null;
        widget.Static_Content_Header__c = null;
        widget.Button_Placement__c = null;
        widget.Button_Size__c = null;
        widget.Buttons_JSON__c = '{"buttons":[{"label":"Go","type":"portal","url":"/go"}]}';
        insert widget;

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals('Below', results[0].buttonPlacement, 'Blank placement means Below');
        System.assertEquals('', results[0].buttonSize, 'Blank size');
        System.assertEquals(true, results[0].isStaticContent, 'A widget with only buttons still renders');
    }

    @IsTest
    static void widgetsWithoutButtonsReturnAnEmptyList() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        insert buildWidget('No buttons', zone, pageContext);

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assert(results[0].buttons.isEmpty(), 'No buttons stored, none returned');
    }

    @IsTest
    static void heroBannerWidgetsCarryPictureSettingsAndTheSameTextAndButtons() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c widget = buildWidget('Hero', zone, pageContext);
        widget.Component_Name__c = 'ust_hero_banner';
        widget.Static_Content_Header__c = 'Welcome, {{First_Name|friend}}';
        widget.Hero_Image_URL__c = 'https://x.edu/hero.png';
        widget.Hero_Alt_Text__c = 'The quad in autumn';
        widget.Hero_Height__c = 'tall';
        widget.Hero_Layout__c = 'split';
        widget.Hero_Text_Position__c = 'center';
        widget.Hero_Overlay__c = 'strong';
        widget.Buttons_JSON__c = '{"buttons":[{"label":"Visit","type":"portal","url":"/alumni-directory"}]}';
        insert widget;
        PortalDataTags.testValues = new Map<String, String>{ 'first_name' => 'Jordan' };

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(1, results.size(), 'The hero is returned');
        System.assertNotEquals(null, results[0].hero, 'Hero settings are present');
        System.assert(results[0].hero.imageUrl.startsWith('https://x.edu/hero.png?v='), 'Image is versioned: ' + results[0].hero.imageUrl);
        System.assertEquals('The quad in autumn', results[0].hero.altText, 'Alt text');
        System.assertEquals('tall', results[0].hero.height, 'Height');
        System.assertEquals('split', results[0].hero.layout, 'Layout reaches the portal');
        System.assertEquals('center', results[0].hero.textPosition, 'Text position');
        System.assertEquals('strong', results[0].hero.overlay, 'Overlay');
        System.assertEquals('Welcome, Jordan', results[0].staticContentHeader, 'Headline resolves tags like Static Content');
        System.assertEquals(1, results[0].buttons.size(), 'Buttons come through');
    }

    @IsTest
    static void otherWidgetTypesDoNotCarryHeroSettings() {
        String zone = firstPicklistValue(UST_Portal_Widget__c.Zone__c);
        String pageContext = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c);
        UST_Portal_Widget__c widget = buildWidget('Static', zone, pageContext);
        widget.Hero_Image_URL__c = 'https://x.edu/hero.png';
        insert widget;

        List<PortalWidgetController.PortalWidgetDto> results =
                PortalWidgetController.getWidgetsForZone(zone, pageContext);

        System.assertEquals(null, results[0].hero, 'Only hero widgets receive a hero block');
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
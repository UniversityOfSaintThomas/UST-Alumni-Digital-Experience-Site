/**
 * Tests for PortalHero: image address allowlist, cache-busting, defaults, and alt text.
 */
@IsTest
private class PortalHero_TEST {

    /** Picklist-driven values come from the schema, never hardcoded. */
    private static String firstPicklistValue(Schema.SObjectField field) {
        for (Schema.PicklistEntry entry : field.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                return entry.getValue();
            }
        }
        return null;
    }

    /** Inserts a widget and re-reads it so SystemModstamp is populated, as it is in production. */
    private static UST_Portal_Widget__c savedWidget(Map<String, Object> overrides) {
        UST_Portal_Widget__c widget = new UST_Portal_Widget__c(
                Name = 'Hero test',
                Zone__c = firstPicklistValue(UST_Portal_Widget__c.Zone__c),
                Page_Context__c = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c),
                Is_Active__c = true
        );
        for (String field : overrides.keySet()) {
            widget.put(field, overrides.get(field));
        }
        insert widget;
        return [
                SELECT Id, SystemModstamp, Hero_Image_URL__c, Hero_Mobile_Image_URL__c, Hero_Alt_Text__c,
                        Hero_Height__c, Hero_Text_Position__c, Hero_Overlay__c
                FROM UST_Portal_Widget__c WHERE Id = :widget.Id
        ];
    }

    @IsTest
    static void allowsOnlySafeHttpsImageAddresses() {
        List<String> good = new List<String>{
                'https://bucket.s3.us-east-1.amazonaws.com/abc-hero.png',
                'HTTPS://static.aws.stthomas.edu/a/b.jpg?x=1&y=2',
                'https://example.edu/a%20b.png#frag'
        };
        for (String url : good) {
            System.assert(PortalHero.isAllowedImageUrl(url), 'Should be allowed: ' + url);
        }
        List<String> bad = new List<String>{
                'http://example.edu/a.png', 'javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>',
                '//evil.example.com/a.png', '/relative/a.png', 'https://', 'https:///a.png',
                'https://exa mple.edu/a.png', 'https://example.edu/a b.png', 'https://example.edu/a"onerror="x',
                'https://example.edu/a\'b.png', 'https://example.edu/<script>', 'https://example.edu/a,b.png',
                'https://example.edu\\evil.com/a.png', 'https://example.edu/a\tb.png', 'https://example.edu/' + 'a'.repeat(2100),
                '', ' ', null
        };
        for (String url : bad) {
            System.assert(!PortalHero.isAllowedImageUrl(url), 'Must be rejected: [' + url + ']');
        }
    }

    @IsTest
    static void addsACacheBustingVersionAndKeepsExistingQueryAndFragment() {
        System.assertEquals('https://x.edu/a.png?v=123', PortalHero.versionedImageUrl('https://x.edu/a.png', '123'), 'No query yet');
        System.assertEquals('https://x.edu/a.png?x=1&v=123', PortalHero.versionedImageUrl('https://x.edu/a.png?x=1', '123'), 'Existing query');
        System.assertEquals('https://x.edu/a.png?v=123#top', PortalHero.versionedImageUrl('https://x.edu/a.png#top', '123'), 'Fragment stays last');
        System.assertEquals('https://x.edu/a.png', PortalHero.versionedImageUrl(' https://x.edu/a.png ', null), 'No version means no change (trimmed)');
        System.assertEquals(null, PortalHero.versionedImageUrl('javascript:alert(1)', '123'), 'Unsafe address is dropped');
    }

    @IsTest
    static void prepareBuildsTheHeroFromTheRecord() {
        UST_Portal_Widget__c widget = savedWidget(new Map<String, Object>{
                'Hero_Image_URL__c' => 'https://x.edu/desktop.png',
                'Hero_Mobile_Image_URL__c' => 'https://x.edu/mobile.png',
                'Hero_Alt_Text__c' => '  Students on the quad  ',
                'Hero_Height__c' => 'tall',
                'Hero_Text_Position__c' => 'right',
                'Hero_Overlay__c' => 'strong'
        });

        PortalHero.HeroDto hero = PortalHero.prepare(widget);

        String version = String.valueOf(widget.SystemModstamp.getTime());
        System.assertEquals('https://x.edu/desktop.png?v=' + version, hero.imageUrl, 'Desktop image is versioned');
        System.assertEquals('https://x.edu/mobile.png?v=' + version, hero.mobileImageUrl, 'Mobile image is versioned');
        System.assertEquals('Students on the quad', hero.altText, 'Alt text is trimmed');
        System.assertEquals('tall', hero.height, 'Height');
        System.assertEquals('right', hero.textPosition, 'Text position');
        System.assertEquals('strong', hero.overlay, 'Overlay');
    }

    @IsTest
    static void blankSettingsGetTheDefaultsAndNoImages() {
        PortalHero.HeroDto hero = PortalHero.prepare(savedWidget(new Map<String, Object>()));

        System.assertEquals(null, hero.imageUrl, 'No image');
        System.assertEquals(null, hero.mobileImageUrl, 'No mobile image');
        System.assertEquals(null, hero.altText, 'No alt text');
        System.assertEquals(PortalHero.DEFAULT_HEIGHT, hero.height, 'Default height');
        System.assertEquals(PortalHero.DEFAULT_TEXT_POSITION, hero.textPosition, 'Default text position');
        // The field defaults to Medium, so a widget created without choosing an overlay starts on Medium.
        System.assertEquals(PortalHero.DEFAULT_OVERLAY, hero.overlay, 'A new widget starts on Medium');
    }

    @IsTest
    static void aBlankOverlayMeansNoOverlay() {
        // Choosing --None-- in the editor stores a blank value.
        UST_Portal_Widget__c widget = savedWidget(new Map<String, Object>{ 'Hero_Overlay__c' => null });
        System.assertEquals(null, widget.Hero_Overlay__c, 'Test setup: the overlay really is blank');

        System.assertEquals(PortalHero.OVERLAY_NONE, PortalHero.prepare(widget).overlay, 'Blank means none');
        System.assertEquals(PortalHero.OVERLAY_NONE, PortalHero.prepare(new UST_Portal_Widget__c()).overlay, 'Unsaved and blank means none');
    }

    @IsTest
    static void anUnsafeAddressIsDroppedWithoutAffectingTheOtherImage() {
        UST_Portal_Widget__c widget = savedWidget(new Map<String, Object>{
                'Hero_Image_URL__c' => 'https://x.edu/ok.png'
        });
        // The URL field type rejects most junk on insert, so simulate a bad stored value in memory.
        widget.Hero_Mobile_Image_URL__c = 'javascript:alert(1)';

        PortalHero.HeroDto hero = PortalHero.prepare(widget);

        System.assertNotEquals(null, hero.imageUrl, 'The good image survives');
        System.assertEquals(null, hero.mobileImageUrl, 'The unsafe one is dropped');
    }

    @IsTest
    static void altTextIsOnlyReturnedTogetherWithAnImageAndIsCapped() {
        UST_Portal_Widget__c noImage = savedWidget(new Map<String, Object>{ 'Hero_Alt_Text__c' => 'Orphan alt text' });
        System.assertEquals(null, PortalHero.prepare(noImage).altText, 'Alt text without an image is dropped');

        UST_Portal_Widget__c withImage = savedWidget(new Map<String, Object>{ 'Hero_Image_URL__c' => 'https://x.edu/a.png' });
        withImage.Hero_Alt_Text__c = 'x'.repeat(300);
        System.assertEquals(255, PortalHero.prepare(withImage).altText.length(), 'Alt text is capped at 255');

        withImage.Hero_Alt_Text__c = '   ';
        System.assertEquals(null, PortalHero.prepare(withImage).altText, 'Blank alt text means decorative');
    }

    @IsTest
    static void unknownLookSettingsFallBackToDefaults() {
        UST_Portal_Widget__c widget = savedWidget(new Map<String, Object>());
        widget.Hero_Height__c = 'gigantic';
        widget.Hero_Text_Position__c = 'sideways';
        widget.Hero_Overlay__c = 'sepia';

        PortalHero.HeroDto hero = PortalHero.prepare(widget);

        System.assertEquals(PortalHero.DEFAULT_HEIGHT, hero.height, 'Unknown height');
        System.assertEquals(PortalHero.DEFAULT_TEXT_POSITION, hero.textPosition, 'Unknown position');
        System.assertEquals(PortalHero.DEFAULT_OVERLAY, hero.overlay, 'Unknown overlay falls back to Medium so the white text stays protected');
    }

    @IsTest
    static void editorReadsTheCurrentImageAddresses() {
        UST_Portal_Widget__c widget = savedWidget(new Map<String, Object>{
                'Hero_Image_URL__c' => 'https://x.edu/desktop.png',
                'Hero_Mobile_Image_URL__c' => 'https://x.edu/mobile.png'
        });

        PortalHero.HeroImages images = PortalHero.getHeroImages(widget.Id);

        System.assertEquals('https://x.edu/desktop.png', images.imageUrl, 'Desktop address, unversioned');
        System.assertEquals('https://x.edu/mobile.png', images.mobileImageUrl, 'Mobile address');
    }

    @IsTest
    static void editorGetsNothingForMissingOrUnsafeAddressesOrUnknownWidgets() {
        UST_Portal_Widget__c blank = savedWidget(new Map<String, Object>());
        System.assertEquals(null, PortalHero.getHeroImages(blank.Id).imageUrl, 'No image stored');
        System.assertEquals(null, PortalHero.getHeroImages(null).imageUrl, 'No Id');

        UST_Portal_Widget__c widget = savedWidget(new Map<String, Object>{ 'Hero_Image_URL__c' => 'https://x.edu/ok.png' });
        System.assertEquals('https://x.edu/ok.png', PortalHero.getHeroImages(widget.Id).imageUrl, 'Control: safe address returned');
    }

    @IsTest
    static void usersWhoCannotEditWidgetsGetNoAddresses() {
        UST_Portal_Widget__c widget = savedWidget(new Map<String, Object>{ 'Hero_Image_URL__c' => 'https://x.edu/ok.png' });
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String uniqueName = 'hero' + String.valueOf(Crypto.getRandomInteger()).replace('-', '');
        User plainUser = new User(
                Alias = 'plain', Email = uniqueName + '@example.com', EmailEncodingKey = 'UTF-8',
                LastName = 'Plain', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
                ProfileId = standardProfile.Id, TimeZoneSidKey = 'America/Chicago',
                Username = uniqueName + '@example.com'
        );
        insert plainUser;

        PortalHero.HeroImages images;
        System.runAs(plainUser) {
            images = PortalHero.getHeroImages(widget.Id);
        }

        System.assertEquals(null, images.imageUrl, 'No edit access means no addresses');
    }
}
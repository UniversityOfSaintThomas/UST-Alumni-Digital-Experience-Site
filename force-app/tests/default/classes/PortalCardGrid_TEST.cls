/**
 * Tests for PortalCardGrid: defaults, the picture and link allowlists, the card limit, and the editor preview.
 */
@IsTest
private class PortalCardGrid_TEST {

    /** Picklist-driven values come from the schema, never hardcoded. */
    private static String firstPicklistValue(Schema.SObjectField field) {
        for (Schema.PicklistEntry entry : field.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static UST_Portal_Widget__c savedGrid() {
        UST_Portal_Widget__c widget = new UST_Portal_Widget__c(
                Name = 'Grid test',
                Component_Name__c = PortalCardGrid.COMPONENT_NAME,
                Zone__c = firstPicklistValue(UST_Portal_Widget__c.Zone__c),
                Page_Context__c = firstPicklistValue(UST_Portal_Widget__c.Page_Context__c),
                Is_Active__c = true
        );
        insert widget;
        return widget;
    }

    private static UST_Portal_Widget_Item__c item(String title) {
        return new UST_Portal_Widget_Item__c(Name = title);
    }

    private static PortalCardGrid.CardDto onlyCard(UST_Portal_Widget_Item__c record) {
        PortalCardGrid.GridDto grid = PortalCardGrid.prepare(null, null, new List<UST_Portal_Widget_Item__c>{ record });
        System.assertEquals(1, grid.cards.size(), 'One card expected');
        return grid.cards[0];
    }

    @IsTest
    static void columnsAndBottomBarFallBackToTheDefaults() {
        System.assertEquals('3', PortalCardGrid.normalizeColumns(null), 'Blank means 3');
        System.assertEquals('3', PortalCardGrid.normalizeColumns(''), 'Empty means 3');
        System.assertEquals('3', PortalCardGrid.normalizeColumns('9'), 'Unknown means 3');
        System.assertEquals('2', PortalCardGrid.normalizeColumns('2'), '2 is allowed');
        System.assertEquals('4', PortalCardGrid.normalizeColumns('4'), '4 is allowed');
        System.assertEquals('green', PortalCardGrid.normalizeBottomBar(null), 'Blank means green');
        System.assertEquals('green', PortalCardGrid.normalizeBottomBar('pink'), 'Unknown means green');
        System.assertEquals('none', PortalCardGrid.normalizeBottomBar('none'), 'No bar is allowed');
        PortalCardGrid.GridDto grid = PortalCardGrid.prepare(null, null, null);
        System.assertEquals('3', grid.columns, 'Default columns reach the grid');
        System.assertEquals('green', grid.bottomBar, 'Default bar reaches the grid');
        System.assertEquals(0, grid.cards.size(), 'No items means no cards');
    }

    @IsTest
    static void aCardNeedsATitleAndKeepsPlainText() {
        UST_Portal_Widget_Item__c untitled = item('x');
        untitled.Name = '   ';
        System.assertEquals(0, PortalCardGrid.prepare('3', 'green',
                new List<UST_Portal_Widget_Item__c>{ untitled }).cards.size(), 'A blank title is dropped');

        UST_Portal_Widget_Item__c record = item('  Become a Mentor  ');
        record.Card_Text__c = '  Share what you know.\nHelp a student.  ';
        PortalCardGrid.CardDto card = onlyCard(record);
        System.assertEquals('Become a Mentor', card.title, 'Title is trimmed');
        System.assertEquals('Share what you know.\nHelp a student.', card.text, 'Text is trimmed, line breaks kept');
        System.assertEquals(null, card.imageUrl, 'No picture');
        System.assertEquals(null, card.altText, 'No alt text without a picture');
        System.assertEquals(null, card.linkType, 'No link');
        System.assertEquals(false, card.newTab, 'No new tab without a link');
    }

    @IsTest
    static void pictureMustBeAnHttpsAddressAndAltTextIsKept() {
        UST_Portal_Widget_Item__c good = item('Good');
        good.Image_URL__c = 'https://bucket.s3.us-east-1.amazonaws.com/card.jpg';
        good.Image_Alt_Text__c = '  Students on the quad  ';
        PortalCardGrid.CardDto card = onlyCard(good);
        System.assertEquals('https://bucket.s3.us-east-1.amazonaws.com/card.jpg', card.imageUrl, 'https picture kept');
        System.assertEquals('Students on the quad', card.altText, 'Alt text trimmed');

        UST_Portal_Widget_Item__c decorative = item('Decorative');
        decorative.Image_URL__c = 'https://bucket.s3.us-east-1.amazonaws.com/card.jpg';
        System.assertEquals('', onlyCard(decorative).altText, 'A picture with no alt text is marked decorative');

        for (String bad : new List<String>{ 'http://x.edu/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA',
                '//x.edu/a.jpg', 'https://x.edu/a b.jpg' }) {
            UST_Portal_Widget_Item__c unsafe = item('Unsafe');
            unsafe.Image_URL__c = bad;
            unsafe.Image_Alt_Text__c = 'ignored';
            PortalCardGrid.CardDto dropped = onlyCard(unsafe);
            System.assertEquals(null, dropped.imageUrl, 'Dropped: ' + bad);
            System.assertEquals(null, dropped.altText, 'No alt text for a dropped picture: ' + bad);
        }

        UST_Portal_Widget_Item__c longAlt = item('Long alt');
        longAlt.Image_URL__c = 'https://bucket.s3.us-east-1.amazonaws.com/card.jpg';
        longAlt.Image_Alt_Text__c = 'a'.repeat(300);
        System.assertEquals(255, onlyCard(longAlt).altText.length(), 'Alt text is capped at 255');
    }

    @IsTest
    static void linksMustPassTheSameRulesAsButtons() {
        UST_Portal_Widget_Item__c portal = item('Portal');
        portal.Link_URL__c = ' /alumni-directory ';
        portal.Open_In_New_Tab__c = true;
        PortalCardGrid.CardDto portalCard = onlyCard(portal);
        System.assertEquals('portal', portalCard.linkType, 'A path is a portal link');
        System.assertEquals('/alumni-directory', portalCard.linkUrl, 'Path is trimmed');
        System.assertEquals(false, portalCard.newTab, 'A site page never opens in a new tab');

        UST_Portal_Widget_Item__c external = item('External');
        external.Link_URL__c = 'https://www.stthomas.edu/alumni';
        external.Open_In_New_Tab__c = true;
        PortalCardGrid.CardDto externalCard = onlyCard(external);
        System.assertEquals('external', externalCard.linkType, 'An https address is external');
        System.assertEquals(true, externalCard.newTab, 'An https link can open in a new tab');

        external.Open_In_New_Tab__c = false;
        System.assertEquals(false, onlyCard(external).newTab, 'New tab off stays off');

        UST_Portal_Widget_Item__c mail = item('Mail');
        mail.Link_URL__c = 'mailto:alumni@stthomas.edu';
        mail.Open_In_New_Tab__c = true;
        PortalCardGrid.CardDto mailCard = onlyCard(mail);
        System.assertEquals('external', mailCard.linkType, 'mailto is allowed');
        System.assertEquals(false, mailCard.newTab, 'mailto never opens a new tab');

        UST_Portal_Widget_Item__c phone = item('Phone');
        phone.Link_URL__c = 'tel:+16516476000';
        System.assertEquals('external', onlyCard(phone).linkType, 'tel is allowed');

        for (String bad : new List<String>{ 'javascript:alert(1)', 'http://x.edu', '//evil.example', 'www.stthomas.edu',
                '/has space', 'https://x.edu/{{first_name}}', 'ftp://x.edu' }) {
            UST_Portal_Widget_Item__c unsafe = item('Unsafe');
            unsafe.Link_URL__c = bad;
            PortalCardGrid.CardDto dropped = onlyCard(unsafe);
            System.assertEquals(null, dropped.linkType, 'Link dropped: ' + bad);
            System.assertEquals(null, dropped.linkUrl, 'Link address dropped: ' + bad);
            System.assertEquals('Unsafe', dropped.title, 'The card itself is still shown: ' + bad);
        }
    }

    @IsTest
    static void aGridShowsAtMostTwentyFourCards() {
        List<UST_Portal_Widget_Item__c> many = new List<UST_Portal_Widget_Item__c>();
        for (Integer i = 0; i < 30; i++) {
            many.add(item('Card ' + i));
        }
        PortalCardGrid.GridDto grid = PortalCardGrid.prepare('4', 'none', many);
        System.assertEquals(PortalCardGrid.MAX_CARDS, grid.cards.size(), 'Extra cards are ignored');
        System.assertEquals('Card 0', grid.cards[0].title, 'The first cards are kept');
        System.assertEquals('4', grid.columns, 'Columns pass through');
        System.assertEquals('none', grid.bottomBar, 'Bottom bar passes through');
    }

    @IsTest
    static void pictureAddressCarriesAVersionFromTheSavedRecord() {
        UST_Portal_Widget__c widget = savedGrid();
        insert new UST_Portal_Widget_Item__c(Widget__c = widget.Id, Name = 'With picture',
                Image_URL__c = 'https://bucket.s3.us-east-1.amazonaws.com/card.jpg');
        UST_Portal_Widget_Item__c saved = [
                SELECT Id, Name, Image_URL__c, Image_Alt_Text__c, Card_Text__c, Link_URL__c, Open_In_New_Tab__c,
                        Sort_Order__c, SystemModstamp
                FROM UST_Portal_Widget_Item__c WHERE Widget__c = :widget.Id
        ];
        PortalCardGrid.CardDto card = onlyCard(saved);
        System.assert(card.imageUrl.startsWith('https://bucket.s3.us-east-1.amazonaws.com/card.jpg?v='),
                'Version appended so a replaced picture shows at once: ' + card.imageUrl);
    }

    @IsTest
    static void editorPreviewUsesTheSavedCardsInOrderAndTheChoicesOnScreen() {
        UST_Portal_Widget__c widget = savedGrid();
        UST_Portal_Widget__c other = savedGrid();
        insert new List<UST_Portal_Widget_Item__c>{
            new UST_Portal_Widget_Item__c(Widget__c = widget.Id, Name = 'Third', Sort_Order__c = null),
            new UST_Portal_Widget_Item__c(Widget__c = widget.Id, Name = 'Second', Sort_Order__c = 20),
            new UST_Portal_Widget_Item__c(Widget__c = widget.Id, Name = 'First', Sort_Order__c = 10),
            new UST_Portal_Widget_Item__c(Widget__c = other.Id, Name = 'Someone else')
        };

        PortalCardGrid.GridDto grid = PortalCardGrid.getGridPreview(widget.Id, '2', 'none');

        System.assertEquals(3, grid.cards.size(), 'Only this widget\'s cards');
        System.assertEquals('First', grid.cards[0].title, 'Lowest sort order first');
        System.assertEquals('Second', grid.cards[1].title, 'Then the next');
        System.assertEquals('Third', grid.cards[2].title, 'Blank sort order last');
        System.assertEquals('2', grid.columns, 'The unsaved columns choice is used');
        System.assertEquals('none', grid.bottomBar, 'The unsaved bar choice is used');
    }

    // ----- Admin editor API -----

    private static void assertRejected(UST_Portal_Widget__c widget, String title, String text, String imageUrl,
            String altText, String linkUrl, String expectedFragment) {
        try {
            PortalCardGrid.saveItem(widget.Id, null, title, text, imageUrl, altText, linkUrl, false);
            System.assert(false, 'Expected a rejection mentioning: ' + expectedFragment);
        } catch (AuraHandledException problem) {
            System.assert(problem.getMessage().containsIgnoreCase(expectedFragment),
                    'Message should mention "' + expectedFragment + '" but was: ' + problem.getMessage());
        }
        System.assertEquals(0, PortalCardGrid.getEditorItems(widget.Id).size(), 'Nothing is saved when rejected');
    }

    @IsTest
    static void saveItemCreatesCardsAtTheEndAndTrimsWhatWasTyped() {
        UST_Portal_Widget__c widget = savedGrid();

        PortalCardGrid.ItemRow first = PortalCardGrid.saveItem(widget.Id, null, '  First  ', '  Some text  ',
                ' https://bucket.s3.us-east-1.amazonaws.com/a.jpg ', '  Alt  ', ' /alumni-directory ', true);
        PortalCardGrid.ItemRow second = PortalCardGrid.saveItem(widget.Id, null, 'Second', null, null, null, null, null);

        System.assertEquals('First', first.title, 'Title trimmed');
        System.assertEquals('Some text', first.text, 'Text trimmed');
        System.assertEquals('https://bucket.s3.us-east-1.amazonaws.com/a.jpg', first.imageUrl, 'Picture trimmed');
        System.assertEquals('Alt', first.altText, 'Alt trimmed');
        System.assertEquals('/alumni-directory', first.linkUrl, 'Link trimmed');
        System.assertEquals(true, first.newTab, 'New tab flag saved as chosen');
        System.assertEquals(10, first.sortOrder, 'The first card gets 10');
        System.assertEquals(20, second.sortOrder, 'A new card goes last');
        System.assertEquals(false, second.newTab, 'A blank new tab flag means off');
        System.assertEquals(null, second.imageUrl, 'Blank values are stored as empty');
        System.assertEquals(2, PortalCardGrid.getEditorItems(widget.Id).size(), 'Both cards are listed');
    }

    @IsTest
    static void saveItemRejectsBadInputWithAMessageTheAdminCanActOn() {
        UST_Portal_Widget__c widget = savedGrid();
        assertRejected(widget, '   ', null, null, null, null, 'title');
        assertRejected(widget, 'a'.repeat(81), null, null, null, null, 'title');
        assertRejected(widget, 'Ok', 'a'.repeat(501), null, null, null, 'text');
        assertRejected(widget, 'Ok', null, 'http://x.edu/a.jpg', null, null, 'https');
        assertRejected(widget, 'Ok', null, 'javascript:alert(1)', null, null, 'https');
        assertRejected(widget, 'Ok', null, null, 'a'.repeat(256), null, 'description');
        assertRejected(widget, 'Ok', null, null, null, 'javascript:alert(1)', 'link');
        assertRejected(widget, 'Ok', null, null, null, '//evil.example', 'link');
        assertRejected(widget, 'Ok', null, null, null, 'www.stthomas.edu', 'link');
        assertRejected(widget, 'Ok', null, null, null, 'http://x.edu', 'link');
    }

    @IsTest
    static void aGridCannotHoldMoreThanTheLimit() {
        UST_Portal_Widget__c widget = savedGrid();
        List<UST_Portal_Widget_Item__c> many = new List<UST_Portal_Widget_Item__c>();
        for (Integer i = 0; i < PortalCardGrid.MAX_CARDS; i++) {
            many.add(new UST_Portal_Widget_Item__c(Widget__c = widget.Id, Name = 'Card ' + i, Sort_Order__c = i));
        }
        insert many;
        try {
            PortalCardGrid.saveItem(widget.Id, null, 'One too many', null, null, null, null, false);
            System.assert(false, 'The extra card should be refused');
        } catch (AuraHandledException problem) {
            System.assert(problem.getMessage().contains(String.valueOf(PortalCardGrid.MAX_CARDS)),
                    'Message names the limit: ' + problem.getMessage());
        }
        System.assertEquals(PortalCardGrid.MAX_CARDS, PortalCardGrid.getEditorItems(widget.Id).size(), 'Nothing added');
    }

    @IsTest
    static void saveItemUpdatesAnExistingCardAndKeepsItsPlace() {
        UST_Portal_Widget__c widget = savedGrid();
        PortalCardGrid.ItemRow created = PortalCardGrid.saveItem(widget.Id, null, 'Old', 'old', null, null, null, false);
        PortalCardGrid.saveItem(widget.Id, null, 'Other', null, null, null, null, false);

        PortalCardGrid.ItemRow updated = PortalCardGrid.saveItem(widget.Id, created.id, 'New', null, null, null,
                'https://www.stthomas.edu', true);

        System.assertEquals(created.id, updated.id, 'Same card');
        System.assertEquals('New', updated.title, 'Title changed');
        System.assertEquals(null, updated.text, 'Cleared text is stored empty');
        System.assertEquals(true, updated.newTab, 'Flag changed');
        System.assertEquals(created.sortOrder, updated.sortOrder, 'Editing does not move the card');
        System.assertEquals(2, PortalCardGrid.getEditorItems(widget.Id).size(), 'No duplicate was made');
    }

    @IsTest
    static void aCardOfAnotherWidgetCannotBeChangedOrDeletedThroughThisOne() {
        UST_Portal_Widget__c mine = savedGrid();
        UST_Portal_Widget__c theirs = savedGrid();
        PortalCardGrid.ItemRow foreign = PortalCardGrid.saveItem(theirs.Id, null, 'Theirs', null, null, null, null, false);

        try {
            PortalCardGrid.saveItem(mine.Id, foreign.id, 'Hijacked', null, null, null, null, false);
            System.assert(false, 'Update through the wrong widget must fail');
        } catch (AuraHandledException problem) {
            System.assert(problem.getMessage().containsIgnoreCase('no longer exists'), 'Clear message: ' + problem.getMessage());
        }
        try {
            PortalCardGrid.deleteItem(mine.Id, foreign.id);
            System.assert(false, 'Delete through the wrong widget must fail');
        } catch (AuraHandledException problem) {
            System.assert(problem.getMessage().containsIgnoreCase('no longer exists'), 'Clear message: ' + problem.getMessage());
        }
        System.assertEquals('Theirs', PortalCardGrid.getEditorItems(theirs.Id)[0].title, 'The other card is untouched');
    }

    @IsTest
    static void deleteItemRemovesOnlyThatCard() {
        UST_Portal_Widget__c widget = savedGrid();
        PortalCardGrid.ItemRow keep = PortalCardGrid.saveItem(widget.Id, null, 'Keep', null, null, null, null, false);
        PortalCardGrid.ItemRow drop = PortalCardGrid.saveItem(widget.Id, null, 'Drop', null, null, null, null, false);

        PortalCardGrid.deleteItem(widget.Id, drop.id);

        List<PortalCardGrid.ItemRow> left = PortalCardGrid.getEditorItems(widget.Id);
        System.assertEquals(1, left.size(), 'One card left');
        System.assertEquals(keep.id, left[0].id, 'The right one');
    }

    @IsTest
    static void reorderRenumbersInTheGivenOrderAndAppendsTheRest() {
        UST_Portal_Widget__c widget = savedGrid();
        UST_Portal_Widget__c other = savedGrid();
        PortalCardGrid.ItemRow a = PortalCardGrid.saveItem(widget.Id, null, 'A', null, null, null, null, false);
        PortalCardGrid.ItemRow b = PortalCardGrid.saveItem(widget.Id, null, 'B', null, null, null, null, false);
        PortalCardGrid.ItemRow c = PortalCardGrid.saveItem(widget.Id, null, 'C', null, null, null, null, false);
        PortalCardGrid.ItemRow foreign = PortalCardGrid.saveItem(other.Id, null, 'Foreign', null, null, null, null, false);

        // C first, then B; A is not listed so it follows; a foreign id and a repeated id are ignored.
        PortalCardGrid.reorder(widget.Id, new List<Id>{ c.id, foreign.id, b.id, c.id });

        List<PortalCardGrid.ItemRow> rows = PortalCardGrid.getEditorItems(widget.Id);
        System.assertEquals('C', rows[0].title, 'Listed first');
        System.assertEquals('B', rows[1].title, 'Listed second');
        System.assertEquals('A', rows[2].title, 'Unlisted follows');
        System.assertEquals(10, rows[0].sortOrder, 'Numbered from 10');
        System.assertEquals(30, rows[2].sortOrder, 'In steps of 10');
        System.assertEquals(10, PortalCardGrid.getEditorItems(other.Id)[0].sortOrder, 'The other widget is untouched');

        PortalCardGrid.reorder(widget.Id, null);
        System.assertEquals('C', PortalCardGrid.getEditorItems(widget.Id)[0].title, 'A blank list keeps the current order');
    }
}

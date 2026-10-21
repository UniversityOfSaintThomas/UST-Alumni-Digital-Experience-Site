/**
 * Tests for PortalButtons: JSON cleaning, link allowlists, data tags in labels and URLs, and
 * the portal-link suggestions.
 */
@IsTest
private class PortalButtons_TEST {

    private static String wrap(String buttonJson) {
        return '{"version":1,"buttons":[' + buttonJson + ']}';
    }

    private static List<PortalButtons.ButtonDto> prepare(String buttonJson) {
        return PortalButtons.prepare(wrap(buttonJson), new Map<String, String>());
    }

    private static String external(String url) {
        return '{"id":"b1","label":"Go","type":"external","url":"' + url + '"}';
    }

    private static String portal(String url) {
        return '{"id":"b1","label":"Go","type":"portal","url":"' + url + '"}';
    }

    @IsTest
    static void cleansAValidExternalAndPortalButtonInOrder() {
        String json = wrap(
                '{"id":"a","label":"Give","type":"external","url":"https://example.edu/give","newTab":false,"style":"outline-brand","align":"center","icon":"heart"},'
                + '{"id":"b","label":"Directory","type":"portal","url":"/alumni-directory","style":"neutral","align":"end"}');

        List<PortalButtons.ButtonDto> buttons = PortalButtons.prepare(json, null);

        System.assertEquals(2, buttons.size(), 'Both buttons survive');
        System.assertEquals('a', buttons[0].id, 'Order and id preserved');
        System.assertEquals('https://example.edu/give', buttons[0].url, 'External url');
        System.assertEquals(false, buttons[0].newTab, 'Stored newTab=false is honored');
        System.assertEquals('outline-brand', buttons[0].style, 'Style');
        System.assertEquals('center', buttons[0].align, 'Alignment');
        System.assertEquals('utility:heart', buttons[0].icon, 'Icon is normalized to a utility icon');
        System.assertEquals('portal', buttons[1].type, 'Portal type');
        System.assertEquals('/alumni-directory', buttons[1].url, 'Portal path');
        System.assertEquals(false, buttons[1].newTab, 'Portal links never open a new tab');
    }

    @IsTest
    static void keepsTheArrowLinkStyle() {
        List<PortalButtons.ButtonDto> buttons = prepare('{"label":"Read stories","type":"external","url":"https://example.edu/stories","style":"arrow_link"}');

        System.assertEquals(1, buttons.size(), 'Button is kept');
        System.assertEquals('arrow_link', buttons[0].style, 'The arrow link style is on the allowlist');
    }

    @IsTest
    static void defaultsAreAppliedForMissingOrUnknownOptions() {
        List<PortalButtons.ButtonDto> buttons = prepare('{"label":"Go","type":"external","url":"https://example.edu","style":"rainbow","align":"sideways","icon":"Bad Icon!"}');

        System.assertEquals(1, buttons.size(), 'Button is kept');
        System.assertEquals('b1', buttons[0].id, 'Missing id becomes b + position');
        System.assertEquals('brand', buttons[0].style, 'Unknown style falls back');
        System.assertEquals('left', buttons[0].align, 'Unknown alignment falls back');
        System.assertEquals(null, buttons[0].icon, 'Invalid icon is ignored');
        System.assertEquals(true, buttons[0].newTab, 'External https defaults to a new tab');
    }

    @IsTest
    static void dangerousAndMalformedExternalLinksAreDropped() {
        List<String> bad = new List<String>{
                'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x',
                'http://example.edu', '//evil.example.com/x', '/relative', 'https://', 'https:///nohost',
                'https://exa mple.edu', 'https://example.edu/a b', 'https://example.edu\\\\evil.com',
                'ftp://example.edu', 'mailto:', 'tel:abc', ' ', ''
        };
        for (String url : bad) {
            System.assertEquals(0, prepare(external(url.replace('"', ''))).size(), 'Must be dropped: [' + url + ']');
        }
    }

    @IsTest
    static void acceptableExternalLinksArePassed() {
        System.assertEquals(1, prepare(external('https://example.edu/a/b?x=1&y=2#top')).size(), 'https with path and query');
        System.assertEquals(1, prepare(external('HTTPS://Example.edu')).size(), 'Scheme is case-insensitive');
        System.assertEquals(1, prepare(external('mailto:alumni@example.edu?subject=Hi')).size(), 'mailto');
        System.assertEquals(1, prepare(external('tel:+16515551212')).size(), 'tel');
        List<PortalButtons.ButtonDto> mail = prepare(external('mailto:alumni@example.edu'));
        System.assertEquals(false, mail[0].newTab, 'mailto never opens a new tab');
    }

    @IsTest
    static void portalPathsMustBeSingleSlashRelative() {
        System.assertEquals(1, prepare(portal('/alumni-directory')).size(), 'simple path');
        System.assertEquals(1, prepare(portal('/news/abc?x=1#top')).size(), 'path with query and hash');
        System.assertEquals(1, prepare(portal('/')).size(), 'root');
        List<String> bad = new List<String>{
                '//evil.example.com/x', 'https://example.edu', 'javascript:alert(1)', 'alumni-directory',
                '/has space', '/back\\\\slash', ''
        };
        for (String url : bad) {
            System.assertEquals(0, prepare(portal(url)).size(), 'Must be dropped: [' + url + ']');
        }
    }

    @IsTest
    static void invalidTypesAndBlankLabelsAreDropped() {
        System.assertEquals(0, prepare('{"label":"Go","type":"script","url":"https://example.edu"}').size(), 'Unknown type');
        System.assertEquals(0, prepare('{"label":"Go","url":"https://example.edu"}').size(), 'Missing type');
        System.assertEquals(0, prepare('{"label":"   ","type":"external","url":"https://example.edu"}').size(), 'Blank label');
        System.assertEquals(0, prepare('{"type":"external","url":"https://example.edu"}').size(), 'No label');
        System.assertEquals(0, prepare('"just a string"').size(), 'Not an object');
        System.assertEquals(0, prepare('{"label":5,"type":"external","url":7}').size(), 'Wrong value types');
    }

    @IsTest
    static void oneBadButtonDoesNotAffectTheOthers() {
        List<PortalButtons.ButtonDto> buttons = prepare(
                external('https://ok.example.edu') + ',' + external('javascript:alert(1)') + ',' + portal('/ok'));
        System.assertEquals(2, buttons.size(), 'Only the bad one is dropped');
    }

    @IsTest
    static void malformedOrEmptyJsonYieldsNoButtons() {
        Map<String, String> none = new Map<String, String>();
        System.assertEquals(0, PortalButtons.prepare(null, none).size(), 'null');
        System.assertEquals(0, PortalButtons.prepare('', none).size(), 'blank');
        System.assertEquals(0, PortalButtons.prepare('{not json', none).size(), 'syntax error');
        System.assertEquals(0, PortalButtons.prepare('[]', none).size(), 'bare array');
        System.assertEquals(0, PortalButtons.prepare('{"version":1}', none).size(), 'no buttons key');
        System.assertEquals(0, PortalButtons.prepare('{"buttons":"x"}', none).size(), 'buttons not a list');
        System.assertEquals(0, PortalButtons.prepare('{"buttons":[1,"a",null]}', none).size(), 'items not objects');
    }

    @IsTest
    static void dataTagsAreResolvedInLabelsAndUrlsBeforeValidation() {
        Map<String, String> values = new Map<String, String>{ 'first_name' => 'Jordan', 'banner_id' => 'A 00/1', 'last_name' => 'Tommie' };
        String json = wrap('{"label":"Give, {{First_Name|friend}}","type":"external","url":"https://example.edu/f?id={{Banner_ID}}&n={{Last_Name}}"}');

        List<PortalButtons.ButtonDto> buttons = PortalButtons.prepare(json, values);

        System.assertEquals(1, buttons.size(), 'Resolved button is kept');
        System.assertEquals('Give, Jordan', buttons[0].label, 'Label resolved as plain text');
        System.assertEquals('https://example.edu/f?id=A+00%2F1&n=', buttons[0].url, 'Identifier encoded; non-identifier tags are dropped from URLs');
    }

    @IsTest
    static void guestsGetFallbacksAndBlankLabelsDropTheButton() {
        String withFallback = wrap('{"label":"Hello {{First_Name|Alum}}","type":"portal","url":"/x"}');
        System.assertEquals('Hello Alum', PortalButtons.prepare(withFallback, null)[0].label, 'Fallback for guests');

        String onlyTag = wrap('{"label":"{{First_Name}}","type":"portal","url":"/x"}');
        System.assertEquals(0, PortalButtons.prepare(onlyTag, null).size(), 'No label left, so the button is dropped');
    }

    @IsTest
    static void aTagCannotSmuggleADangerousLink() {
        Map<String, String> values = new Map<String, String>{ 'banner_id' => 'javascript:alert(1)' };
        // The whole URL is a tag: the value is URL-encoded, so it is not a valid link and is dropped.
        System.assertEquals(0, PortalButtons.prepare(wrap('{"label":"Go","type":"external","url":"{{Banner_ID}}"}'), values).size(), 'Tag-only URL');
        // As a path segment the value stays inside the path.
        List<PortalButtons.ButtonDto> inPath = PortalButtons.prepare(wrap('{"label":"Go","type":"portal","url":"/people/{{Banner_ID}}"}'), values);
        System.assertEquals(1, inPath.size(), 'Value inside a path is allowed');
        System.assertEquals('/people/javascript%3Aalert%281%29', inPath[0].url, 'but is fully encoded');
    }

    @IsTest
    static void unresolvedTagsInUrlsDropTheButton() {
        System.assertEquals(0, PortalButtons.prepare(wrap('{"label":"Go","type":"external","url":"https://example.edu/{{Not_A_Tag}}"}'), null).size(), 'Unknown tag left in URL');
    }

    @IsTest
    static void labelsAreTruncated() {
        List<PortalButtons.ButtonDto> buttons = prepare('{"label":"' + 'x'.repeat(200) + '","type":"portal","url":"/x"}');
        System.assertEquals(80, buttons[0].label.length(), 'Label is capped at 80 characters');
    }

    @IsTest
    static void placementAndSizeAreNormalized() {
        System.assertEquals('Above', PortalButtons.normalizePlacement('Above'), 'Above');
        System.assertEquals('Below', PortalButtons.normalizePlacement('Below'), 'Below');
        System.assertEquals('Below', PortalButtons.normalizePlacement(null), 'Blank defaults to Below');
        System.assertEquals('Below', PortalButtons.normalizePlacement('Sideways'), 'Unknown defaults to Below');
        System.assertEquals('ust-buttons-wide', PortalButtons.normalizeSize('ust-buttons-wide'), 'Allowed size');
        System.assertEquals('', PortalButtons.normalizeSize('evil-class'), 'Unknown size is ignored');
        System.assertEquals('', PortalButtons.normalizeSize(null), 'Blank size');
    }

    @IsTest
    static void iconNormalization() {
        System.assertEquals('utility:heart', PortalButtons.normalizeIcon('Heart'), 'Case and prefix');
        System.assertEquals('utility:heart', PortalButtons.normalizeIcon('utility:heart'), 'Already prefixed');
        System.assertEquals('utility:new_window', PortalButtons.normalizeIcon(' new_window '), 'Underscores');
        System.assertEquals(null, PortalButtons.normalizeIcon('standard:account'), 'Other categories are rejected');
        System.assertEquals(null, PortalButtons.normalizeIcon('a b'), 'Spaces');
        System.assertEquals(null, PortalButtons.normalizeIcon(null), 'null');
    }

    @IsTest
    static void containsTagDetection() {
        System.assert(PortalButtons.containsTag(wrap('{"label":"{{First_Name}}"}')), 'tag present');
        System.assert(!PortalButtons.containsTag(wrap('{"label":"Go"}')), 'no tag');
        System.assert(!PortalButtons.containsTag(null), 'null');
    }

    @IsTest
    static void suggestionsAlwaysStartWithHomeForWidgetAdmins() {
        List<PortalButtons.PortalLinkSuggestion> suggestions = PortalButtons.getPortalLinkSuggestions();

        System.assert(!suggestions.isEmpty(), 'Home is always offered');
        System.assertEquals('Home', suggestions[0].label, 'Home first');
        System.assertEquals('/', suggestions[0].path, 'Home path');
        System.assertEquals(false, suggestions[0].loginRequired, 'Home does not require login');
    }

    @IsTest
    static void suggestionsAreEmptyForUsersWhoCannotEditWidgets() {
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String uniqueName = 'buttons' + String.valueOf(Crypto.getRandomInteger()).replace('-', '');
        User plainUser = new User(
                Alias = 'plain', Email = uniqueName + '@example.com', EmailEncodingKey = 'UTF-8',
                LastName = 'Plain', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
                ProfileId = standardProfile.Id, TimeZoneSidKey = 'America/Chicago',
                Username = uniqueName + '@example.com'
        );
        insert plainUser;

        List<PortalButtons.PortalLinkSuggestion> suggestions;
        System.runAs(plainUser) {
            suggestions = PortalButtons.getPortalLinkSuggestions();
        }

        System.assert(suggestions.isEmpty(), 'Users without widget edit access get nothing');
    }

    // ----- Notes (short text between links) -----

    private static String note(String html) {
        return '{"id":"n1","kind":"note","html":' + JSON.serialize(html) + '}';
    }

    private static String cleaned(String html) {
        return PortalButtons.sanitizeNote(html);
    }

    @IsTest
    static void aNoteKeepsOnlyTheAllowlistedFormattingAndLinks() {
        System.assertEquals('<p>Hello <strong>bold</strong>, <em>it</em> and <u>un</u></p>',
                cleaned('<p>Hello <strong>bold</strong>, <em>it</em> and <u>un</u></p>'), 'Allowed tags pass');
        System.assertEquals('Line<br>break', cleaned('Line<br/>break'), 'A break is rebuilt');
        System.assertEquals('<a href="https://www.stthomas.edu/x?a=1&amp;b=2">Read</a>',
                cleaned('<a href="https://www.stthomas.edu/x?a=1&b=2" target="_blank" onclick="x()">Read</a>'),
                'Only a checked href survives on a link; other attributes are dropped');
        System.assertEquals('<a href="mailto:alumni@stthomas.edu">Email</a> or <a href="tel:+16516476000">call</a>',
                cleaned('<a href=\'mailto:alumni@stthomas.edu\'>Email</a> or <a href="tel:+16516476000">call</a>'),
                'mailto and tel links are allowed');
    }

    @IsTest
    static void aNoteRemovesScriptsAttributesAndUnsafeLinks() {
        System.assertEquals('hi alert(1)', cleaned('hi <script>alert(1)</script>'), 'The script tag goes, its text is only text');
        System.assertEquals('<p>x</p>', cleaned('<p onclick="steal()" style="x" class="y">x</p>'), 'Attributes on allowed tags are dropped');
        System.assertEquals('', cleaned('<img src=x onerror=alert(1)>'), 'An image is not allowed');
        System.assertEquals('', cleaned('<iframe src="https://evil.example"></iframe>'), 'An iframe is not allowed');
        System.assertEquals('Click', cleaned('<a href="javascript:alert(1)">Click</a>'), 'A javascript link keeps only its text');
        System.assertEquals('Click', cleaned('<a href="JaVaScRiPt:alert(1)">Click</a>'), 'Case does not help');
        System.assertEquals('Click', cleaned('<a href="&#106;avascript:alert(1)">Click</a>'), 'An entity-encoded scheme does not help');
        System.assertEquals('Click', cleaned('<a href="data:text/html,hi">Click</a>'), 'A data link keeps only its text');
        System.assertEquals('Click', cleaned('<a href="http://insecure.example">Click</a>'), 'Plain http is not allowed');
        System.assertEquals('Click', cleaned('<a href="//evil.example">Click</a>'), 'A protocol-relative link is not allowed');
        System.assertEquals('Click', cleaned('<a href="/alumni-directory">Click</a>'), 'A site path is not allowed in a note');
        System.assertEquals('Click', cleaned('<a>Click</a>'), 'A link with no address keeps its text');
        System.assertEquals('Click', cleaned('<a href="https://x.edu/a b">Click</a>'), 'A link with a space is not allowed');
        System.assertEquals('<a href="https://x.edu">one two</a>', cleaned('<a href="https://x.edu">one <a href="https://y.edu">two</a></a>'),
                'A link inside a link is flattened');
    }

    @IsTest
    static void aNoteEscapesTextAndClosesWhatWasLeftOpen() {
        System.assertEquals('Q&amp;A and 1 &lt; 2', cleaned('Q&A and 1 &lt; 2'), 'A loose & is escaped; an entity the editor wrote is kept');
        System.assertEquals('a &gt; b', cleaned('a > b'), 'A loose > is escaped');
        System.assert(!cleaned('1 < 2 & 3 > 2').contains('<'), 'Raw angle brackets never come out as markup');
        System.assertEquals('<strong>open</strong>', cleaned('<strong>open'), 'An unclosed tag is closed');
        System.assertEquals('<p><em>deep</em></p>', cleaned('<p><em>deep'), 'Several unclosed tags close in order');
        System.assertEquals('stray', cleaned('stray</strong></p></a>'), 'Closing tags with nothing open are dropped');
        System.assertEquals('<strong>a<em>b</em></strong>', cleaned('<strong>a<em>b</strong></em>'), 'Crossed tags are repaired into proper nesting');
        System.assertEquals('<b>Same</b> <i>thing</i>', cleaned('<B>Same</B> <I>thing</I>'), 'Tag names are case-insensitive');
        System.assertEquals('', cleaned('   '), 'Blank is empty');
        System.assertEquals('', cleaned(null), 'Null is empty');
        System.assert(!cleaned('<a href="x>y">z</a>').contains('<a'), 'A quote hiding a > does not smuggle an attribute');
        System.assert(!cleaned('<<script>script>alert(1)').contains('<script'), 'A split tag does not rebuild into a script');
        System.assert(!cleaned('<p><p><p><p><p><p><p><p><p>x').contains('<p><p><p><p><p><p><p>'), 'Nesting depth is limited');
    }

    @IsTest
    static void cleanNoteAcceptsAGoodNoteAndRefusesWithAMessage() {
        System.assertEquals('<strong>Tip:</strong> bring a friend.', PortalButtons.cleanNote(' <strong>Tip:</strong> bring a friend. '), 'Good note, cleaned');

        List<String> bad = new List<String>{ '   ', '<p></p>', '<br>', '<script></script>', 'Hello {{First_Name}}', 'x'.repeat(PortalButtons.MAX_NOTE_HTML + 1) };
        List<String> expected = new List<String>{ 'text', 'text', 'text', 'text', 'data tags', 'too long' };
        for (Integer i = 0; i < bad.size(); i++) {
            try {
                PortalButtons.cleanNote(bad[i]);
                System.assert(false, 'Should refuse: ' + bad[i].left(30));
            } catch (AuraHandledException problem) {
                System.assert(problem.getMessage().containsIgnoreCase(expected[i]),
                        'Message for "' + bad[i].left(20) + '" should mention ' + expected[i] + ' but was: ' + problem.getMessage());
            }
        }
        System.assertEquals('x'.repeat(PortalButtons.MAX_NOTE_HTML), PortalButtons.cleanNote('x'.repeat(PortalButtons.MAX_NOTE_HTML)), 'Exactly at the limit is fine');
    }

    @IsTest
    static void theLengthLimitCountsTheFormattingToo() {
        String tagged = '<strong>x</strong>'.repeat(40);
        System.assert(tagged.length() > PortalButtons.MAX_NOTE_HTML, 'Setup: more than the limit with tags');
        try {
            PortalButtons.cleanNote(tagged);
            System.assert(false, 'Few words but many tags should be refused');
        } catch (AuraHandledException problem) {
            System.assert(problem.getMessage().containsIgnoreCase('too long'), 'Message: ' + problem.getMessage());
        }
    }

    @IsTest
    static void notesComeThroughBetweenLinksInOrderAndAreCleanedAgainOnRead() {
        String json = wrap(external('https://example.edu/a') + ',' + note('Before <strong>b</strong><script>x</script>') + ',' + portal('/alumni-directory'));

        List<PortalButtons.ButtonDto> items = PortalButtons.prepare(json, null);

        System.assertEquals(3, items.size(), 'Two links and a note');
        System.assertEquals('link', items[0].kind, 'A button is a link');
        System.assertEquals('note', items[1].kind, 'The note sits between the links');
        System.assertEquals('Before <strong>b</strong>x', items[1].html, 'Cleaned again even though it was stored');
        System.assertEquals(null, items[1].url, 'A note has no link');
        System.assertEquals('n1', items[1].id, 'Id kept');
        System.assertEquals('link', items[2].kind, 'Order kept');
    }

    @IsTest
    static void aStoredNoteThatIsEmptyTooLongOrUsesTagsIsDropped() {
        String tooLong = note('x'.repeat(PortalButtons.MAX_NOTE_HTML + 1));
        String json = wrap(note('<script></script>') + ',' + tooLong + ',' + note('Hello {{First_Name}}') + ',' + external('https://example.edu/ok'));
        List<PortalButtons.ButtonDto> items = PortalButtons.prepare(json, new Map<String, String>{ 'first_name' => 'Pat' });
        System.assertEquals(1, items.size(), 'Only the link survives');
        System.assertEquals('link', items[0].kind, 'It is the link');
    }

    @IsTest
    static void aNoteWithoutATypeIsNotMistakenForAButtonByTheOldRules() {
        // The shape an older release would see: no "type", so it is dropped there rather than shown as a link.
        Map<String, Object> asStored = (Map<String, Object>) JSON.deserializeUntyped(note('Hi'));
        System.assertEquals(null, asStored.get('type'), 'A note has no type');
        System.assertEquals('note', asStored.get('kind'), 'A note says what it is');
    }

    @IsTest
    static void thereAreLimitsOnNotesAndOnTheWholeList() {
        List<String> many = new List<String>();
        for (Integer i = 0; i < PortalButtons.MAX_NOTES + 5; i++) {
            many.add(note('Note ' + i));
        }
        List<PortalButtons.ButtonDto> notes = PortalButtons.prepare(wrap(String.join(many, ',')), null);
        System.assertEquals(PortalButtons.MAX_NOTES, notes.size(), 'Extra notes are ignored');

        List<String> links = new List<String>();
        for (Integer i = 0; i < PortalButtons.MAX_ITEMS + 10; i++) {
            links.add(external('https://example.edu/' + i));
        }
        List<PortalButtons.ButtonDto> all = PortalButtons.prepare(wrap(String.join(links, ',')), null);
        System.assertEquals(PortalButtons.MAX_ITEMS, all.size(), 'Extra items are ignored');
        System.assertEquals('https://example.edu/0', all[0].url, 'The first ones are kept');
    }

    @IsTest
    static void layoutFallsBackToARowOfButtons() {
        System.assertEquals('row', PortalButtons.normalizeLayout(null), 'Blank means a row');
        System.assertEquals('row', PortalButtons.normalizeLayout('grid'), 'Unknown means a row');
        System.assertEquals('list', PortalButtons.normalizeLayout('list'), 'List is allowed');
        System.assertEquals('list_compact', PortalButtons.normalizeLayout('list_compact'), 'Compact list is allowed');
        System.assertEquals('row', PortalButtons.normalizeLayout('row'), 'Row is allowed');
    }
}

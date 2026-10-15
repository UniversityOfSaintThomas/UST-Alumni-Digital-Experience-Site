/**
 * Tests for PortalDataTags: parsing, fallbacks, escaping, URL rules, and the directory lookup.
 */
@IsTest
private class PortalDataTags_TEST {

    private static Map<String, String> sampleValues() {
        return new Map<String, String>{
                'first_name' => 'Jordan',
                'last_name' => 'Tommie',
                'banner_id' => 'A00123456',
                'contact_id' => '003ABC',
                'employer' => 'Summit & Co'
        };
    }

    private static String html(String text) {
        return PortalDataTags.resolve(text, sampleValues(), PortalDataTags.Mode.HTML_CONTENT);
    }

    @IsTest
    static void replacesKnownTagsInHtml() {
        System.assertEquals('<p>Hello Jordan Tommie!</p>', html('<p>Hello {{First_Name}} {{Last_Name}}!</p>'), 'Both tags resolve');
    }

    @IsTest
    static void tagNamesIgnoreCaseAndTreatSpacesAsUnderscores() {
        System.assertEquals('Jordan|Jordan|Jordan', html('{{first_name}}|{{ FIRST NAME }}|{{First name}}'), 'Case and spaces are tolerated');
    }

    @IsTest
    static void unknownTagsAreLeftExactlyAsTyped() {
        System.assertEquals('Hi {{Fist_Name}} and Jordan', html('Hi {{Fist_Name}} and {{First_Name}}'), 'Unknown tag stays visible');
    }

    @IsTest
    static void blankValueBecomesEmptyOrTheFallback() {
        Map<String, String> noData = new Map<String, String>();
        System.assertEquals('Hi !', PortalDataTags.resolve('Hi {{First_Name}}!', noData, PortalDataTags.Mode.HTML_CONTENT), 'No value, no fallback');
        System.assertEquals('Hi Alum!', PortalDataTags.resolve('Hi {{First_Name|Alum}}!', noData, PortalDataTags.Mode.HTML_CONTENT), 'Fallback used');
        System.assertEquals('Hi Alum!', PortalDataTags.resolve('Hi {{First_Name|Alum}}!', null, PortalDataTags.Mode.HTML_CONTENT), 'Guest (null) uses fallback');
        System.assertEquals('Hi Jordan!', html('Hi {{First_Name|Alum}}!'), 'Value wins over fallback');
    }

    @IsTest
    static void valuesAreHtmlEscapedButFallbackIsNot() {
        Map<String, String> evil = new Map<String, String>{ 'first_name' => '<script>alert(1)</script>' };
        String result = PortalDataTags.resolve('Hi {{First_Name}}', evil, PortalDataTags.Mode.HTML_CONTENT);
        System.assert(!result.contains('<script>'), 'Script markup must not survive: ' + result);
        System.assert(result.contains('&lt;script&gt;'), 'Value is escaped: ' + result);

        System.assertEquals('Summit &amp; Co', html('{{Employer}}'), 'Ampersand in a value is escaped');
        System.assertEquals('Tom &amp; Jerry', PortalDataTags.resolve('{{First_Name|Tom &amp; Jerry}}', null, PortalDataTags.Mode.HTML_CONTENT),
                'Fallback is already HTML from the editor, so it is not escaped again');
    }

    @IsTest
    static void textModeIsPlain() {
        System.assertEquals('Summit & Co', PortalDataTags.resolve('{{Employer}}', sampleValues(), PortalDataTags.Mode.PLAIN_TEXT), 'No escaping in plain text');
    }

    @IsTest
    static void editorMarkupInsideATagIsIgnored() {
        System.assertEquals('Jordan', html('{{First_<strong>Name</strong>}}'), 'Formatting split a tag');
        System.assertEquals('Jordan', html('{{<em>First</em>_Name}}'), 'Formatting at the start');
        System.assertEquals('Jordan', html('{{First&nbsp;Name}}'), 'Non-breaking space becomes a space');
        System.assertEquals('Jordan', html('{{First' + String.fromCharArray(new List<Integer>{ 160 }) + 'Name}}'), 'Real nbsp character');
        System.assertEquals('Alum', PortalDataTags.resolve('{{First_Name|<b>Alum</b>}}', null, PortalDataTags.Mode.HTML_CONTENT), 'Markup in a fallback is dropped');
    }

    @IsTest
    static void urlModeResolvesOnlyIdentifiersAndEncodes() {
        Map<String, String> values = new Map<String, String>{ 'banner_id' => 'A 00/1', 'first_name' => 'Jordan' };
        System.assertEquals('https://x.edu/f?id=A+00%2F1', PortalDataTags.resolve('https://x.edu/f?id={{Banner_ID}}', values, PortalDataTags.Mode.LINK_URL), 'Identifier encoded');
        System.assertEquals('https://x.edu/f?n=', PortalDataTags.resolve('https://x.edu/f?n={{First_Name}}', values, PortalDataTags.Mode.LINK_URL), 'Non-identifier tags are dropped from URLs');
        System.assertEquals('https://x.edu/f?id=none', PortalDataTags.resolve('https://x.edu/f?id={{Banner_ID|none}}', null, PortalDataTags.Mode.LINK_URL), 'Fallback used in URLs');
        System.assertEquals('https://x.edu/{{Nope}}', PortalDataTags.resolve('https://x.edu/{{Nope}}', values, PortalDataTags.Mode.LINK_URL), 'Unknown tags still untouched');
    }

    @IsTest
    static void textWithoutTagsOrBlankIsReturnedUnchanged() {
        System.assertEquals(null, PortalDataTags.resolve(null, sampleValues(), PortalDataTags.Mode.HTML_CONTENT), 'null');
        System.assertEquals('', PortalDataTags.resolve('', sampleValues(), PortalDataTags.Mode.HTML_CONTENT), 'blank');
        System.assertEquals('no tags {here}', html('no tags {here}'), 'single braces are not tags');
        System.assertEquals('{{ }} and {{}}', html('{{ }} and {{}}'), 'empty tags are left alone');
    }

    @IsTest
    static void containsTagDetectsOpeners() {
        System.assert(PortalDataTags.containsTag('x {{A}}'), 'tag present');
        System.assert(!PortalDataTags.containsTag('plain'), 'no tag');
        System.assert(!PortalDataTags.containsTag(null), 'null');
    }

    @IsTest
    static void definitionsCoverEveryNamedTagAndFlagIdentifiers() {
        Map<String, PortalDataTags.TagDefinition> byName = new Map<String, PortalDataTags.TagDefinition>();
        for (PortalDataTags.TagDefinition definition : PortalDataTags.getTagDefinitions()) {
            byName.put(definition.name, definition);
            System.assert(String.isNotBlank(definition.label) && String.isNotBlank(definition.sample), 'Label and sample for ' + definition.name);
        }
        System.assertEquals(9, byName.size(), 'Nine tags');
        System.assertEquals(true, byName.get('Banner_ID').allowInUrl, 'Banner ID allowed in URLs');
        System.assertEquals(true, byName.get('Contact_Id').allowInUrl, 'Contact Id allowed in URLs');
        System.assertEquals(false, byName.get('First_Name').allowInUrl, 'Names are not allowed in URLs');
        System.assert(!byName.containsKey('Email') && !byName.containsKey('Phone') && !byName.containsKey('Birthdate'), 'Sensitive tags are absent');
    }

    @IsTest
    static void valuesComeFromTheDirectoryRecordAndPreferTheNickname() {
        Contact alum = new Contact(LastName = 'Tommie');
        insert alum;
        insert new Alumni_Directory__c(
                Contact__c = alum.Id, First_Name_Text__c = 'Jonathan', Nickname__c = 'Jon', Last_Name_Text__c = 'Tommie',
                Class_Year_Text__c = '2012', Employer_Text__c = 'Summit', Occupation_Text__c = 'Engineer', City_State__c = 'St. Paul, MN');

        Map<String, String> values = PortalDataTags.valuesForContact(alum.Id);

        System.assertEquals('Jon', values.get('first_name'), 'Nickname preferred');
        System.assertEquals('Tommie', values.get('last_name'), 'Last name');
        System.assertEquals('2012', values.get('class_year'), 'Class year');
        System.assertEquals('Engineer', values.get('job_title'), 'Job title');
        System.assertEquals('St. Paul, MN', values.get('city_state'), 'City, state');
        System.assert(values.containsKey('banner_id') && values.containsKey('contact_id'), 'Identifier keys present');
    }

    @IsTest
    static void firstNameFallsBackToTheFirstNameFieldWithoutANickname() {
        Contact alum = new Contact(LastName = 'Tommie');
        insert alum;
        insert new Alumni_Directory__c(Contact__c = alum.Id, First_Name_Text__c = 'Jonathan');

        System.assertEquals('Jonathan', PortalDataTags.valuesForContact(alum.Id).get('first_name'), 'First name when no nickname');
    }

    @IsTest
    static void contactsWithoutADirectoryRecordGetNoValues() {
        Contact alum = new Contact(LastName = 'NoDirectory');
        insert alum;
        System.assert(PortalDataTags.valuesForContact(alum.Id).isEmpty(), 'No record means no values');
    }

    @IsTest
    static void testSeamReplacesTheUserLookup() {
        PortalDataTags.testValues = new Map<String, String>{ 'first_name' => 'Seam' };
        System.assertEquals('Seam', PortalDataTags.valuesForCurrentUser().get('first_name'), 'Seam is honored');
    }
}

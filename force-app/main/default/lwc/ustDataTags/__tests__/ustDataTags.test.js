import { appendToHtml, escapeHtml, urlEncode, MODE_URL, findUnknownTags, parseTagBody, resolveTags, sampleValues, tagToken, MODE_HTML, MODE_TEXT } from 'c/ustDataTags';

const DEFINITIONS = [
    { name: 'First_Name', sample: 'Jordan' },
    { name: 'Employer', sample: 'Summit & Co' },
    { name: 'Banner_ID', sample: 'A00123456', allowInUrl: true }
];

describe('ustDataTags.parseTagBody', () => {
    it('normalizes the name and splits the fallback', () => {
        expect(parseTagBody(' First Name | Alum ')).toEqual({ key: 'first_name', name: 'First Name', fallback: 'Alum' });
    });

    it('ignores editor markup and non-breaking spaces inside a tag', () => {
        expect(parseTagBody('First_<strong>Name</strong>').key).toBe('first_name');
        expect(parseTagBody('First&nbsp;Name').key).toBe('first_name');
        expect(parseTagBody('First\u00A0Name').key).toBe('first_name');
        expect(parseTagBody('First_Name|<b>Alum</b>').fallback).toBe('Alum');
    });

    it('keeps everything after the first pipe as the fallback', () => {
        expect(parseTagBody('First_Name|a|b').fallback).toBe('a|b');
    });
});

describe('ustDataTags.findUnknownTags', () => {
    it('returns typos once each, as typed, and ignores known tags', () => {
        const text = '{{First_Name}} {{Fist_Name}} {{fist name}} {{Fist_Name}} {{Banner_ID|none}}';
        expect(findUnknownTags(text, DEFINITIONS)).toEqual(['{{Fist_Name}}', '{{fist name}}']);
    });

    it('returns nothing for text without tags or with only known tags', () => {
        expect(findUnknownTags('plain {braces}', DEFINITIONS)).toEqual([]);
        expect(findUnknownTags('{{first_name}}', DEFINITIONS)).toEqual([]);
        expect(findUnknownTags('', DEFINITIONS)).toEqual([]);
        expect(findUnknownTags(null, DEFINITIONS)).toEqual([]);
    });
});

describe('ustDataTags.resolveTags', () => {
    const values = { first_name: 'Jordan', employer: 'Summit & Co' };

    it('replaces known tags and leaves unknown ones as typed', () => {
        expect(resolveTags('Hi {{First_Name}} {{Nope}}', values, DEFINITIONS, MODE_HTML)).toBe('Hi Jordan {{Nope}}');
    });

    it('escapes values in HTML mode but not in text mode', () => {
        expect(resolveTags('{{Employer}}', values, DEFINITIONS, MODE_HTML)).toBe('Summit &amp; Co');
        expect(resolveTags('{{Employer}}', values, DEFINITIONS, MODE_TEXT)).toBe('Summit & Co');
    });

    it('never lets a value inject markup', () => {
        const evil = { first_name: '<img src=x onerror=alert(1)>' };
        const result = resolveTags('{{First_Name}}', evil, DEFINITIONS, MODE_HTML);
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;img');
    });

    it('uses the fallback when there is no value, including for guests', () => {
        expect(resolveTags('Hi {{Banner_ID|none}}', values, DEFINITIONS, MODE_HTML)).toBe('Hi none');
        expect(resolveTags('Hi {{First_Name|Alum}}', null, DEFINITIONS, MODE_HTML)).toBe('Hi Alum');
        expect(resolveTags('Hi {{First_Name}}!', {}, DEFINITIONS, MODE_HTML)).toBe('Hi !');
    });

    it('returns text without tags unchanged', () => {
        expect(resolveTags('no tags', values, DEFINITIONS, MODE_HTML)).toBe('no tags');
        expect(resolveTags('', values, DEFINITIONS, MODE_HTML)).toBe('');
        expect(resolveTags(null, values, DEFINITIONS, MODE_HTML)).toBeNull();
    });

    it('resolves tags split by formatting', () => {
        expect(resolveTags('{{First_<b>Name</b>}}', values, DEFINITIONS, MODE_HTML)).toBe('Jordan');
    });
});

describe('ustDataTags helpers', () => {
    it('builds sample values keyed by lowercase name', () => {
        expect(sampleValues(DEFINITIONS)).toEqual({ first_name: 'Jordan', employer: 'Summit & Co', banner_id: 'A00123456' });
    });

    it('formats a token', () => {
        expect(tagToken('First_Name')).toBe('{{First_Name}}');
    });

    it('escapes the characters that matter', () => {
        expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    });
});

describe('ustDataTags.appendToHtml', () => {
    it('adds the token inside the last paragraph or heading', () => {
        expect(appendToHtml('<p>Hi </p>', '{{A}}')).toBe('<p>Hi {{A}}</p>');
        expect(appendToHtml('<h2>Title</h2>\n', '{{A}}')).toBe('<h2>Title{{A}}</h2>');
        expect(appendToHtml('<ul><li>One</li></ul>', '{{A}}')).toBe('<ul><li>One</li></ul>{{A}}');
    });

    it('appends to content without a closing block, and to empty content', () => {
        expect(appendToHtml('plain', '{{A}}')).toBe('plain{{A}}');
        expect(appendToHtml('', '{{A}}')).toBe('{{A}}');
        expect(appendToHtml(null, '{{A}}')).toBe('{{A}}');
    });
});

describe('ustDataTags URL mode', () => {
    it('encodes the way Apex EncodingUtil.urlEncode does', () => {
        expect(urlEncode('A 00/1')).toBe('A+00%2F1');
        expect(urlEncode('javascript:alert(1)')).toBe('javascript%3Aalert%281%29');
        expect(urlEncode("it's ~ok!")).toBe('it%27s+%7Eok%21');
    });

    it('resolves only tags allowed in URLs and encodes them', () => {
        const values = { banner_id: 'A 00/1', first_name: 'Jordan' };
        expect(resolveTags('https://x.edu/f?id={{Banner_ID}}&n={{First_Name}}', values, DEFINITIONS, MODE_URL)).toBe(
            'https://x.edu/f?id=A+00%2F1&n='
        );
    });

    it('uses an encoded fallback and leaves unknown tags alone', () => {
        expect(resolveTags('/p/{{Banner_ID|none yet}}/{{Nope}}', {}, DEFINITIONS, MODE_URL)).toBe('/p/none+yet/{{Nope}}');
    });
});

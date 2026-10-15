import {
    isAllowedUrl, normalizeIcon, validateButton, parseButtonsJson, serializeButtons, newButton, newButtonId,
    resolveButtonsForPreview, TYPE_EXTERNAL, TYPE_PORTAL
} from 'c/ustButtonRules';

const TAGS = [
    { name: 'First_Name', label: 'First name', sample: 'Jordan', allowInUrl: false },
    { name: 'Banner_ID', label: 'Banner ID', sample: 'A001', allowInUrl: true }
];

describe('isAllowedUrl (same vectors as the Apex PortalButtons tests)', () => {
    it.each([
        'https://example.edu/a/b?x=1&y=2#top',
        'HTTPS://Example.edu',
        'mailto:alumni@example.edu?subject=Hi',
        'tel:+16515551212'
    ])('accepts external %s', (url) => {
        expect(isAllowedUrl(TYPE_EXTERNAL, url)).toBe(true);
    });

    it.each([
        'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x',
        'http://example.edu', '//evil.example.com/x', '/relative', 'https://', 'https:///nohost',
        'https://exa mple.edu', 'https://example.edu/a b', 'https://example.edu\\evil.com', 'ftp://example.edu',
        'mailto:', 'tel:abc', ' ', '', 'https://example.edu/{{Tag}}'
    ])('rejects external [%s]', (url) => {
        expect(isAllowedUrl(TYPE_EXTERNAL, url)).toBe(false);
    });

    it.each(['/alumni-directory', '/news/abc?x=1#top', '/'])('accepts portal %s', (url) => {
        expect(isAllowedUrl(TYPE_PORTAL, url)).toBe(true);
    });

    it.each(['//evil.example.com/x', 'https://example.edu', 'javascript:alert(1)', 'alumni-directory', '/has space', '/back\\slash', ''])(
        'rejects portal [%s]',
        (url) => {
            expect(isAllowedUrl(TYPE_PORTAL, url)).toBe(false);
        }
    );

    it('rejects control characters, tabs, and DEL anywhere in a link', () => {
        ['https://example.edu/a\u0001b', 'https://example.edu/a\tb', 'https://example.edu/a\nb', 'https://example.edu/\u007F', 'mailto:a@b.edu\u0000'].forEach((url) => {
            expect(isAllowedUrl(TYPE_EXTERNAL, url)).toBe(false);
        });
        ['/path\u0001', '/pa\tth', '/path\u007F'].forEach((url) => {
            expect(isAllowedUrl(TYPE_PORTAL, url)).toBe(false);
        });
    });

    it('rejects unknown types and over-long links', () => {
        expect(isAllowedUrl('script', 'https://example.edu')).toBe(false);
        expect(isAllowedUrl(TYPE_EXTERNAL, 'https://example.edu/' + 'a'.repeat(2100))).toBe(false);
    });
});

describe('normalizeIcon', () => {
    it('normalizes to a utility icon or null', () => {
        expect(normalizeIcon('Heart')).toBe('utility:heart');
        expect(normalizeIcon('utility:heart')).toBe('utility:heart');
        expect(normalizeIcon(' new_window ')).toBe('utility:new_window');
        expect(normalizeIcon('standard:account')).toBeNull();
        expect(normalizeIcon('a b')).toBeNull();
        expect(normalizeIcon('')).toBeNull();
        expect(normalizeIcon(null)).toBeNull();
    });
});

describe('validateButton', () => {
    const valid = { label: 'Give', type: TYPE_EXTERNAL, url: 'https://example.edu', icon: '' };

    it('accepts a valid button', () => {
        expect(validateButton(valid, TAGS)).toEqual({});
    });

    it('requires text, a type, and a link', () => {
        expect(Object.keys(validateButton({ label: '', type: '', url: '' }, TAGS)).sort()).toEqual(['label', 'type', 'url']);
    });

    it('limits the text length', () => {
        expect(validateButton({ ...valid, label: 'x'.repeat(81) }, TAGS).label).toContain('80');
    });

    it('explains the link rule for each type', () => {
        expect(validateButton({ ...valid, url: 'javascript:alert(1)' }, TAGS).url).toContain('https://');
        expect(validateButton({ ...valid, type: TYPE_PORTAL, url: 'alumni-directory' }, TAGS).url).toContain('single /');
        expect(validateButton({ ...valid, type: TYPE_PORTAL, url: '//evil.com' }, TAGS).url).toContain('single /');
    });

    it('judges a link with tags as it will look once filled in', () => {
        expect(validateButton({ ...valid, url: 'https://example.edu/f?id={{Banner_ID}}' }, TAGS)).toEqual({});
        expect(validateButton({ ...valid, type: TYPE_PORTAL, url: '/people/{{Banner_ID}}' }, TAGS)).toEqual({});
    });

    it('rejects unknown tags and tags not allowed in links', () => {
        expect(validateButton({ ...valid, url: 'https://example.edu/{{Fist_Name}}' }, TAGS).url).toContain('Unknown data tag');
        expect(validateButton({ ...valid, url: 'https://example.edu/{{First_Name}}' }, TAGS).url).toContain('identifier tags');
    });

    it('checks the icon only when given', () => {
        expect(validateButton({ ...valid, icon: 'heart' }, TAGS)).toEqual({});
        expect(validateButton({ ...valid, icon: 'a b' }, TAGS).icon).toContain('utility icon');
    });
});

describe('parseButtonsJson / serializeButtons', () => {
    it('round-trips buttons', () => {
        const buttons = [
            { id: 'a', label: ' Give ', type: TYPE_EXTERNAL, url: ' https://example.edu ', newTab: false, style: 'neutral', align: 'center', icon: 'Heart' },
            { id: 'b', label: 'Dir', type: TYPE_PORTAL, url: '/alumni-directory', newTab: true, style: 'brand', align: 'end', icon: '' }
        ];
        const json = serializeButtons(buttons);
        expect(JSON.parse(json).version).toBe(1);
        const back = parseButtonsJson(json);
        expect(back[0]).toEqual({ id: 'a', label: 'Give', type: 'external', url: 'https://example.edu', newTab: false, style: 'neutral', align: 'center', icon: 'utility:heart' });
        expect(back[1].newTab).toBe(false); // portal links never open a new tab
    });

    it('stores nothing for an empty list', () => {
        expect(serializeButtons([])).toBe('');
        expect(serializeButtons(null)).toBe('');
    });

    it('reads bad data as an empty list and fills in defaults', () => {
        expect(parseButtonsJson('')).toEqual([]);
        expect(parseButtonsJson('{not json')).toEqual([]);
        expect(parseButtonsJson('[]')).toEqual([]);
        expect(parseButtonsJson('{"buttons":"x"}')).toEqual([]);
        const [button] = parseButtonsJson('{"buttons":[null,{"label":"Go","style":"rainbow","align":"sideways"}]}');
        expect(button).toMatchObject({ id: 'b1', label: 'Go', type: 'external', style: 'brand', align: 'left', newTab: true });
    });
});

describe('newButton / ids', () => {
    it('creates distinct ids and sensible defaults', () => {
        const first = newButton();
        expect(first).toMatchObject({ type: 'external', style: 'brand', align: 'left', newTab: true, label: '', url: '' });
        expect(newButtonId()).not.toBe(newButtonId());
        expect(newButton(TYPE_PORTAL).type).toBe('portal');
    });
});

describe('resolveButtonsForPreview', () => {
    const values = { first_name: 'Jordan', banner_id: 'A 00/1' };

    it('fills in tags, encodes link values, and drops invalid buttons', () => {
        const buttons = [
            { id: 'a', label: 'Hi {{First_Name|friend}}', type: TYPE_EXTERNAL, url: 'https://x.edu/f?id={{Banner_ID}}', newTab: true, style: 'brand', align: 'left', icon: 'heart' },
            { id: 'b', label: 'Bad', type: TYPE_EXTERNAL, url: 'javascript:alert(1)', style: 'brand', align: 'left' },
            { id: 'c', label: '{{First_Name}}', type: TYPE_PORTAL, url: '/x' }
        ];
        const guest = resolveButtonsForPreview(buttons, {}, TAGS);
        expect(guest.map((button) => button.id)).toEqual(['a']);
        expect(guest[0].label).toBe('Hi friend');

        const signedIn = resolveButtonsForPreview(buttons, values, TAGS);
        expect(signedIn.map((button) => button.id)).toEqual(['a', 'c']);
        expect(signedIn[0]).toMatchObject({ label: 'Hi Jordan', url: 'https://x.edu/f?id=A+00%2F1', newTab: true, icon: 'utility:heart' });
        expect(signedIn[1].label).toBe('Jordan');
    });

    it('never opens mailto or portal links in a new tab', () => {
        const [mail] = resolveButtonsForPreview([{ id: 'm', label: 'Mail', type: TYPE_EXTERNAL, url: 'mailto:a@b.edu', newTab: true }], {}, TAGS);
        expect(mail.newTab).toBe(false);
    });
});

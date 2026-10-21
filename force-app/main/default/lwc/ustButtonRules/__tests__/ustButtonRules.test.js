import {
    isAllowedUrl, normalizeIcon, validateButton, parseButtonsJson, serializeButtons, newButton, newButtonId,
    resolveButtonsForPreview, TYPE_EXTERNAL, TYPE_PORTAL,
    isNote, isListLayout, newNote, noteLength, noteText, MAX_NOTE_HTML, MAX_NOTES, MAX_ITEMS, LAYOUT_OPTIONS
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

describe('notes (short text between links)', () => {
    const link = (id = 'a') => ({ id, label: 'Go', type: 'external', url: 'https://example.edu/' + id, newTab: true, style: 'brand', align: 'left', icon: '' });
    const note = (html, id = 'n1') => ({ id, kind: 'note', html });

    it('tells a note from a button and a links list from a row', () => {
        expect(isNote(note('x'))).toBe(true);
        expect(isNote(link())).toBe(false);
        expect(isNote(null)).toBe(false);
        expect(isListLayout('list')).toBe(true);
        expect(isListLayout('list_compact')).toBe(true);
        expect(isListLayout('row')).toBe(false);
        expect(isListLayout(undefined)).toBe(false);
        expect(LAYOUT_OPTIONS.map((option) => option.value)).toEqual(['row', 'list', 'list_compact']);
    });

    it('creates a note with its own id, apart from button ids', () => {
        const first = newNote();
        const second = newNote();
        expect(first.kind).toBe('note');
        expect(first.html).toBe('');
        expect(first.id).not.toBe(second.id);
        expect(first.id.startsWith('n')).toBe(true);
    });

    it('stores a note without a type, so an older release drops it instead of showing a broken button', () => {
        const stored = JSON.parse(serializeButtons([link(), note('<strong>Hi</strong>')]));
        expect(stored.buttons[1]).toEqual({ id: 'n1', kind: 'note', html: '<strong>Hi</strong>' });
        expect(stored.buttons[1].type).toBeUndefined();
        expect(stored.buttons[1].url).toBeUndefined();
    });

    it('round-trips links and notes in order', () => {
        const items = [link('a'), note('Between'), link('b')];
        const back = parseButtonsJson(serializeButtons(items));
        expect(back.map((item) => (isNote(item) ? 'note' : item.id))).toEqual(['a', 'note', 'b']);
        expect(back[1].html).toBe('Between');
    });

    it('reads a damaged note leniently', () => {
        const back = parseButtonsJson(JSON.stringify({ version: 1, buttons: [{ kind: 'note' }, { kind: 'note', id: 5, html: 7 }] }));
        expect(back).toHaveLength(2);
        expect(back[0]).toEqual({ id: 'n1', kind: 'note', html: '' });
        expect(back[1].html).toBe('');
    });

    it('counts a note\'s length the way the server does, tags included', () => {
        expect(noteLength('<strong>x</strong>')).toBe(18);
        expect(noteLength(null)).toBe(0);
        expect(MAX_NOTE_HTML).toBe(500);
        expect(MAX_NOTES).toBe(10);
        expect(MAX_ITEMS).toBe(40);
    });

    it('summarises a note as its words', () => {
        expect(noteText('<p>Meetings are <strong>monthly</strong>.&nbsp;<a href="https://x.edu">Details</a></p>')).toBe('Meetings are monthly . Details');
        expect(noteText('')).toBe('');
        expect(noteText(undefined)).toBe('');
    });

    describe('in the admin preview', () => {
        const preview = (items) => resolveButtonsForPreview(items, {}, []);

        it('passes a note through between links, in order', () => {
            const shown = preview([link('a'), note('Hello'), link('b')]);
            expect(shown.map((item) => (isNote(item) ? 'note' : item.id))).toEqual(['a', 'note', 'b']);
            expect(shown[1].html).toBe('Hello');
        });

        it('drops a note that is empty, has only tags, uses a data tag, or is too long', () => {
            const shown = preview([note(''), note('<p></p>', 'n2'), note('Hi {{First_Name}}', 'n3'), note('x'.repeat(MAX_NOTE_HTML + 1), 'n4'), note('x'.repeat(MAX_NOTE_HTML), 'n5')]);
            expect(shown.map((item) => item.id)).toEqual(['n5']);
        });

        it('keeps at most 10 notes and looks at only the first 40 items, as the server does', () => {
            const notes = Array.from({ length: MAX_NOTES + 3 }, (_, i) => note('Note ' + i, 'n' + i));
            expect(preview(notes)).toHaveLength(MAX_NOTES);
            const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => link('l' + i));
            expect(preview(many)).toHaveLength(MAX_ITEMS);
            expect(preview(many)[0].id).toBe('l0');
        });

        it('counts a dropped button towards the 40 the server looks at', () => {
            const bad = { id: 'bad', label: '', type: 'external', url: 'https://x.edu' };
            const items = [...Array.from({ length: MAX_ITEMS }, () => bad), link('late')];
            expect(preview(items)).toHaveLength(0);
        });
    });
});

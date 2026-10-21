import { createElement } from 'lwc';
import UstWidgetButtons from 'c/ustWidgetButtons';
import { __navigateMock, __generateUrlMock } from 'lightning/navigation';

jest.mock(
    'lightning/navigation',
    () => {
        const Navigate = Symbol('Navigate');
        const GenerateUrl = Symbol('GenerateUrl');
        const navigateMock = jest.fn();
        const generateUrlMock = jest.fn((reference) => Promise.resolve('/alumni' + reference.attributes.url));
        const NavigationMixin = (Base) =>
            class extends Base {
                [Navigate](reference) {
                    navigateMock(reference);
                }
                [GenerateUrl](reference) {
                    return generateUrlMock(reference);
                }
            };
        NavigationMixin.Navigate = Navigate;
        NavigationMixin.GenerateUrl = GenerateUrl;
        return { NavigationMixin, __navigateMock: navigateMock, __generateUrlMock: generateUrlMock };
    }
);

function button(overrides = {}) {
    return { id: 'b1', label: 'Give', type: 'external', url: 'https://example.edu/give', newTab: true, style: 'brand', align: 'left', icon: null, ...overrides };
}

async function createRenderer(properties = {}) {
    const element = createElement('c-ust-widget-buttons', { is: UstWidgetButtons });
    Object.assign(element, properties);
    document.body.appendChild(element);
    await Promise.resolve();
    await Promise.resolve();
    return element;
}

function links(element) {
    return Array.from(element.shadowRoot.querySelectorAll('a'));
}

describe('c-ust-widget-buttons', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders nothing without buttons', async () => {
        const element = await createRenderer({ buttons: [] });
        expect(element.shadowRoot.querySelector('.ust-widget-buttons')).toBeNull();
    });

    it('renders real links with the chosen style', async () => {
        const element = await createRenderer({ buttons: [button(), button({ id: 'b2', label: 'More', style: 'outline-brand' })] });
        const rendered = links(element);
        expect(rendered).toHaveLength(2);
        expect(rendered[0].getAttribute('href')).toBe('https://example.edu/give');
        expect(rendered[0].className).toContain('slds-button_brand');
        expect(rendered[1].className).toContain('slds-button_outline-brand');
        expect(rendered[0].textContent).toContain('Give');
    });

    it('opens external https links in a new tab safely and tells screen readers', async () => {
        const element = await createRenderer({ buttons: [button()] });
        const link = links(element)[0];
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        expect(link.textContent).toContain('(opens in a new tab)');
    });

    it('does not open a new tab when the button says not to, or for mailto and tel', async () => {
        const element = await createRenderer({
            buttons: [button({ newTab: false }), button({ id: 'b2', url: 'mailto:a@b.edu', newTab: true }), button({ id: 'b3', url: 'tel:+16515551212' })]
        });
        links(element).forEach((link) => {
            expect(link.getAttribute('target')).toBeNull();
            expect(link.textContent).not.toContain('(opens in a new tab)');
        });
    });

    it('resolves portal paths with the platform so the site base path is added', async () => {
        const element = await createRenderer({ buttons: [button({ id: 'p', type: 'portal', url: '/alumni-directory', newTab: false })] });
        expect(__generateUrlMock).toHaveBeenCalledWith({ type: 'standard__webPage', attributes: { url: '/alumni-directory' } });
        const link = links(element)[0];
        expect(link.getAttribute('href')).toBe('/alumni/alumni-directory');
        expect(link.getAttribute('target')).toBeNull();
    });

    it('asks for the portal address only once the component is connected', async () => {
        const element = createElement('c-ust-widget-buttons', { is: UstWidgetButtons });
        element.buttons = [button({ id: 'p', type: 'portal', url: '/alumni-directory', newTab: false })];
        expect(__generateUrlMock).not.toHaveBeenCalled();

        document.body.appendChild(element);
        await Promise.resolve();
        await Promise.resolve();

        expect(__generateUrlMock).toHaveBeenCalledTimes(1);
        expect(links(element)[0].getAttribute('href')).toBe('/alumni/alumni-directory');
    });

    it('resolves a portal button added after the component is connected, without repeating work', async () => {
        const element = await createRenderer({ buttons: [button({ id: 'p', type: 'portal', url: '/one', newTab: false })] });
        element.buttons = [
            button({ id: 'p', type: 'portal', url: '/one', newTab: false }),
            button({ id: 'q', type: 'portal', url: '/two', newTab: false })
        ];
        await Promise.resolve();
        await Promise.resolve();

        expect(__generateUrlMock).toHaveBeenCalledTimes(2);
        expect(links(element).map((link) => link.getAttribute('href'))).toEqual(['/alumni/one', '/alumni/two']);
    });

    it('navigates within the app on a plain click of a portal link', async () => {
        const element = await createRenderer({ buttons: [button({ id: 'p', type: 'portal', url: '/alumni-directory' })] });
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        links(element)[0].dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(__navigateMock).toHaveBeenCalledWith({ type: 'standard__webPage', attributes: { url: '/alumni-directory' } });
    });

    it('leaves modified clicks (new tab) and external links to the browser', async () => {
        const element = await createRenderer({
            buttons: [button({ id: 'p', type: 'portal', url: '/alumni-directory' }), button({ id: 'e' })]
        });
        const [portalLink, externalLink] = links(element);
        const ctrlClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
        portalLink.dispatchEvent(ctrlClick);
        const externalClick = new MouseEvent('click', { bubbles: true, cancelable: true });
        externalLink.dispatchEvent(externalClick);

        expect(ctrlClick.defaultPrevented).toBe(false);
        expect(externalClick.defaultPrevented).toBe(false);
        expect(__navigateMock).not.toHaveBeenCalled();
    });

    it.each([
        'javascript:alert(1)', 'data:text/html,x', '//evil.example.com', 'http://example.edu', 'https://exa mple.edu', ''
    ])('never renders an unsafe external link [%s]', async (url) => {
        const element = await createRenderer({ buttons: [button({ url })] });
        expect(links(element)).toHaveLength(0);
    });

    it('never renders an unsafe portal path, or a button without text', async () => {
        const element = await createRenderer({
            buttons: [button({ id: 'a', type: 'portal', url: '//evil.example.com' }), button({ id: 'b', type: 'portal', url: 'no-slash' }), button({ id: 'c', label: '' })]
        });
        expect(links(element)).toHaveLength(0);
    });

    it('groups consecutive buttons with the same alignment into one row', async () => {
        const element = await createRenderer({
            buttons: [
                button({ id: 'a', align: 'left' }), button({ id: 'b', align: 'left' }),
                button({ id: 'c', align: 'center' }), button({ id: 'd', align: 'left' })
            ]
        });
        const rows = Array.from(element.shadowRoot.querySelectorAll('.ust-button-row'));
        expect(rows.map((row) => row.querySelectorAll('a').length)).toEqual([2, 1, 1]);
        expect(rows[1].className).toContain('ust-button-row_center');
    });

    it('shows an icon only when one is set', async () => {
        const element = await createRenderer({ buttons: [button({ icon: 'utility:heart' }), button({ id: 'b2' })] });
        const icons = element.shadowRoot.querySelectorAll('lightning-icon');
        expect(icons).toHaveLength(1);
        expect(icons[0].iconName).toBe('utility:heart');
    });

    it('applies only allowlisted size classes', async () => {
        const wide = await createRenderer({ buttons: [button()], buttonSize: 'ust-buttons-wide' });
        expect(wide.shadowRoot.querySelector('.ust-widget-buttons').className).toContain('ust-buttons-wide');
        const bogus = await createRenderer({ buttons: [button()], buttonSize: 'evil-class' });
        expect(bogus.shadowRoot.querySelector('.ust-widget-buttons').className).toBe('ust-widget-buttons');
    });

    it('adds the over-picture class only when asked', async () => {
        const plain = await createRenderer({ buttons: [button()] });
        expect(plain.shadowRoot.querySelector('.ust-widget-buttons').className).not.toContain('ust-buttons-on-image');
        const overImage = await createRenderer({ buttons: [button()], overImage: true });
        expect(overImage.shadowRoot.querySelector('.ust-widget-buttons').className).toContain('ust-buttons-on-image');
    });

    it('adds the dark-background class, without the over-picture look, when told it is on a dark background', async () => {
        const dark = await createRenderer({ buttons: [button()], darkBackground: true });
        const container = dark.shadowRoot.querySelector('.ust-widget-buttons');
        expect(container.className).toContain('ust-on-dark');
        expect(container.className).not.toContain('ust-buttons-on-image');
        const plain = await createRenderer({ buttons: [button()] });
        expect(plain.shadowRoot.querySelector('.ust-widget-buttons').className).not.toContain('ust-on-dark');
    });

    it('draws an arrow link: its own class, an underlined label, and an arrow that screen readers skip', async () => {
        const element = await createRenderer({
            buttons: [button({ id: 'a1', style: 'arrow_link', label: 'Read stories' }), button({ id: 'a2', style: 'text_link', label: 'Plain' })]
        });
        const [arrow, plain] = links(element);
        expect(arrow.className).toContain('ust-arrow-link');
        expect(arrow.className).not.toContain('slds-button');
        expect(arrow.className).not.toContain('ust-widget-button');
        expect(arrow.querySelector('.ust-arrow-link__label').textContent).toBe('Read stories');
        const icon = arrow.querySelector('svg.ust-arrow-link__icon');
        expect(icon).not.toBeNull();
        expect(icon.getAttribute('aria-hidden')).toBe('true');
        // other link styles get no arrow
        expect(plain.querySelector('svg')).toBeNull();
        expect(plain.className).toBe('ust-link');
    });

    it('draws solid and outline buttons as pills with our layout class', async () => {
        const element = await createRenderer({ buttons: [button(), button({ id: 'b2', style: 'outline-brand' })] });
        links(element).forEach((link) => expect(link.className).toContain('ust-widget-button'));
    });

    it('draws buttons in preview mode without links that go anywhere', async () => {
        const element = await createRenderer({
            previewMode: true,
            buttons: [button(), button({ id: 'p', type: 'portal', url: '/x' })]
        });
        const rendered = links(element);
        expect(rendered).toHaveLength(2);
        rendered.forEach((link) => {
            expect(link.getAttribute('href')).toBe('#');
            expect(link.getAttribute('target')).toBeNull();
            const event = new MouseEvent('click', { bubbles: true, cancelable: true });
            link.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        });
        expect(__generateUrlMock).not.toHaveBeenCalled();
        expect(__navigateMock).not.toHaveBeenCalled();
    });

    describe('links list layouts and notes', () => {
        const note = (html, id = 'n1') => ({ id, kind: 'note', html });
        const flushAll = async () => {
            for (let i = 0; i < 6; i++) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.resolve();
            }
        };
        const rowsOf = (element) => Array.from(element.shadowRoot.querySelectorAll('a.ust-list-row'));
        const items = (element) => Array.from(element.shadowRoot.querySelectorAll('li'));
        const container = (element) => element.shadowRoot.querySelector('.ust-widget-buttons');
        const three = () => [
            button({ id: 'a', label: 'Volunteer', url: 'https://example.edu/v', newTab: false }),
            note('Meetings are <strong>monthly</strong>.'),
            button({ id: 'b', label: 'Mentor', type: 'portal', url: '/mentor' })
        ];

        it('draws a row of buttons, as before, when no layout is chosen or the value is unknown', async () => {
            for (const buttonLayout of [undefined, '', 'row', 'grid', '__proto__']) {
                const element = await createRenderer({ buttons: [button()], buttonLayout });
                expect(element.shadowRoot.querySelector('ul')).toBeNull();
                expect(links(element)).toHaveLength(1);
                expect(container(element).className).not.toContain('ust-links-list');
            }
        });

        it('draws a list: one list item per link, with the label and an arrow that screen readers skip', async () => {
            const element = await createRenderer({ buttons: [button({ label: 'Volunteer', newTab: false }), button({ id: 'b2', label: 'Mentor' })], buttonLayout: 'list' });
            const list = element.shadowRoot.querySelector('ul');
            expect(list.className).toContain('ust-links-list');
            expect(list.className).not.toContain('ust-links-list_compact');
            expect(items(element)).toHaveLength(2);
            const first = rowsOf(element)[0];
            expect(first.querySelector('.ust-list-row__label').textContent).toBe('Volunteer');
            expect(first.querySelector('.ust-list-row__arrow').getAttribute('aria-hidden')).toBe('true');
            expect(first.querySelector('svg')).not.toBeNull();
            expect(first.getAttribute('href')).toBe('https://example.edu/give');
        });

        it('draws the compact list for a sidebar', async () => {
            const element = await createRenderer({ buttons: [button()], buttonLayout: 'list_compact' });
            expect(element.shadowRoot.querySelector('ul').className).toContain('ust-links-list_compact');
        });

        it('puts the links in the list in their stored order with notes between them', async () => {
            const element = await createRenderer({ buttons: three(), buttonLayout: 'list' });
            const kinds = items(element).map((item) => (item.querySelector('a') ? 'link' : 'note'));
            expect(kinds).toEqual(['link', 'note', 'link']);
            expect(items(element)[1].querySelector('lightning-formatted-rich-text').value).toBe('Meetings are <strong>monthly</strong>.');
        });

        it('ignores a link\'s own style, position and icon in a list', async () => {
            const element = await createRenderer({ buttons: [button({ style: 'destructive', align: 'end', icon: 'utility:heart' })], buttonLayout: 'list' });
            const row = rowsOf(element)[0];
            expect(row.className).toBe('ust-list-row');
            expect(row.querySelector('lightning-icon')).toBeNull();
        });

        it('keeps the link safety rules in a list: an unsafe or label-less link is not drawn', async () => {
            const element = await createRenderer({
                buttonLayout: 'list',
                buttons: [button({ id: 'x', url: 'javascript:alert(1)' }), button({ id: 'y', label: '' }), button({ id: 'z', type: 'portal', url: '//evil.example' }), button({ id: 'ok', label: 'Fine', newTab: false })]
            });
            expect(rowsOf(element)).toHaveLength(1);
            expect(rowsOf(element)[0].querySelector('.ust-list-row__label').textContent).toBe('Fine');
        });

        it('opens a new tab only for an https link, and says so, in a list', async () => {
            const element = await createRenderer({
                buttonLayout: 'list',
                buttons: [button({ id: 'a', newTab: true }), button({ id: 'b', url: 'mailto:a@b.edu', newTab: true }), button({ id: 'c', newTab: false })]
            });
            const [web, mail, same] = rowsOf(element);
            expect(web.getAttribute('target')).toBe('_blank');
            expect(web.getAttribute('rel')).toBe('noopener noreferrer');
            expect(web.textContent).toContain('(opens in a new tab)');
            expect(mail.getAttribute('target')).toBeNull();
            expect(same.getAttribute('target')).toBeNull();
        });

        it('navigates inside the site on a plain click of a portal row, but leaves a modified click to the browser', async () => {
            const element = await createRenderer({ buttonLayout: 'list', buttons: [button({ type: 'portal', url: '/mentor', label: 'Mentor' })] });
            await flushAll();
            expect(rowsOf(element)[0].getAttribute('href')).toBe('/alumni/mentor');
            const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
            rowsOf(element)[0].dispatchEvent(plain);
            expect(plain.defaultPrevented).toBe(true);
            expect(__navigateMock).toHaveBeenCalledWith({ type: 'standard__webPage', attributes: { url: '/mentor' } });
            __navigateMock.mockClear();
            const modified = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
            rowsOf(element)[0].dispatchEvent(modified);
            expect(modified.defaultPrevented).toBe(false);
            expect(__navigateMock).not.toHaveBeenCalled();
        });

        it('does nothing when a row is clicked in the admin preview', async () => {
            const element = await createRenderer({ buttonLayout: 'list', previewMode: true, buttons: [button({ type: 'portal', url: '/mentor' })] });
            expect(rowsOf(element)[0].getAttribute('href')).toBe('#');
            const click = new MouseEvent('click', { bubbles: true, cancelable: true });
            rowsOf(element)[0].dispatchEvent(click);
            expect(click.defaultPrevented).toBe(true);
            expect(__navigateMock).not.toHaveBeenCalled();
            expect(__generateUrlMock).not.toHaveBeenCalled();
        });

        it('marks the list as on a dark background for a dark panel or a picture, not otherwise', async () => {
            const light = await createRenderer({ buttons: [button()], buttonLayout: 'list' });
            expect(container(light).className).not.toContain('ust-on-dark');
            const dark = await createRenderer({ buttons: [button()], buttonLayout: 'list', darkBackground: true });
            expect(container(dark).className).toContain('ust-on-dark');
            const picture = await createRenderer({ buttons: [button()], buttonLayout: 'list_compact', overImage: true });
            expect(container(picture).className).toContain('ust-on-dark');
        });

        it('draws a note between buttons in a row layout, as its own block that ends the row before it', async () => {
            const element = await createRenderer({ buttons: three() });
            const blocks = Array.from(container(element).children).map((child) => (child.classList.contains('ust-note-row') ? 'note' : 'row'));
            expect(blocks).toEqual(['row', 'note', 'row']);
            expect(links(element)).toHaveLength(2);
            expect(element.shadowRoot.querySelector('.ust-note-row lightning-formatted-rich-text').value).toContain('monthly');
        });

        it('does not draw a note that is empty, only spaces, or missing its text', async () => {
            const element = await createRenderer({ buttonLayout: 'list', buttons: [note(''), note('   ', 'n2'), { id: 'n3', kind: 'note' }, { id: 'n4', kind: 'note', html: 42 }, button()] });
            expect(items(element)).toHaveLength(1);
            const row = await createRenderer({ buttons: [note('')] });
            expect(row.shadowRoot.querySelector('.ust-widget-buttons')).toBeNull();
        });

        it('draws a note even when there are no links, so a text-only list is possible', async () => {
            const element = await createRenderer({ buttonLayout: 'list', buttons: [note('Coming soon.')] });
            expect(items(element)).toHaveLength(1);
            expect(rowsOf(element)).toHaveLength(0);
        });

        it('treats a note as text and never as a link, whatever else is stored on it', async () => {
            const element = await createRenderer({ buttonLayout: 'list', buttons: [{ id: 'n', kind: 'note', html: 'Hello', type: 'external', url: 'https://x.edu', label: 'Sneaky' }] });
            expect(rowsOf(element)).toHaveLength(0);
            expect(items(element)[0].querySelector('lightning-formatted-rich-text')).not.toBeNull();
        });
    });
});

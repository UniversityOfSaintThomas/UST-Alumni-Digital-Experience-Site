import { createElement } from 'lwc';
import UstStaticContent from 'c/ustStaticContent';

function createContent(properties = {}) {
    const element = createElement('c-ust-static-content', { is: UstStaticContent });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

function getWrapper(element) {
    return element.shadowRoot.querySelector('.ust-static-content');
}

describe('c-ust-static-content', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders nothing when there is no content', () => {
        const element = createContent();
        expect(getWrapper(element)).toBeNull();
    });

    it('renders the content and header', () => {
        const element = createContent({ richTextContent: '<p>Hello</p>', textHeader: 'Welcome' });
        expect(getWrapper(element)).not.toBeNull();
        expect(element.shadowRoot.querySelector('h2').textContent).toBe('Welcome');
        expect(element.shadowRoot.querySelector('lightning-formatted-rich-text').value).toBe('<p>Hello</p>');
    });

    it('omits the header when none is set', () => {
        const element = createContent({ richTextContent: '<p>Hello</p>' });
        expect(element.shadowRoot.querySelector('h2')).toBeNull();
    });

    it.each([
        'ust-content-callout',
        'ust-content-inverse',
        'ust-content-centered',
        'ust-content-muted'
    ])('adds the allowed class %s to the wrapper', (className) => {
        const element = createContent({ richTextContent: '<p>Hello</p>', contentClass: className });
        expect(getWrapper(element).classList.contains(className)).toBe(true);
    });

    it('ignores a class that is not on the allowlist', () => {
        const element = createContent({ richTextContent: '<p>Hello</p>', contentClass: 'evil-class' });
        expect(getWrapper(element).className).toBe('ust-static-content');
    });

    describe('slot for a parent widget (Card Grid)', () => {
        it('puts the slot last, after the header, text and buttons', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', textHeader: 'Head', buttons: [{ id: 'b', label: 'Go', type: 'external', url: 'https://x.edu', newTab: false, style: 'brand', align: 'left', icon: null }] });
            const kinds = Array.from(getWrapper(element).children).map((child) => child.tagName.toLowerCase());
            expect(kinds[kinds.length - 1]).toBe('slot');
        });

        it('draws nothing for an empty widget, unless the parent has content for the slot', () => {
            expect(createContent({}).shadowRoot.querySelector('.ust-static-content')).toBeNull();
            expect(createContent({ hasSlotContent: false }).shadowRoot.querySelector('.ust-static-content')).toBeNull();
            expect(createContent({ hasSlotContent: true }).shadowRoot.querySelector('.ust-static-content')).not.toBeNull();
        });

        it('still gets its panel and accent when the only content is the slot', () => {
            const element = createContent({ hasSlotContent: true, sectionBackground: 'dark_purple', sectionAccent: 'green_circles' });
            const classes = getWrapper(element).className.split(' ');
            expect(classes).toEqual(expect.arrayContaining(['ust-bg-dark-purple', 'ust-on-dark', 'ust-has-accent']));
        });
    });

    describe('section background and accent', () => {
        const BTN = [{ id: 'b1', label: 'Go', type: 'external', url: 'https://example.edu', newTab: false, style: 'brand', align: 'left', icon: null }];
        const content = (extra = {}) => createContent({ richTextContent: '<p>Hi</p>', textHeader: 'Head', buttons: BTN, ...extra });
        const wrapperClasses = (element) => getWrapper(element).className.split(' ');

        it.each([
            ['white', 'ust-bg-white', false],
            ['gray', 'ust-bg-gray', false],
            ['light_purple', 'ust-bg-light-purple', false],
            ['purple', 'ust-bg-purple', true],
            ['dark_purple', 'ust-bg-dark-purple', true]
        ])('paints a %s panel (%s) and switches text and buttons to light only when it is dark (%s)', (value, className, dark) => {
            const element = content({ sectionBackground: value });
            const classes = wrapperClasses(element);
            expect(classes).toContain('ust-bg');
            expect(classes).toContain(className);
            expect(classes.includes('ust-on-dark')).toBe(dark);
            expect(element.shadowRoot.querySelector('c-ust-widget-buttons').darkBackground).toBe(dark);
        });

        it('draws no panel without a background, and ignores an unknown value', () => {
            [undefined, '', 'hot_pink', '__proto__'].forEach((value) => {
                const classes = wrapperClasses(content({ sectionBackground: value }));
                expect(classes).not.toContain('ust-bg');
                expect(classes.some((name) => name.startsWith('ust-bg-'))).toBe(false);
            });
        });

        it('keeps the older Callout and Purple Banner styles working by treating them as Light Purple and Purple panels', () => {
            const callout = wrapperClasses(content({ contentClass: 'ust-content-callout' }));
            expect(callout).toEqual(expect.arrayContaining(['ust-bg', 'ust-bg-light-purple', 'ust-content-callout']));
            expect(callout).not.toContain('ust-on-dark');

            const banner = content({ contentClass: 'ust-content-inverse' });
            expect(wrapperClasses(banner)).toEqual(expect.arrayContaining(['ust-bg-purple', 'ust-content-inverse', 'ust-on-dark']));
            expect(banner.shadowRoot.querySelector('c-ust-widget-buttons').darkBackground).toBe(true);
        });

        it('lets a chosen Section Background replace the older panel looks, but still combine with centered and muted', () => {
            const replaced = wrapperClasses(content({ contentClass: 'ust-content-callout', sectionBackground: 'dark_purple' }));
            expect(replaced).toContain('ust-bg-dark-purple');
            expect(replaced).not.toContain('ust-bg-light-purple');
            expect(replaced).not.toContain('ust-content-callout');
            expect(replaced).toContain('ust-on-dark');

            const lightened = wrapperClasses(content({ contentClass: 'ust-content-inverse', sectionBackground: 'gray' }));
            expect(lightened).toContain('ust-bg-gray');
            expect(lightened).not.toContain('ust-on-dark');

            const combined = wrapperClasses(content({ contentClass: 'ust-content-centered', sectionBackground: 'purple' }));
            expect(combined).toEqual(expect.arrayContaining(['ust-bg-purple', 'ust-content-centered', 'ust-on-dark']));
        });

        it('has no panel of its own over a picture, whatever the background says', () => {
            const classes = wrapperClasses(content({ overImage: true, sectionBackground: 'dark_purple', sectionAccent: 'green_circles' }));
            expect(classes).toContain('ust-on-image');
            expect(classes).not.toContain('ust-bg');
            expect(classes).not.toContain('ust-has-accent');
        });

        it.each([
            ['green_circles', 'ust-accent-green'],
            ['purple_circles', 'ust-accent-purple']
        ])('draws %s circles behind the content, hidden from assistive technology', (value, className) => {
            const element = content({ sectionBackground: 'light_purple', sectionAccent: value });
            expect(wrapperClasses(element)).toEqual(expect.arrayContaining(['ust-has-accent', className]));
            const accent = getWrapper(element).firstElementChild;
            expect(accent.className).toBe('ust-static-content-accent');
            expect(accent.getAttribute('aria-hidden')).toBe('true');
        });

        it('draws circles only on a widget that has a panel, and ignores an unknown accent', () => {
            const noPanel = content({ sectionAccent: 'green_circles' });
            expect(wrapperClasses(noPanel)).not.toContain('ust-has-accent');
            expect(noPanel.shadowRoot.querySelector('.ust-static-content-accent')).toBeNull();

            const unknown = content({ sectionBackground: 'gray', sectionAccent: 'sparkles' });
            expect(wrapperClasses(unknown)).not.toContain('ust-has-accent');
            expect(unknown.shadowRoot.querySelector('.ust-static-content-accent')).toBeNull();
        });

        it('draws circles on the older Callout panel too, since it is a panel', () => {
            const element = content({ contentClass: 'ust-content-callout', sectionAccent: 'purple_circles' });
            expect(wrapperClasses(element)).toEqual(expect.arrayContaining(['ust-bg-light-purple', 'ust-has-accent', 'ust-accent-purple']));
        });
    });

    describe('dark background and large heading', () => {
        const BTN = [{ id: 'b1', label: 'Go', type: 'external', url: 'https://example.edu', newTab: false, style: 'brand', align: 'left', icon: null }];

        it('marks any dark background, passes it to the buttons, and gives the text light colours', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BTN, darkBackground: true });
            expect(element.shadowRoot.querySelector('.ust-static-content').className).toContain('ust-on-dark');
            expect(element.shadowRoot.querySelector('c-ust-widget-buttons').darkBackground).toBe(true);
        });

        it('uses the large headline only when asked', () => {
            const plain = createContent({ richTextContent: '<p>Hi</p>', textHeader: 'T' });
            expect(plain.shadowRoot.querySelector('.ust-static-content').className).not.toContain('ust-static-content_large');
            const large = createContent({ richTextContent: '<p>Hi</p>', textHeader: 'T', largeHeading: true });
            expect(large.shadowRoot.querySelector('.ust-static-content').className).toContain('ust-static-content_large');
        });
    });

    describe('buttons', () => {
        const BUTTONS = [{ id: 'b1', label: 'Give', type: 'external', url: 'https://example.edu', newTab: true, style: 'brand', align: 'left', icon: null }];

        function children(element) {
            return Array.from(element.shadowRoot.querySelector('.ust-static-content').children).map((child) => child.tagName.toLowerCase());
        }

        it('shows the buttons below the text by default', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS });
            expect(children(element)).toEqual(['lightning-formatted-rich-text', 'c-ust-widget-buttons', 'slot']);
        });

        it('shows the buttons above the text when asked', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, buttonPlacement: 'Above', textHeader: 'Head' });
            expect(children(element)).toEqual(['h2', 'c-ust-widget-buttons', 'lightning-formatted-rich-text', 'slot']);
        });

        it('treats an unknown placement as below', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, buttonPlacement: 'Sideways' });
            expect(children(element)).toEqual(['lightning-formatted-rich-text', 'c-ust-widget-buttons', 'slot']);
        });

        it('renders a widget that has only buttons', () => {
            const element = createContent({ buttons: BUTTONS });
            expect(children(element)).toEqual(['c-ust-widget-buttons', 'slot']);
        });

        it('passes size and preview mode to the button renderer', () => {
            const element = createContent({ buttons: BUTTONS, buttonSize: 'ust-buttons-wide', previewMode: true });
            const renderer = element.shadowRoot.querySelector('c-ust-widget-buttons');
            expect(renderer.buttonSize).toBe('ust-buttons-wide');
            expect(renderer.previewMode).toBe(true);
            expect(renderer.buttons).toEqual(BUTTONS);
        });

        it('adds the over-picture class and passes it to the button renderer when shown over an image', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, overImage: true });
            expect(element.shadowRoot.querySelector('.ust-static-content').className).toContain('ust-on-image');
            expect(element.shadowRoot.querySelector('c-ust-widget-buttons').overImage).toBe(true);
        });

        it('does not add the over-picture class by default', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS });
            expect(element.shadowRoot.querySelector('.ust-static-content').className).not.toContain('ust-on-image');
        });

        it('tells its buttons they are on a dark background only for the Purple panel', () => {
            const purple = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, contentClass: 'ust-content-inverse' });
            expect(purple.shadowRoot.querySelector('c-ust-widget-buttons').darkBackground).toBe(true);
            expect(purple.shadowRoot.querySelector('.ust-static-content').className).toContain('ust-on-dark');

            ['ust-content-callout', 'ust-content-centered', 'ust-content-muted', undefined].forEach((contentClass) => {
                const light = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, contentClass });
                expect(light.shadowRoot.querySelector('c-ust-widget-buttons').darkBackground).toBe(false);
                expect(light.shadowRoot.querySelector('.ust-static-content').className).not.toContain('ust-on-dark');
            });
        });

        it('uses the over-picture look, not the dark-panel look, over a picture', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, overImage: true, contentClass: 'ust-content-inverse' });
            const renderer = element.shadowRoot.querySelector('c-ust-widget-buttons');
            expect(renderer.overImage).toBe(true);
            expect(renderer.darkBackground).toBe(false);
        });

        it('shows no button area without buttons', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: [] });
            expect(element.shadowRoot.querySelector('c-ust-widget-buttons')).toBeNull();
        });
    });
});

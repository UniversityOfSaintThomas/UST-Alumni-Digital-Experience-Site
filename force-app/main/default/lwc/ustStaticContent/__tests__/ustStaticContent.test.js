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

    describe('buttons', () => {
        const BUTTONS = [{ id: 'b1', label: 'Give', type: 'external', url: 'https://example.edu', newTab: true, style: 'brand', align: 'left', icon: null }];

        function children(element) {
            return Array.from(element.shadowRoot.querySelector('.ust-static-content').children).map((child) => child.tagName.toLowerCase());
        }

        it('shows the buttons below the text by default', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS });
            expect(children(element)).toEqual(['lightning-formatted-rich-text', 'c-ust-widget-buttons']);
        });

        it('shows the buttons above the text when asked', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, buttonPlacement: 'Above', textHeader: 'Head' });
            expect(children(element)).toEqual(['h2', 'c-ust-widget-buttons', 'lightning-formatted-rich-text']);
        });

        it('treats an unknown placement as below', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: BUTTONS, buttonPlacement: 'Sideways' });
            expect(children(element)).toEqual(['lightning-formatted-rich-text', 'c-ust-widget-buttons']);
        });

        it('renders a widget that has only buttons', () => {
            const element = createContent({ buttons: BUTTONS });
            expect(children(element)).toEqual(['c-ust-widget-buttons']);
        });

        it('passes size and preview mode to the button renderer', () => {
            const element = createContent({ buttons: BUTTONS, buttonSize: 'ust-buttons-wide', previewMode: true });
            const renderer = element.shadowRoot.querySelector('c-ust-widget-buttons');
            expect(renderer.buttonSize).toBe('ust-buttons-wide');
            expect(renderer.previewMode).toBe(true);
            expect(renderer.buttons).toEqual(BUTTONS);
        });

        it('shows no button area without buttons', () => {
            const element = createContent({ richTextContent: '<p>Hi</p>', buttons: [] });
            expect(element.shadowRoot.querySelector('c-ust-widget-buttons')).toBeNull();
        });
    });
});

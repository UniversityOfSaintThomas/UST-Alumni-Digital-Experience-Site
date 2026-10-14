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
});

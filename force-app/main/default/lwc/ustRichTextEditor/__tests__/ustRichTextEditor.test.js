import { createElement } from 'lwc';
import UstRichTextEditor from 'c/ustRichTextEditor';

function createEditor(properties = {}) {
    const element = createElement('c-ust-rich-text-editor', { is: UstRichTextEditor });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

function getRichText(element) {
    return element.shadowRoot.querySelector('lightning-input-rich-text');
}

function getStyleCombobox(element) {
    return element.shadowRoot.querySelector('lightning-combobox');
}

function flushPromises() {
    return Promise.resolve();
}

describe('c-ust-rich-text-editor', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('offers Paragraph and Heading 2-5 only (no Heading 1 or 6)', () => {
        const element = createEditor();
        const labels = getStyleCombobox(element).options.map((option) => option.label);
        expect(labels).toEqual(['Paragraph', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5']);
    });

    it('allows the header format and hides font and background categories', () => {
        const element = createEditor();
        const richText = getRichText(element);
        expect(richText.formats).toContain('header');
        expect(richText.disabledCategories).toContain('FORMAT_FONT');
        expect(richText.disabledCategories).toContain('FORMAT_BACKGROUND');
    });

    it('applies the chosen heading level through setFormat', async () => {
        const element = createEditor({ value: '<p>Hi</p>' });
        const richText = getRichText(element);
        richText.setFormat = jest.fn();
        richText.focus = jest.fn();

        getStyleCombobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: 'h3' } }));
        await flushPromises();

        expect(richText.setFormat).toHaveBeenCalledWith({ header: 3 });
        expect(richText.focus).toHaveBeenCalled();
    });

    it('removes the heading when Paragraph is chosen', () => {
        const element = createEditor();
        const richText = getRichText(element);
        richText.setFormat = jest.fn();
        richText.focus = jest.fn();

        getStyleCombobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: 'p' } }));

        expect(richText.setFormat).toHaveBeenCalledWith({ header: false });
    });

    it('does not let the dropdown change event escape as a content change', () => {
        const element = createEditor();
        const richText = getRichText(element);
        richText.setFormat = jest.fn();
        richText.focus = jest.fn();
        const handler = jest.fn();
        element.addEventListener('change', handler);

        getStyleCombobox(element).dispatchEvent(
            new CustomEvent('change', { detail: { value: 'h2' }, bubbles: true, composed: true })
        );

        expect(handler).not.toHaveBeenCalled();
    });

    it('re-dispatches editor changes with the HTML value', async () => {
        const element = createEditor();
        const handler = jest.fn();
        element.addEventListener('change', handler);

        getRichText(element).dispatchEvent(new CustomEvent('change', { detail: { value: '<h2>Title</h2>' } }));
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.value).toBe('<h2>Title</h2>');
        expect(element.value).toBe('<h2>Title</h2>');
    });

    it('syncs the dropdown to the heading under the cursor', async () => {
        const element = createEditor();
        const richText = getRichText(element);
        richText.getFormat = jest.fn().mockReturnValue({ header: 4 });

        element.shadowRoot.querySelector('.ust-editor-body').dispatchEvent(new CustomEvent('click'));
        await flushPromises();

        expect(getStyleCombobox(element).value).toBe('h4');

        richText.getFormat.mockReturnValue({});
        element.shadowRoot.querySelector('.ust-editor-body').dispatchEvent(new CustomEvent('keyup'));
        await flushPromises();

        expect(getStyleCombobox(element).value).toBe('p');
    });

    it('warns about Heading 1 and Heading 6', async () => {
        const element = createEditor({ value: '<h1>Too big</h1>' });
        await flushPromises();
        expect(element.shadowRoot.textContent).toContain('Heading 1 and Heading 6 are not used');

        element.value = '<h2>Fine</h2>';
        await flushPromises();
        expect(element.shadowRoot.textContent).not.toContain('Heading 1 and Heading 6 are not used');
    });

    it('is invalid and shows an error when over the length limit', async () => {
        const element = createEditor({ value: 'x'.repeat(15), maxLength: 10 });
        await flushPromises();

        expect(element.checkValidity()).toBe(false);
        expect(element.shadowRoot.textContent).toContain('Content is too long');
        expect(getRichText(element).valid).toBe(false);
    });

    it('is valid within the length limit', () => {
        const element = createEditor({ value: 'short', maxLength: 10 });
        expect(element.checkValidity()).toBe(true);
    });
});

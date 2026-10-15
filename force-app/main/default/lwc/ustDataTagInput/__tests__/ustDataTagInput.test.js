import { createElement } from 'lwc';
import UstDataTagInput from 'c/ustDataTagInput';

const TAGS = [
    { name: 'First_Name', label: 'First name', sample: 'Jordan', allowInUrl: false },
    { name: 'Banner_ID', label: 'Banner ID', sample: 'A001', allowInUrl: true }
];

function createInput(properties = {}) {
    const element = createElement('c-ust-data-tag-input', { is: UstDataTagInput });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

const flush = () => Promise.resolve();

function textInput(element) {
    return element.shadowRoot.querySelector('lightning-input');
}

function tagCombobox(element) {
    return element.shadowRoot.querySelector('lightning-combobox');
}

describe('c-ust-data-tag-input', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('lists the available tags with their tokens', () => {
        const element = createInput({ tagDefinitions: TAGS });
        expect(tagCombobox(element).options).toEqual([
            { label: 'First name  {{First_Name}}', value: 'First_Name' },
            { label: 'Banner ID  {{Banner_ID}}', value: 'Banner_ID' }
        ]);
    });

    it('hides the list when no tags are available', () => {
        const element = createInput();
        expect(tagCombobox(element)).toBeNull();
    });

    it('reports typing and keeps the value', async () => {
        const element = createInput({ tagDefinitions: TAGS, value: 'Hello' });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        const input = textInput(element);
        input.value = 'Hello there';
        input.dispatchEvent(new CustomEvent('change'));
        await flush();

        expect(element.value).toBe('Hello there');
        expect(handler.mock.calls[0][0].detail.value).toBe('Hello there');
    });

    it('inserts a tag at the cursor reported by the input', async () => {
        const element = createInput({ tagDefinitions: TAGS, value: 'Hello !' });
        const input = textInput(element);
        input.value = 'Hello !';
        input.selectionStart = 6;
        input.selectionEnd = 6;
        input.focus = jest.fn();
        const handler = jest.fn();
        element.addEventListener('change', handler);

        tagCombobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: 'First_Name' } }));
        await flush();

        expect(element.value).toBe('Hello {{First_Name}}!');
        expect(handler.mock.calls[0][0].detail.value).toBe('Hello {{First_Name}}!');
        expect(input.focus).toHaveBeenCalled();
    });

    it('replaces the selected text with the tag', async () => {
        const element = createInput({ tagDefinitions: TAGS, value: 'Dear NAME, hello' });
        const input = textInput(element);
        input.value = 'Dear NAME, hello';
        input.selectionStart = 5;
        input.selectionEnd = 9;
        input.focus = jest.fn();

        tagCombobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: 'First_Name' } }));
        await flush();

        expect(element.value).toBe('Dear {{First_Name}}, hello');
    });

    it('appends the tag when the input does not report a cursor', async () => {
        const element = createInput({ tagDefinitions: TAGS, value: 'Hi ' });
        const input = textInput(element);
        input.value = 'Hi ';
        input.selectionStart = undefined;
        input.selectionEnd = undefined;
        input.focus = jest.fn();

        tagCombobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: 'Banner_ID' } }));
        await flush();

        expect(element.value).toBe('Hi {{Banner_ID}}');
    });

    it('does not let the inner change events escape twice', async () => {
        const element = createInput({ tagDefinitions: TAGS, value: 'x' });
        const handler = jest.fn();
        element.addEventListener('change', handler);
        const input = textInput(element);
        input.value = 'xy';
        input.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
        await flush();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('warns about unknown tags only', async () => {
        const element = createInput({ tagDefinitions: TAGS, value: 'Hi {{First_Name}} {{Fist_Name}}' });
        await flush();
        const text = element.shadowRoot.textContent;
        expect(text).toContain('Unknown data tag: {{Fist_Name}}');
        expect(text).not.toContain('{{First_Name}}.');
    });
});

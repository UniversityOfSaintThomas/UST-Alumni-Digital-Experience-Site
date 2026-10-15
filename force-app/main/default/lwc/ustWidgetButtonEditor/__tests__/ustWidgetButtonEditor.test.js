import { createElement } from 'lwc';
import UstWidgetButtonEditor from 'c/ustWidgetButtonEditor';
import getPortalLinkSuggestions from '@salesforce/apex/PortalButtons.getPortalLinkSuggestions';

jest.mock(
    '@salesforce/apex/PortalButtons.getPortalLinkSuggestions',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

const TAGS = [
    { name: 'First_Name', label: 'First name', sample: 'Jordan', allowInUrl: false },
    { name: 'Banner_ID', label: 'Banner ID', sample: 'A001', allowInUrl: true }
];

const SUGGESTIONS = [
    { label: 'Home', path: '/', loginRequired: false },
    { label: 'Directory', path: '/alumni-directory', loginRequired: true }
];

function stored(buttons) {
    return JSON.stringify({ version: 1, buttons });
}

const SAVED = stored([
    { id: 'a', label: 'Give', type: 'external', url: 'https://example.edu/give', newTab: true, style: 'brand', align: 'left', icon: '' },
    { id: 'b', label: 'Directory', type: 'portal', url: '/alumni-directory', newTab: false, style: 'neutral', align: 'center', icon: '' }
]);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function createEditor(properties = {}) {
    const element = createElement('c-ust-widget-button-editor', { is: UstWidgetButtonEditor });
    Object.assign(element, { tagDefinitions: TAGS }, properties);
    document.body.appendChild(element);
    await flush();
    return element;
}

function byLabel(element, selector, label) {
    return Array.from(element.shadowRoot.querySelectorAll(selector)).find((node) => node.label === label) || null;
}

function byName(element, selector, name) {
    return Array.from(element.shadowRoot.querySelectorAll(selector)).find((node) => node.name === name) || null;
}

function rowButton(element, alternativeText) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-button-icon')).find((node) => node.alternativeText === alternativeText) || null;
}

function listedLabels(element) {
    return Array.from(element.shadowRoot.querySelectorAll('.ust-button-row-label')).map((node) => node.textContent);
}

function tagInputs(element) {
    return Array.from(element.shadowRoot.querySelectorAll('c-ust-data-tag-input'));
}

function setTagInput(element, label, value) {
    const input = tagInputs(element).find((candidate) => candidate.label === label);
    input.dispatchEvent(new CustomEvent('change', { detail: { value } }));
}

async function fillAndAdd(element, { label, url, type }) {
    byLabel(element, 'lightning-button', 'Add button').click();
    await flush();
    if (type) {
        byName(element, 'lightning-combobox', 'buttonType').dispatchEvent(new CustomEvent('change', { detail: { value: type } }));
        await flush();
    }
    setTagInput(element, 'Button text', label);
    const linkLabel = tagInputs(element).find((input) => input.label !== 'Button text').label;
    setTagInput(element, linkLabel, url);
    await flush();
    const submit = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).filter((button) => button.label === 'Add button');
    submit[submit.length - 1].click();
    await flush();
}

describe('c-ust-widget-button-editor', () => {
    beforeEach(() => {
        getPortalLinkSuggestions.mockResolvedValue(SUGGESTIONS);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('lists the stored buttons in order', async () => {
        const element = await createEditor({ value: SAVED });
        expect(listedLabels(element)).toEqual(['Give', 'Directory']);
        expect(element.shadowRoot.textContent).toContain('2 buttons');
    });

    it('shows a hint when there are no buttons', async () => {
        const element = await createEditor();
        expect(element.shadowRoot.textContent).toContain('No buttons yet');
        expect(element.value).toBe('');
    });

    it('adds an external button and reports the JSON to store', async () => {
        const element = await createEditor();
        const handler = jest.fn();
        element.addEventListener('change', handler);

        await fillAndAdd(element, { label: 'Give today', url: 'https://example.edu/give' });

        expect(listedLabels(element)).toEqual(['Give today']);
        const saved = JSON.parse(handler.mock.calls[0][0].detail.value);
        expect(saved.version).toBe(1);
        expect(saved.buttons[0]).toMatchObject({ label: 'Give today', type: 'external', url: 'https://example.edu/give', style: 'brand', align: 'left', newTab: true });
        expect(saved.buttons[0].id).toBeTruthy();
        expect(element.hasOpenDraft()).toBe(false);
    });

    it('adds a portal button and offers the site pages', async () => {
        const element = await createEditor();
        byLabel(element, 'lightning-button', 'Add button').click();
        await flush();
        byName(element, 'lightning-combobox', 'buttonType').dispatchEvent(new CustomEvent('change', { detail: { value: 'portal' } }));
        await flush();

        const pagePicker = byName(element, 'lightning-combobox', 'portalPage');
        expect(pagePicker.options.map((option) => option.value)).toEqual(['/', '/alumni-directory']);
        expect(pagePicker.options[1].label).toContain('login required');

        pagePicker.dispatchEvent(new CustomEvent('change', { detail: { value: '/alumni-directory' } }));
        await flush();
        expect(element.shadowRoot.textContent).toContain('requires sign-in');
        const linkInput = tagInputs(element).find((input) => input.label !== 'Button text');
        expect(linkInput.value).toBe('/alumni-directory');
    });

    it('only offers identifier tags in the link field', async () => {
        const element = await createEditor();
        byLabel(element, 'lightning-button', 'Add button').click();
        await flush();
        const textInput = tagInputs(element).find((input) => input.label === 'Button text');
        const linkInput = tagInputs(element).find((input) => input.label !== 'Button text');
        expect(textInput.tagDefinitions.map((tag) => tag.name)).toEqual(['First_Name', 'Banner_ID']);
        expect(linkInput.tagDefinitions.map((tag) => tag.name)).toEqual(['Banner_ID']);
    });

    it('does not add an invalid button, and explains why', async () => {
        const element = await createEditor();
        const handler = jest.fn();
        element.addEventListener('change', handler);

        await fillAndAdd(element, { label: 'Bad', url: 'javascript:alert(1)' });

        expect(handler).not.toHaveBeenCalled();
        expect(listedLabels(element)).toEqual([]);
        expect(element.shadowRoot.textContent).toContain('Use a full https:// link');
        expect(element.hasOpenDraft()).toBe(true);
    });

    it('requires text and a link', async () => {
        const element = await createEditor();
        byLabel(element, 'lightning-button', 'Add button').click();
        await flush();
        const submit = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).filter((button) => button.label === 'Add button');
        submit[submit.length - 1].click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('Enter the text for the button.');
        expect(element.shadowRoot.textContent).toContain('Enter where the button goes.');
    });

    it('edits an existing button in place without changing its position or id', async () => {
        const element = await createEditor({ value: SAVED });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        rowButton(element, 'Edit button Give').click();
        await flush();
        expect(element.hasOpenDraft()).toBe(true);
        setTagInput(element, 'Button text', 'Give now');
        await flush();
        byLabel(element, 'lightning-button', 'Update button').click();
        await flush();

        const saved = JSON.parse(handler.mock.calls[0][0].detail.value).buttons;
        expect(saved.map((button) => button.label)).toEqual(['Give now', 'Directory']);
        expect(saved[0].id).toBe('a');
        expect(element.hasOpenDraft()).toBe(false);
    });

    it('cancelling an edit leaves the button unchanged', async () => {
        const element = await createEditor({ value: SAVED });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        rowButton(element, 'Edit button Give').click();
        await flush();
        setTagInput(element, 'Button text', 'Changed');
        byLabel(element, 'lightning-button', 'Cancel').click();
        await flush();

        expect(handler).not.toHaveBeenCalled();
        expect(listedLabels(element)).toEqual(['Give', 'Directory']);
        expect(element.hasOpenDraft()).toBe(false);
    });

    it('reorders buttons with the arrows and disables them at the ends', async () => {
        const element = await createEditor({ value: SAVED });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        expect(rowButton(element, 'Move button Give up').disabled).toBe(true);
        expect(rowButton(element, 'Move button Directory down').disabled).toBe(true);

        rowButton(element, 'Move button Directory up').click();
        await flush();

        expect(listedLabels(element)).toEqual(['Directory', 'Give']);
        expect(JSON.parse(handler.mock.calls[0][0].detail.value).buttons.map((button) => button.id)).toEqual(['b', 'a']);
    });

    it('deletes a button', async () => {
        const element = await createEditor({ value: SAVED });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        rowButton(element, 'Delete button Give').click();
        await flush();

        expect(listedLabels(element)).toEqual(['Directory']);
        expect(JSON.parse(handler.mock.calls[0][0].detail.value).buttons).toHaveLength(1);
    });

    it('reports an empty value after the last button is deleted', async () => {
        const element = await createEditor({ value: stored([{ id: 'a', label: 'Only', type: 'portal', url: '/x', newTab: false, style: 'brand', align: 'left', icon: '' }]) });
        const handler = jest.fn();
        element.addEventListener('change', handler);
        rowButton(element, 'Delete button Only').click();
        await flush();
        expect(handler.mock.calls[0][0].detail.value).toBe('');
    });

    it('does not let the inner combobox or input change events escape', async () => {
        const element = await createEditor();
        const handler = jest.fn();
        element.addEventListener('change', handler);
        byLabel(element, 'lightning-button', 'Add button').click();
        await flush();
        byName(element, 'lightning-combobox', 'buttonStyle').dispatchEvent(
            new CustomEvent('change', { detail: { value: 'neutral' }, bubbles: true, composed: true })
        );
        expect(handler).not.toHaveBeenCalled();
    });

    it('takes a new stored value from the parent (for example after Reset) and drops an open draft', async () => {
        const element = await createEditor({ value: SAVED });
        rowButton(element, 'Edit button Give').click();
        await flush();

        element.value = stored([]);
        await flush();

        expect(element.hasOpenDraft()).toBe(false);
        expect(listedLabels(element)).toEqual([]);
    });

    it('does not reload its list from the value it just reported', async () => {
        const element = await createEditor({ value: SAVED });
        rowButton(element, 'Move button Directory up').click();
        await flush();
        const reported = element.value;
        element.value = reported; // the parent echoes the value we reported back to us
        await flush();
        expect(listedLabels(element)).toEqual(['Directory', 'Give']);
    });

    it('still works when the page list cannot be loaded', async () => {
        getPortalLinkSuggestions.mockRejectedValue(new Error('no access'));
        const element = await createEditor();
        byLabel(element, 'lightning-button', 'Add button').click();
        await flush();
        byName(element, 'lightning-combobox', 'buttonType').dispatchEvent(new CustomEvent('change', { detail: { value: 'portal' } }));
        await flush();
        expect(byName(element, 'lightning-combobox', 'portalPage')).toBeNull();
        expect(tagInputs(element).length).toBeGreaterThan(1);
    });

    it('disables Add while a button is being edited', async () => {
        const element = await createEditor({ value: SAVED });
        rowButton(element, 'Edit button Give').click();
        await flush();
        expect(byLabel(element, 'lightning-button', 'Add button').disabled).toBe(true);
    });
});

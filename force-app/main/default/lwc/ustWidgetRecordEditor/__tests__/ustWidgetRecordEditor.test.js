import { createElement } from 'lwc';
import UstWidgetRecordEditor from 'c/ustWidgetRecordEditor';

const RECORD_ID = 'a1Nhs0000004lZpEAI';

function createEditor(recordId = RECORD_ID) {
    const element = createElement('c-ust-widget-record-editor', { is: UstWidgetRecordEditor });
    element.recordId = recordId;
    document.body.appendChild(element);
    return element;
}

function getForm(element) {
    return element.shadowRoot.querySelector('lightning-record-edit-form');
}

function loadRecord(element, fieldValues) {
    const fields = {};
    Object.keys(fieldValues).forEach((apiName) => {
        fields[apiName] = { value: fieldValues[apiName] };
    });
    getForm(element).dispatchEvent(
        new CustomEvent('load', { detail: { records: { [RECORD_ID]: { fields } } } })
    );
}

/** Base component stubs expose field-name as a property, not an attribute. */
function getInputField(element, apiName) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-input-field')).find(
        (field) => field.fieldName === apiName
    );
}

function flushPromises() {
    return Promise.resolve();
}

describe('c-ust-widget-record-editor', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows setup and filter sections but hides Content for other widget types', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_links_hub' });
        await flushPromises();

        const text = element.shadowRoot.textContent;
        expect(text).toContain('Widget Setup');
        expect(text).toContain('Audience Filters');
        expect(element.shadowRoot.querySelector('c-ust-rich-text-editor')).toBeNull();
    });

    it('shows the Content section with editor and preview for Static Content', async () => {
        const element = createEditor();
        loadRecord(element, {
            Component_Name__c: 'ust_static_content',
            Static_Content_Header__c: 'Welcome',
            Content_CSS_Class__c: 'ust-content-callout',
            Static_Content__c: '<p>Body</p>'
        });
        await flushPromises();

        const editor = element.shadowRoot.querySelector('c-ust-rich-text-editor');
        expect(editor).not.toBeNull();
        expect(editor.value).toBe('<p>Body</p>');

        const preview = element.shadowRoot.querySelector('c-ust-static-content');
        expect(preview.richTextContent).toBe('<p>Body</p>');
        expect(preview.textHeader).toBe('Welcome');
        expect(preview.contentClass).toBe('ust-content-callout');
    });

    it('reveals the Content section when the widget type changes to Static Content', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_links_hub' });
        await flushPromises();

        const componentField = getInputField(element, 'Component_Name__c');
        componentField.dispatchEvent(new CustomEvent('change', { detail: { value: 'ust_static_content' } }));
        await flushPromises();

        expect(element.shadowRoot.querySelector('c-ust-rich-text-editor')).not.toBeNull();
    });

    it('updates the preview as the editor and style class change', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content' });
        await flushPromises();

        element.shadowRoot
            .querySelector('c-ust-rich-text-editor')
            .dispatchEvent(new CustomEvent('change', { detail: { value: '<h2>New</h2>' } }));
        getInputField(element, 'Content_CSS_Class__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'ust-content-muted' } }));
        await flushPromises();

        const preview = element.shadowRoot.querySelector('c-ust-static-content');
        expect(preview.richTextContent).toBe('<h2>New</h2>');
        expect(preview.contentClass).toBe('ust-content-muted');
    });

    it('adds the editor HTML to the save payload for Static Content', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content' });
        await flushPromises();
        element.shadowRoot
            .querySelector('c-ust-rich-text-editor')
            .dispatchEvent(new CustomEvent('change', { detail: { value: '<h3>Saved</h3>' } }));
        await flushPromises();

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));

        expect(form.submit).toHaveBeenCalledWith({ Name: 'Widget', Static_Content__c: '<h3>Saved</h3>' });
    });

    it('does not touch Static_Content__c for other widget types', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_links_hub' });
        await flushPromises();

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));

        expect(form.submit).toHaveBeenCalledWith({ Name: 'Widget' });
    });

    it('blocks saving and shows an error toast when the content is too long', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content' });
        await flushPromises();
        const editor = element.shadowRoot.querySelector('c-ust-rich-text-editor');
        editor.checkValidity = jest.fn().mockReturnValue(false);
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: {} }, cancelable: true }));

        expect(form.submit).not.toHaveBeenCalled();
        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
    });

    it('shows a success toast after saving', async () => {
        const element = createEditor();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        getForm(element).dispatchEvent(new CustomEvent('success', { detail: { id: RECORD_ID } }));

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');
    });
});

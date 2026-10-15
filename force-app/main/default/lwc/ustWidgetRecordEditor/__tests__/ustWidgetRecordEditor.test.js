import { createElement } from 'lwc';
import UstWidgetRecordEditor from 'c/ustWidgetRecordEditor';

import getPlacements from '@salesforce/apex/PortalPageRegistry.getPlacements';
import getTagDefinitions from '@salesforce/apex/PortalDataTags.getTagDefinitions';

jest.mock(
    '@salesforce/apex/PortalButtons.getPortalLinkSuggestions',
    () => ({ default: jest.fn(() => Promise.resolve([])) }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortalDataTags.getTagDefinitions',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortalPageRegistry.getPlacements',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

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

/** Base component stubs expose type as a property, not an attribute. */
function guestCheckbox(element) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-input')).find((input) => input.type === 'checkbox') || null;
}

function flushPromises() {
    return Promise.resolve();
}

describe('c-ust-widget-record-editor', () => {
    beforeEach(() => {
        getPlacements.mockResolvedValue([]);
    });

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
        loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
        await flushPromises();
        element.shadowRoot
            .querySelector('c-ust-rich-text-editor')
            .dispatchEvent(new CustomEvent('change', { detail: { value: '<h3>Saved</h3>' } }));
        await flushPromises();

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));

        expect(form.submit).toHaveBeenCalledWith({
            Name: 'Widget',
            Page_Context__c: 'home',
            Static_Content__c: '<h3>Saved</h3>',
            Static_Content_Header__c: '',
            Buttons_JSON__c: ''
        });
    });

    it('does not touch Static_Content__c for other widget types', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_links_hub', Page_Context__c: 'home' });
        await flushPromises();

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));

        expect(form.submit).toHaveBeenCalledWith({ Name: 'Widget', Page_Context__c: 'home' });
    });

    it('blocks saving and shows an error toast when the content is too long', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
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

    it('gives the page picker the loaded zone and page context', async () => {
        const element = createEditor();
        loadRecord(element, { Zone__c: 'sidebar', Page_Context__c: 'home;alumni_directory__c' });
        await flushPromises();

        const picker = element.shadowRoot.querySelector('c-ust-page-context-picker');
        expect(picker.zone).toBe('sidebar');
        expect(picker.value).toBe('home;alumni_directory__c');
    });

    it('passes a changed zone and picker selection through to the picker and the save', async () => {
        const element = createEditor();
        loadRecord(element, { Zone__c: 'sidebar', Page_Context__c: 'home' });
        await flushPromises();

        getInputField(element, 'Zone__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'body' } }));
        element.shadowRoot
            .querySelector('c-ust-page-context-picker')
            .dispatchEvent(new CustomEvent('change', { detail: { value: 'home;my_account__c' } }));
        await flushPromises();

        expect(element.shadowRoot.querySelector('c-ust-page-context-picker').zone).toBe('body');

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));
        expect(form.submit).toHaveBeenCalledWith({ Name: 'Widget', Page_Context__c: 'home;my_account__c' });
    });

    it('blocks saving without at least one page', async () => {
        const element = createEditor();
        loadRecord(element, { Zone__c: 'sidebar', Page_Context__c: '' });
        await flushPromises();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: {} }, cancelable: true }));

        expect(form.submit).not.toHaveBeenCalled();
        expect(toastHandler.mock.calls[0][0].detail.title).toBe('Page Context is required');
    });

    const TAG_DEFINITIONS = [
        { name: 'First_Name', label: 'First name', sample: 'Jordan', allowInUrl: false },
        { name: 'Employer', label: 'Employer', sample: 'Summit & Co', allowInUrl: false }
    ];

    it('shows data tags resolved with sample values in the preview, and as a guest on request', async () => {
        const element = createEditor();
        getTagDefinitions.emit(TAG_DEFINITIONS);
        loadRecord(element, {
            Component_Name__c: 'ust_static_content',
            Static_Content_Header__c: 'Welcome, {{First_Name|friend}}',
            Static_Content__c: '<p>Hi {{First_Name|Alum}} from {{Employer}}</p>'
        });
        await flushPromises();

        const preview = () => element.shadowRoot.querySelector('c-ust-static-content');
        expect(preview().textHeader).toBe('Welcome, Jordan');
        expect(preview().richTextContent).toBe('<p>Hi Jordan from Summit &amp; Co</p>');

        const checkbox = guestCheckbox(element);
        checkbox.checked = true;
        checkbox.dispatchEvent(new CustomEvent('change'));
        await flushPromises();

        expect(preview().textHeader).toBe('Welcome, friend');
        expect(preview().richTextContent).toBe('<p>Hi Alum from </p>');
    });

    it('hides the guest preview switch when the content has no tags', async () => {
        const element = createEditor();
        getTagDefinitions.emit(TAG_DEFINITIONS);
        loadRecord(element, { Component_Name__c: 'ust_static_content', Static_Content__c: '<p>Plain</p>' });
        await flushPromises();
        expect(guestCheckbox(element)).toBeNull();
    });

    it('gives the tag lists to the header and body editors', async () => {
        const element = createEditor();
        getTagDefinitions.emit(TAG_DEFINITIONS);
        loadRecord(element, { Component_Name__c: 'ust_static_content' });
        await flushPromises();

        expect(element.shadowRoot.querySelector('c-ust-data-tag-input').tagDefinitions).toEqual(TAG_DEFINITIONS);
        expect(element.shadowRoot.querySelector('c-ust-rich-text-editor').tagDefinitions).toEqual(TAG_DEFINITIONS);
    });

    it('saves the header typed in the tag input along with the body', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
        await flushPromises();
        element.shadowRoot
            .querySelector('c-ust-data-tag-input')
            .dispatchEvent(new CustomEvent('change', { detail: { value: 'Hello {{First_Name}}' } }));
        await flushPromises();

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));

        const saved = form.submit.mock.calls[0][0];
        expect(saved.Static_Content_Header__c).toBe('Hello {{First_Name}}');
    });

    const STORED_BUTTONS = JSON.stringify({
        version: 1,
        buttons: [
            { id: 'a', label: 'Hi {{First_Name|friend}}', type: 'external', url: 'https://x.edu/f?id={{Banner_ID}}', newTab: true, style: 'brand', align: 'left', icon: '' },
            { id: 'b', label: 'Directory', type: 'portal', url: '/alumni-directory', newTab: false, style: 'neutral', align: 'center', icon: '' },
            { id: 'c', label: 'Unsafe', type: 'external', url: 'javascript:alert(1)', newTab: true, style: 'brand', align: 'left', icon: '' }
        ]
    });
    const BUTTON_TAGS = [
        { name: 'First_Name', label: 'First name', sample: 'Jordan', allowInUrl: false },
        { name: 'Banner_ID', label: 'Banner ID', sample: 'A001', allowInUrl: true }
    ];

    it('asks the form to load Buttons_JSON__c even though it is not on the page layout', async () => {
        const element = createEditor();
        const hidden = getInputField(element, 'Buttons_JSON__c');
        expect(hidden).toBeDefined();
        expect(hidden.className).toContain('slds-hide');
    });

    it('loads the stored buttons into the button editor', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content', Buttons_JSON__c: STORED_BUTTONS });
        await flushPromises();
        expect(element.shadowRoot.querySelector('c-ust-widget-button-editor').value).toBe(STORED_BUTTONS);
    });

    it('previews buttons the way the portal shows them, with placement and size', async () => {
        const element = createEditor();
        getTagDefinitions.emit(BUTTON_TAGS);
        loadRecord(element, {
            Component_Name__c: 'ust_static_content',
            Static_Content__c: '<p>Hi</p>',
            Buttons_JSON__c: STORED_BUTTONS,
            Button_Placement__c: 'Above',
            Button_Size__c: 'ust-buttons-wide'
        });
        await flushPromises();

        const preview = element.shadowRoot.querySelector('c-ust-static-content');
        expect(preview.previewMode).toBe(true);
        expect(preview.buttonPlacement).toBe('Above');
        expect(preview.buttonSize).toBe('ust-buttons-wide');
        expect(preview.buttons.map((button) => button.label)).toEqual(['Hi Jordan', 'Directory']);
        expect(preview.buttons[0].url).toBe('https://x.edu/f?id=A001');
    });

    it('updates the preview when placement, size, or the buttons change', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content', Static_Content__c: '<p>Hi</p>' });
        await flushPromises();

        getInputField(element, 'Button_Placement__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'Above' } }));
        getInputField(element, 'Button_Size__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'ust-buttons-full' } }));
        element.shadowRoot.querySelector('c-ust-widget-button-editor').dispatchEvent(
            new CustomEvent('change', {
                detail: { value: JSON.stringify({ version: 1, buttons: [{ id: 'n', label: 'New', type: 'portal', url: '/x', newTab: false, style: 'brand', align: 'left', icon: '' }] }) }
            })
        );
        await flushPromises();

        const preview = element.shadowRoot.querySelector('c-ust-static-content');
        expect(preview.buttonPlacement).toBe('Above');
        expect(preview.buttonSize).toBe('ust-buttons-full');
        expect(preview.buttons).toHaveLength(1);
    });

    it('saves the buttons JSON with the widget', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
        await flushPromises();
        const json = JSON.stringify({ version: 1, buttons: [{ id: 'n', label: 'New', type: 'portal', url: '/x', newTab: false, style: 'brand', align: 'left', icon: '' }] });
        element.shadowRoot.querySelector('c-ust-widget-button-editor').dispatchEvent(new CustomEvent('change', { detail: { value: json } }));
        await flushPromises();

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));

        expect(form.submit.mock.calls[0][0].Buttons_JSON__c).toBe(json);
    });

    it('blocks saving while a button is half finished', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
        await flushPromises();
        const buttonEditor = element.shadowRoot.querySelector('c-ust-widget-button-editor');
        buttonEditor.hasOpenDraft = jest.fn().mockReturnValue(true);
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: {} }, cancelable: true }));

        expect(form.submit).not.toHaveBeenCalled();
        expect(toastHandler.mock.calls[0][0].detail.title).toBe('Finish the button first');
    });

    it('does not send buttons for other widget types', async () => {
        const element = createEditor();
        loadRecord(element, { Component_Name__c: 'ust_links_hub', Page_Context__c: 'home' });
        await flushPromises();
        const form = getForm(element);
        form.submit = jest.fn();
        form.dispatchEvent(new CustomEvent('submit', { detail: { fields: { Name: 'Widget' } }, cancelable: true }));
        expect(form.submit.mock.calls[0][0]).not.toHaveProperty('Buttons_JSON__c');
    });

    it('offers the guest preview switch when only the buttons use tags', async () => {
        const element = createEditor();
        getTagDefinitions.emit(BUTTON_TAGS);
        loadRecord(element, { Component_Name__c: 'ust_static_content', Static_Content__c: '<p>Plain</p>', Buttons_JSON__c: STORED_BUTTONS });
        await flushPromises();
        expect(guestCheckbox(element)).not.toBeNull();
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

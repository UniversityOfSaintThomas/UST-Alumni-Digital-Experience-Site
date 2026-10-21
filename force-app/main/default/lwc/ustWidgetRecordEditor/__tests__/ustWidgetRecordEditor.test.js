import { createElement } from 'lwc';
import UstWidgetRecordEditor from 'c/ustWidgetRecordEditor';

import getPlacements from '@salesforce/apex/PortalPageRegistry.getPlacements';
import getTagDefinitions from '@salesforce/apex/PortalDataTags.getTagDefinitions';
import getHeroImages from '@salesforce/apex/PortalHero.getHeroImages';

jest.mock(
    '@salesforce/apex/PortalHero.getHeroImages',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

import getGridPreview from '@salesforce/apex/PortalCardGrid.getGridPreview';

jest.mock(
    '@salesforce/apex/PortalCardGrid.getGridPreview',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

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
        getHeroImages.mockClear();
        getHeroImages.mockResolvedValue({ imageUrl: 'https://x.edu/desktop.png', mobileImageUrl: 'https://x.edu/mobile.png' });
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

    describe('hero banner', () => {
        const HERO_RECORD = {
            Component_Name__c: 'ust_hero_banner',
            Page_Context__c: 'home',
            Static_Content_Header__c: 'Welcome',
            Static_Content__c: '<p>Hi</p>',
            Hero_Alt_Text__c: 'The quad',
            Hero_Height__c: 'tall',
            Hero_Text_Position__c: 'center',
            Hero_Overlay__c: 'strong'
        };

        function uploaders(element) {
            return Array.from(element.shadowRoot.querySelectorAll('c-aws-s3-directory-image'));
        }

        function submit(element, fields = { Name: 'Widget' }) {
            const form = getForm(element);
            form.submit = jest.fn();
            form.dispatchEvent(new CustomEvent('submit', { detail: { fields }, cancelable: true }));
            return form;
        }

        it('shows the hero section and no panel style for hero widgets, and neither for static content', async () => {
            const hero = createEditor();
            loadRecord(hero, HERO_RECORD);
            await flushPromises();
            expect(hero.shadowRoot.textContent).toContain('Hero Banner');
            expect(getInputField(hero, 'Hero_Alt_Text__c')).toBeDefined();
            expect(getInputField(hero, 'Content_CSS_Class__c')).toBeUndefined();

            const plain = createEditor();
            loadRecord(plain, { Component_Name__c: 'ust_static_content' });
            await flushPromises();
            expect(getInputField(plain, 'Hero_Alt_Text__c')).toBeUndefined();
            expect(uploaders(plain)).toHaveLength(0);
            expect(getInputField(plain, 'Content_CSS_Class__c')).toBeDefined();
        });

        it('labels the text fields for a hero and for static content', async () => {
            const hero = createEditor();
            loadRecord(hero, HERO_RECORD);
            await flushPromises();
            expect(hero.shadowRoot.querySelector('c-ust-data-tag-input').label).toBe('Headline');
            expect(hero.shadowRoot.querySelector('c-ust-rich-text-editor').label).toBe('Overlay text');

            const plain = createEditor();
            loadRecord(plain, { Component_Name__c: 'ust_static_content' });
            await flushPromises();
            expect(plain.shadowRoot.querySelector('c-ust-data-tag-input').label).toBe('Static Content Header');
        });

        it('configures both uploaders with the record, a file-name suffix, and a crop size', async () => {
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            await flushPromises();

            const [desktop, mobile] = uploaders(element);
            expect(desktop).toMatchObject({ recordId: RECORD_ID, imageField: 'Hero_Image_URL__c', fileNameSuffix: '-hero', imageMaxWidth: 1600, imageMaxHeight: 600, imageMode: 'crop' });
            expect(mobile).toMatchObject({ recordId: RECORD_ID, imageField: 'Hero_Mobile_Image_URL__c', fileNameSuffix: '-hero-mobile', imageMaxWidth: 800, imageMaxHeight: 640, imageMode: 'crop' });
            // The S3 tool writes the literal text "null" into the file name when no suffix is given.
            expect(desktop.fileNameSuffix).toBeTruthy();
            expect(mobile.fileNameSuffix).toBeTruthy();
            expect(desktop.fileNameSuffix).not.toBe(mobile.fileNameSuffix);
        });

        it('asks the user to save first when the widget does not exist yet', async () => {
            const element = createEditor('');
            getForm(element).dispatchEvent(new CustomEvent('load', { detail: { records: {} } }));
            getInputField(element, 'Component_Name__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'ust_hero_banner' } }));
            await flushPromises();

            expect(uploaders(element)).toHaveLength(0);
            expect(element.shadowRoot.textContent).toContain('Save the widget first');
            expect(getHeroImages).not.toHaveBeenCalled();
        });

        it('reads the saved picture addresses when the widget loads, and shows them in a hero preview', async () => {
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            await flushPromises();
            await flushPromises();

            expect(getHeroImages).toHaveBeenCalledWith({ widgetId: RECORD_ID });
            const preview = element.shadowRoot.querySelector('c-ust-hero-banner');
            expect(preview).not.toBeNull();
            expect(preview.previewMode).toBe(true);
            expect(preview.hero.imageUrl).toMatch(/^https:\/\/x\.edu\/desktop\.png\?t=\d+$/);
            expect(preview.hero.mobileImageUrl).toMatch(/^https:\/\/x\.edu\/mobile\.png\?t=\d+$/);
            expect(preview.hero).toMatchObject({ altText: 'The quad', height: 'tall', textPosition: 'center', overlay: 'strong' });
            expect(preview.textHeader).toBe('Welcome');
            expect(preview.richTextContent).toBe('<p>Hi</p>');
            expect(element.shadowRoot.querySelector('c-ust-static-content')).toBeNull();
        });

        it('does not ask for pictures more than once on repeated loads', async () => {
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            loadRecord(element, HERO_RECORD);
            await flushPromises();
            expect(getHeroImages).toHaveBeenCalledTimes(1);
        });

        it('previews a blank overlay as none (no dark layer), the same as the portal', async () => {
            const element = createEditor();
            loadRecord(element, { ...HERO_RECORD, Hero_Overlay__c: '' });
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.overlay).toBe('none');

            getInputField(element, 'Hero_Overlay__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'strong' } }));
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.overlay).toBe('strong');

            // choosing --None-- again sends no value
            getInputField(element, 'Hero_Overlay__c').dispatchEvent(new CustomEvent('change', { detail: { value: null } }));
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.overlay).toBe('none');
        });

        it('updates the preview as the look settings change', async () => {
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            await flushPromises();

            getInputField(element, 'Hero_Height__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'short' } }));
            getInputField(element, 'Hero_Text_Position__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'right' } }));
            getInputField(element, 'Hero_Overlay__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'light' } }));
            getInputField(element, 'Hero_Alt_Text__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'New alt' } }));
            await flushPromises();

            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero).toMatchObject({
                height: 'short', textPosition: 'right', overlay: 'light', altText: 'New alt'
            });
        });

        it('offers the layout choice, previews it, hints that position and overlay do not apply, and resets it', async () => {
            const element = createEditor();
            loadRecord(element, { ...HERO_RECORD, Hero_Layout__c: 'full' });
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.layout).toBe('full');
            expect(element.shadowRoot.querySelector('.ust-hero-hint')).toBeNull();

            getInputField(element, 'Hero_Layout__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'split' } }));
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.layout).toBe('split');
            expect(element.shadowRoot.querySelector('.ust-hero-hint')).not.toBeNull();

            Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button) => button.label === 'Reset').click();
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.layout).toBe('full');
            expect(element.shadowRoot.querySelector('.ust-hero-hint')).toBeNull();
        });

        it('treats a blank saved layout as the full picture', async () => {
            const element = createEditor();
            loadRecord(element, { ...HERO_RECORD, Hero_Layout__c: '' });
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.layout).toBe('full');
        });

        it('re-reads the addresses after an upload and keeps the refresh event from reaching the page', async () => {
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            await flushPromises();
            await flushPromises();
            getHeroImages.mockClear();
            getHeroImages.mockResolvedValue({ imageUrl: 'https://x.edu/new.png', mobileImageUrl: null });
            const pageListener = jest.fn();
            element.addEventListener('lightning__refresh', pageListener);

            uploaders(element)[0].dispatchEvent(new CustomEvent('lightning__refresh', { bubbles: true, composed: true }));
            await flushPromises();
            await flushPromises();

            expect(getHeroImages).toHaveBeenCalledWith({ widgetId: RECORD_ID });
            expect(pageListener).not.toHaveBeenCalled();
            const hero = element.shadowRoot.querySelector('c-ust-hero-banner').hero;
            expect(hero.imageUrl).toMatch(/^https:\/\/x\.edu\/new\.png\?t=\d+$/);
            expect(hero.mobileImageUrl).toBe('');
        });

        it('keeps the picture addresses out of the Save payload so a save cannot overwrite an upload', async () => {
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            await flushPromises();
            await flushPromises();

            const form = submit(element, { Name: 'Widget', Hero_Alt_Text__c: 'The quad' });

            const saved = form.submit.mock.calls[0][0];
            expect(saved).not.toHaveProperty('Hero_Image_URL__c');
            expect(saved).not.toHaveProperty('Hero_Mobile_Image_URL__c');
            expect(getInputField(element, 'Hero_Image_URL__c')).toBeUndefined();
            expect(getInputField(element, 'Hero_Mobile_Image_URL__c')).toBeUndefined();
            expect(saved.Static_Content_Header__c).toBe('Welcome');
        });

        it('blocks Save and explains why when a picture has no alt text', async () => {
            const element = createEditor();
            loadRecord(element, { ...HERO_RECORD, Hero_Alt_Text__c: '' });
            await flushPromises();
            await flushPromises();
            const toastHandler = jest.fn();
            element.addEventListener('lightning__showtoast', toastHandler);

            expect(element.shadowRoot.textContent).toContain('Alt text is required before you can save');
            const form = submit(element);

            expect(form.submit).not.toHaveBeenCalled();
            expect(toastHandler.mock.calls[0][0].detail.title).toBe('Describe the picture');
        });

        it('allows Save without alt text when there is no picture yet', async () => {
            getHeroImages.mockResolvedValue({ imageUrl: null, mobileImageUrl: null });
            const element = createEditor();
            loadRecord(element, { ...HERO_RECORD, Hero_Alt_Text__c: '' });
            await flushPromises();
            await flushPromises();

            const form = submit(element);

            expect(form.submit).toHaveBeenCalledTimes(1);
            expect(element.shadowRoot.textContent).not.toContain('Alt text is required');
        });

        it('shows a preview without a picture when none has been uploaded', async () => {
            getHeroImages.mockResolvedValue({ imageUrl: null, mobileImageUrl: null });
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            await flushPromises();
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.imageUrl).toBe('');
        });

        it('loads pictures when an existing widget is changed to a Hero Banner', async () => {
            const element = createEditor();
            loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
            await flushPromises();
            expect(getHeroImages).not.toHaveBeenCalled();

            getInputField(element, 'Component_Name__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'ust_hero_banner' } }));
            await flushPromises();

            expect(getHeroImages).toHaveBeenCalledTimes(1);
            expect(uploaders(element)).toHaveLength(2);
        });

        it('Reset puts the headline and the hero settings back', async () => {
            const element = createEditor();
            loadRecord(element, HERO_RECORD);
            await flushPromises();
            element.shadowRoot.querySelector('c-ust-data-tag-input').dispatchEvent(new CustomEvent('change', { detail: { value: 'Changed headline' } }));
            getInputField(element, 'Hero_Height__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'short' } }));
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').textHeader).toBe('Changed headline');

            Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button) => button.label === 'Reset').click();
            await flushPromises();

            const preview = element.shadowRoot.querySelector('c-ust-hero-banner');
            expect(preview.textHeader).toBe('Welcome');
            expect(preview.hero.height).toBe('tall');
        });
    });

    describe('form load events after the user has edited something', () => {
        // The form fires "load" again whenever its field list changes, which happens right after an edit
        // (switching to Hero Banner adds the hero fields). Each repeat reports the SAVED values.
        const STATIC_RECORD = { Component_Name__c: 'ust_static_content', Zone__c: 'body', Page_Context__c: 'home' };

        it('keeps the Hero section when the form reloads after Component Name is changed to Hero Banner', async () => {
            const element = createEditor();
            loadRecord(element, STATIC_RECORD);
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-aws-s3-directory-image')).toBeNull();

            getInputField(element, 'Component_Name__c').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'ust_hero_banner' } })
            );
            // what the live form did: three more loads, all still carrying the saved static-content values
            loadRecord(element, STATIC_RECORD);
            loadRecord(element, STATIC_RECORD);
            loadRecord(element, STATIC_RECORD);
            await flushPromises();

            expect(element.shadowRoot.querySelectorAll('c-aws-s3-directory-image')).toHaveLength(2);
            expect(element.shadowRoot.querySelector('c-ust-hero-banner')).not.toBeNull();
        });

        it('reads the saved hero settings from a LATER load, because the form asks for the hero fields only after the first one', async () => {
            // Recorded from the live form: four loads without any Hero_ field, then loads that carry them.
            const element = createEditor();
            const WITHOUT_HERO_FIELDS = { Component_Name__c: 'ust_hero_banner', Static_Content_Header__c: 'Welcome' };
            [1, 2, 3, 4].forEach(() => loadRecord(element, WITHOUT_HERO_FIELDS));
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner')).not.toBeNull();

            loadRecord(element, {
                ...WITHOUT_HERO_FIELDS,
                Hero_Layout__c: 'split', Hero_Height__c: 'tall', Hero_Text_Position__c: 'right', Hero_Overlay__c: 'strong', Hero_Alt_Text__c: 'The quad'
            });
            await flushPromises();

            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero).toMatchObject({
                layout: 'split', height: 'tall', textPosition: 'right', overlay: 'strong', altText: 'The quad'
            });
            expect(element.shadowRoot.querySelector('.ust-hero-hint')).not.toBeNull();
        });

        it('does not let a repeated load undo hero edits made after the hero settings were read', async () => {
            const element = createEditor();
            const SAVED = { Component_Name__c: 'ust_hero_banner', Hero_Layout__c: 'full', Hero_Height__c: 'medium', Hero_Overlay__c: 'medium' };
            loadRecord(element, { Component_Name__c: 'ust_hero_banner' });
            loadRecord(element, SAVED);
            await flushPromises();

            getInputField(element, 'Hero_Layout__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'split' } }));
            loadRecord(element, SAVED);
            loadRecord(element, SAVED);
            await flushPromises();

            expect(element.shadowRoot.querySelector('c-ust-hero-banner').hero.layout).toBe('split');
        });

        it('does not let a reload overwrite other unsaved edits either', async () => {
            const element = createEditor();
            loadRecord(element, { ...STATIC_RECORD, Static_Content_Header__c: 'Saved headline' });
            await flushPromises();

            element.shadowRoot.querySelector('c-ust-rich-text-editor').dispatchEvent(
                new CustomEvent('change', { detail: { value: '<p>Unsaved body</p>' } })
            );
            getInputField(element, 'Zone__c').dispatchEvent(new CustomEvent('change', { detail: { value: 'sidebar' } }));
            loadRecord(element, { ...STATIC_RECORD, Static_Content_Header__c: 'Saved headline', Static_Content__c: '<p>Saved</p>' });
            await flushPromises();

            expect(element.shadowRoot.querySelector('c-ust-rich-text-editor').value).toBe('<p>Unsaved body</p>');
            expect(element.shadowRoot.querySelector('c-ust-page-context-picker').zone).toBe('sidebar');
        });

        it('puts the widget type back on Reset, so the sections follow', async () => {
            const element = createEditor();
            loadRecord(element, STATIC_RECORD);
            await flushPromises();

            getInputField(element, 'Component_Name__c').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'ust_hero_banner' } })
            );
            await flushPromises();
            expect(element.shadowRoot.querySelectorAll('c-aws-s3-directory-image')).toHaveLength(2);

            const resetButton = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find(
                (button) => button.label === 'Reset'
            );
            resetButton.click();
            await flushPromises();

            expect(element.shadowRoot.querySelector('c-aws-s3-directory-image')).toBeNull();
            expect(element.shadowRoot.querySelector('c-ust-rich-text-editor')).not.toBeNull();
        });

        it('remembers a saved type change, so Reset afterwards does not undo it', async () => {
            const element = createEditor();
            loadRecord(element, STATIC_RECORD);
            await flushPromises();

            getInputField(element, 'Component_Name__c').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'ust_hero_banner' } })
            );
            getForm(element).dispatchEvent(new CustomEvent('success', { detail: { id: RECORD_ID } }));
            await flushPromises();

            const resetButton = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find(
                (button) => button.label === 'Reset'
            );
            resetButton.click();
            await flushPromises();

            expect(element.shadowRoot.querySelectorAll('c-aws-s3-directory-image')).toHaveLength(2);
        });

        it('still initialises from the record when the editor is pointed at a different widget', async () => {
            const element = createEditor();
            loadRecord(element, STATIC_RECORD);
            await flushPromises();

            const OTHER_ID = 'a1Nhs0000004OTHERAA';
            element.recordId = OTHER_ID;
            getForm(element).dispatchEvent(
                new CustomEvent('load', {
                    detail: { records: { [OTHER_ID]: { fields: { Component_Name__c: { value: 'ust_hero_banner' } } } } }
                })
            );
            await flushPromises();

            expect(element.shadowRoot.querySelectorAll('c-aws-s3-directory-image')).toHaveLength(2);
        });
    });

    describe('section background, accent and the other inputs that arrive in a later load', () => {
        // Recorded from the live form on a Static Content widget: the first loads carry only the always-present
        // fields; the panel style, section fields, and button placement/size join in a later load.
        const FIRST = { Component_Name__c: 'ust_static_content', Zone__c: 'body', Page_Context__c: 'home', Static_Content__c: '<p>Hi</p>' };
        const LATER = {
            ...FIRST,
            Content_CSS_Class__c: 'ust-content-centered',
            Section_Background__c: 'dark_purple',
            Section_Accent__c: 'green_circles',
            Button_Placement__c: 'Above',
            Button_Size__c: 'large'
        };
        const preview = (element) => element.shadowRoot.querySelector('c-ust-static-content');
        const change = (element, apiName, value) =>
            getInputField(element, apiName).dispatchEvent(new CustomEvent('change', { detail: { value } }));
        const clickReset = async (element) => {
            Array.from(element.shadowRoot.querySelectorAll('lightning-button'))
                .find((button) => button.label === 'Reset').click();
            await flushPromises();
        };

        async function openWithLateFields() {
            const element = createEditor();
            [1, 2, 3, 4].forEach(() => loadRecord(element, FIRST));
            await flushPromises();
            loadRecord(element, LATER);
            await flushPromises();
            return element;
        }

        it('offers the Section Background and Section Accent pickers for Static Content only', async () => {
            const element = createEditor();
            loadRecord(element, FIRST);
            await flushPromises();
            expect(getInputField(element, 'Section_Background__c')).toBeTruthy();
            expect(getInputField(element, 'Section_Accent__c')).toBeTruthy();

            change(element, 'Component_Name__c', 'ust_hero_banner');
            await flushPromises();
            expect(getInputField(element, 'Section_Background__c')).toBeUndefined();
            expect(getInputField(element, 'Section_Accent__c')).toBeUndefined();
        });

        it('gives the preview the saved style, background, accent, and button settings even though they arrive late', async () => {
            const element = await openWithLateFields();
            expect(preview(element).contentClass).toBe('ust-content-centered');
            expect(preview(element).sectionBackground).toBe('dark_purple');
            expect(preview(element).sectionAccent).toBe('green_circles');
            expect(preview(element).buttonPlacement).toBe('Above');
            expect(preview(element).buttonSize).toBe('large');
        });

        it('does not let the first loads (which lack these fields) leave the preview on blanks or defaults', async () => {
            const element = createEditor();
            loadRecord(element, FIRST);
            await flushPromises();
            expect(preview(element).sectionBackground).toBeFalsy();
            expect(preview(element).buttonPlacement).toBe('Below');
        });

        it('shows the picked background and accent in the preview straight away', async () => {
            const element = await openWithLateFields();
            change(element, 'Section_Background__c', 'gray');
            change(element, 'Section_Accent__c', 'purple_circles');
            await flushPromises();
            expect(preview(element).sectionBackground).toBe('gray');
            expect(preview(element).sectionAccent).toBe('purple_circles');

            change(element, 'Section_Background__c', '');
            await flushPromises();
            expect(preview(element).sectionBackground).toBeFalsy();
        });

        it('keeps an edit when the form loads again afterwards with the saved values', async () => {
            const element = await openWithLateFields();
            change(element, 'Section_Background__c', 'gray');
            change(element, 'Content_CSS_Class__c', 'ust-content-muted');
            loadRecord(element, LATER);
            loadRecord(element, LATER);
            await flushPromises();
            expect(preview(element).sectionBackground).toBe('gray');
            expect(preview(element).contentClass).toBe('ust-content-muted');
        });

        it('Reset returns the preview to the saved values, including the style class that used to be left behind', async () => {
            const element = await openWithLateFields();
            change(element, 'Section_Background__c', 'white');
            change(element, 'Section_Accent__c', '');
            change(element, 'Content_CSS_Class__c', 'ust-content-muted');
            await clickReset(element);
            expect(preview(element).sectionBackground).toBe('dark_purple');
            expect(preview(element).sectionAccent).toBe('green_circles');
            expect(preview(element).contentClass).toBe('ust-content-centered');
        });

        it('after Save, Reset returns to what was just saved', async () => {
            const element = await openWithLateFields();
            change(element, 'Section_Background__c', 'light_purple');
            getForm(element).dispatchEvent(new CustomEvent('success', { detail: { id: RECORD_ID } }));
            await flushPromises();
            change(element, 'Section_Background__c', 'white');
            await clickReset(element);
            expect(preview(element).sectionBackground).toBe('light_purple');
        });

        it('reads these fields again for a different widget', async () => {
            const element = await openWithLateFields();
            const OTHER_ID = 'a1Nhs0000004OTHERAA';
            element.recordId = OTHER_ID;
            getForm(element).dispatchEvent(new CustomEvent('load', {
                detail: { records: { [OTHER_ID]: { fields: {
                    Component_Name__c: { value: 'ust_static_content' },
                    Section_Background__c: { value: 'gray' }
                } } } }
            }));
            await flushPromises();
            expect(preview(element).sectionBackground).toBe('gray');
        });
    });

    describe('card grid widgets', () => {
        // Recorded shape: the first loads carry the always-present fields; the grid settings join later.
        const GRID_FIRST = { Component_Name__c: 'ust_card_grid', Zone__c: 'body', Page_Context__c: 'home', Static_Content__c: '<p>Intro</p>' };
        const GRID_LATER = { ...GRID_FIRST, Grid_Columns__c: '4', Card_Bottom_Bar__c: 'none' };
        const SAVED_GRID = { columns: '4', bottomBar: 'none', cards: [{ id: 'c1', title: 'Card', linkType: null }] };
        const cardsHeading = (element) =>
            Array.from(element.shadowRoot.querySelectorAll('.ust-section-title')).find((h) => h.textContent === 'Cards') || null;
        const gridPreviewHost = (element) => element.shadowRoot.querySelector('c-ust-card-grid');
        const itemEditor = (element) => element.shadowRoot.querySelector('c-ust-widget-item-editor');
        const change = (element, apiName, value) =>
            getInputField(element, apiName).dispatchEvent(new CustomEvent('change', { detail: { value } }));

        beforeEach(() => {
            getGridPreview.mockReset();
            getGridPreview.mockResolvedValue(SAVED_GRID);
        });

        async function openGrid() {
            const element = createEditor();
            [1, 2, 3].forEach(() => loadRecord(element, GRID_FIRST));
            await flushPromises();
            loadRecord(element, GRID_LATER);
            await flushPromises();
            return element;
        }

        it('shows the Cards section, with both grid settings and the cards editor, for a Card Grid only', async () => {
            const element = createEditor();
            loadRecord(element, GRID_FIRST);
            await flushPromises();
            expect(cardsHeading(element)).not.toBeNull();
            expect(getInputField(element, 'Grid_Columns__c')).toBeTruthy();
            expect(getInputField(element, 'Card_Bottom_Bar__c')).toBeTruthy();
            expect(itemEditor(element)).not.toBeNull();
            expect(itemEditor(element).widgetId).toBe(RECORD_ID);

            const other = createEditor();
            loadRecord(other, { Component_Name__c: 'ust_static_content', Zone__c: 'body', Page_Context__c: 'home' });
            await flushPromises();
            expect(cardsHeading(other)).toBeNull();
            expect(itemEditor(other)).toBeNull();
            const hero = createEditor();
            loadRecord(hero, { Component_Name__c: 'ust_hero_banner', Zone__c: 'body', Page_Context__c: 'home' });
            await flushPromises();
            expect(cardsHeading(hero)).toBeNull();
        });

        it('keeps the Content section, with heading, text and buttons, for a Card Grid', async () => {
            const element = createEditor();
            loadRecord(element, GRID_FIRST);
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-ust-rich-text-editor')).not.toBeNull();
            expect(element.shadowRoot.querySelector('c-ust-widget-button-editor')).not.toBeNull();
        });

        it('previews the grid with the saved settings, read from the later load, and asks Apex for it', async () => {
            const element = await openGrid();
            expect(getGridPreview).toHaveBeenLastCalledWith({ widgetId: RECORD_ID, columns: '4', bottomBar: 'none' });
            expect(gridPreviewHost(element)).not.toBeNull();
            expect(gridPreviewHost(element).grid).toEqual(SAVED_GRID);
            expect(gridPreviewHost(element).previewMode).toBe(true);
            expect(element.shadowRoot.querySelector('c-ust-static-content')).toBeNull();
        });

        it('passes the heading, text and section choices to the grid preview', async () => {
            const element = createEditor();
            loadRecord(element, { ...GRID_FIRST, Static_Content_Header__c: 'Impact' });
            await flushPromises();
            loadRecord(element, { ...GRID_LATER, Static_Content_Header__c: 'Impact', Section_Background__c: 'gray', Section_Accent__c: 'purple_circles' });
            await flushPromises();
            expect(gridPreviewHost(element).textHeader).toBe('Impact');
            expect(gridPreviewHost(element).sectionBackground).toBe('gray');
            expect(gridPreviewHost(element).sectionAccent).toBe('purple_circles');
        });

        it('previews a change of columns or bar at once, using the choices on screen (not yet saved)', async () => {
            const element = await openGrid();
            getGridPreview.mockClear();
            change(element, 'Grid_Columns__c', '2');
            await flushPromises();
            expect(getGridPreview).toHaveBeenLastCalledWith({ widgetId: RECORD_ID, columns: '2', bottomBar: 'none' });
            change(element, 'Card_Bottom_Bar__c', 'green');
            await flushPromises();
            expect(getGridPreview).toHaveBeenLastCalledWith({ widgetId: RECORD_ID, columns: '2', bottomBar: 'green' });
        });

        it('treats a blank choice as the default (3 columns, green)', async () => {
            const element = await openGrid();
            change(element, 'Grid_Columns__c', '');
            change(element, 'Card_Bottom_Bar__c', '');
            await flushPromises();
            expect(getGridPreview).toHaveBeenLastCalledWith({ widgetId: RECORD_ID, columns: '3', bottomBar: 'green' });
        });

        it('refreshes the preview when the cards editor says the cards changed, and stops that event there', async () => {
            const element = await openGrid();
            getGridPreview.mockClear();
            const bubbled = jest.fn();
            element.addEventListener('itemschange', bubbled);
            itemEditor(element).dispatchEvent(new CustomEvent('itemschange', { bubbles: true, composed: true }));
            await flushPromises();
            expect(getGridPreview).toHaveBeenCalledTimes(1);
            expect(bubbled).not.toHaveBeenCalled();
        });

        it('uses only the newest answer when two requests overlap', async () => {
            const element = await openGrid();
            let finishFirst;
            getGridPreview.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
            getGridPreview.mockResolvedValueOnce({ columns: '2', bottomBar: 'none', cards: [{ id: 'new', title: 'Newest' }] });
            change(element, 'Grid_Columns__c', '3');
            change(element, 'Grid_Columns__c', '2');
            await flushPromises();
            finishFirst({ columns: '3', bottomBar: 'none', cards: [{ id: 'old', title: 'Stale' }] });
            // Wait for the late answer AND for any re-render it would cause, so the check sees the final state.
            await flushPromises();
            await flushPromises();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(gridPreviewHost(element).grid.cards[0].title).toBe('Newest');
        });

        it('keeps an edit when the form loads again afterwards with the saved values', async () => {
            const element = await openGrid();
            change(element, 'Grid_Columns__c', '2');
            loadRecord(element, GRID_LATER);
            loadRecord(element, GRID_LATER);
            await flushPromises();
            expect(getGridPreview).toHaveBeenLastCalledWith({ widgetId: RECORD_ID, columns: '2', bottomBar: 'none' });
        });

        it('Reset returns the grid settings to the saved values and refreshes the preview', async () => {
            const element = await openGrid();
            change(element, 'Grid_Columns__c', '2');
            change(element, 'Card_Bottom_Bar__c', 'green');
            await flushPromises();
            getGridPreview.mockClear();
            Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((b) => b.label === 'Reset').click();
            await flushPromises();
            expect(getGridPreview).toHaveBeenLastCalledWith({ widgetId: RECORD_ID, columns: '4', bottomBar: 'none' });
        });

        it('after Save, Reset returns to what was just saved', async () => {
            const element = await openGrid();
            change(element, 'Grid_Columns__c', '2');
            getForm(element).dispatchEvent(new CustomEvent('success', { detail: { id: RECORD_ID } }));
            await flushPromises();
            change(element, 'Grid_Columns__c', '3');
            await flushPromises();
            getGridPreview.mockClear();
            Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((b) => b.label === 'Reset').click();
            await flushPromises();
            expect(getGridPreview).toHaveBeenLastCalledWith({ widgetId: RECORD_ID, columns: '2', bottomBar: 'none' });
        });

        it('loads the preview when an existing widget is switched to Card Grid', async () => {
            const element = createEditor();
            loadRecord(element, { Component_Name__c: 'ust_static_content', Zone__c: 'body', Page_Context__c: 'home' });
            await flushPromises();
            expect(getGridPreview).not.toHaveBeenCalled();
            change(element, 'Component_Name__c', 'ust_card_grid');
            await flushPromises();
            expect(getGridPreview).toHaveBeenCalledWith({ widgetId: RECORD_ID, columns: '3', bottomBar: 'green' });
            expect(itemEditor(element)).not.toBeNull();
        });

        it('asks Apex for nothing, and says to save first, for a widget that does not exist yet', async () => {
            const element = createElement('c-ust-widget-record-editor', { is: UstWidgetRecordEditor });
            document.body.appendChild(element);
            await flushPromises();
            change(element, 'Component_Name__c', 'ust_card_grid');
            await flushPromises();
            expect(getGridPreview).not.toHaveBeenCalled();
            expect(itemEditor(element).widgetId).toBeFalsy();
        });

        it('shows no cards in the preview, rather than failing, when Apex cannot be reached', async () => {
            getGridPreview.mockRejectedValue(new Error('offline'));
            const element = await openGrid();
            expect(gridPreviewHost(element)).not.toBeNull();
            expect(gridPreviewHost(element).grid).toBeFalsy();
        });

        it('disables the cards editor while the widget is saving', async () => {
            const element = await openGrid();
            expect(itemEditor(element).disabled).toBeFalsy();
        });
    });

    describe('button layout (links list)', () => {
        const FIRST = { Component_Name__c: 'ust_static_content', Zone__c: 'body', Page_Context__c: 'home', Static_Content__c: '<p>Hi</p>' };
        const LATER = { ...FIRST, Button_Layout__c: 'list_compact' };
        const buttonEditor = (element) => element.shadowRoot.querySelector('c-ust-widget-button-editor');
        const previewHost = (element) => element.shadowRoot.querySelector('c-ust-static-content');
        const change = (element, apiName, value) =>
            getInputField(element, apiName).dispatchEvent(new CustomEvent('change', { detail: { value } }));
        const clickReset = async (element) => {
            Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((b) => b.label === 'Reset').click();
            await flushPromises();
        };

        async function openWithLayout(record = FIRST, later = LATER) {
            const element = createEditor();
            [1, 2, 3].forEach(() => loadRecord(element, record));
            await flushPromises();
            loadRecord(element, later);
            await flushPromises();
            return element;
        }

        it('offers the picker for Static Content and Card Grid, not for the Hero Banner', async () => {
            const staticContent = createEditor();
            loadRecord(staticContent, FIRST);
            await flushPromises();
            expect(getInputField(staticContent, 'Button_Layout__c')).toBeTruthy();

            const grid = createEditor();
            loadRecord(grid, { ...FIRST, Component_Name__c: 'ust_card_grid' });
            await flushPromises();
            expect(getInputField(grid, 'Button_Layout__c')).toBeTruthy();

            const hero = createEditor();
            loadRecord(hero, { ...FIRST, Component_Name__c: 'ust_hero_banner' });
            await flushPromises();
            expect(getInputField(hero, 'Button_Layout__c')).toBeUndefined();
        });

        it('gives the button editor and the preview the saved layout, read from the later load', async () => {
            const element = await openWithLayout();
            expect(buttonEditor(element).buttonLayout).toBe('list_compact');
            expect(previewHost(element).buttonLayout).toBe('list_compact');
        });

        it('shows a row of buttons (no layout) until a layout has loaded or been chosen', async () => {
            const element = createEditor();
            loadRecord(element, FIRST);
            await flushPromises();
            expect(buttonEditor(element).buttonLayout).toBeFalsy();
            expect(previewHost(element).buttonLayout).toBeFalsy();
        });

        it('previews a changed layout at once and tells the button editor', async () => {
            const element = await openWithLayout();
            change(element, 'Button_Layout__c', 'list');
            await flushPromises();
            expect(previewHost(element).buttonLayout).toBe('list');
            expect(buttonEditor(element).buttonLayout).toBe('list');
            change(element, 'Button_Layout__c', '');
            await flushPromises();
            expect(previewHost(element).buttonLayout).toBeFalsy();
            expect(buttonEditor(element).buttonLayout).toBeFalsy();
        });

        it('passes the layout to the Card Grid preview too', async () => {
            const grid = { ...FIRST, Component_Name__c: 'ust_card_grid' };
            const element = await openWithLayout(grid, { ...grid, Button_Layout__c: 'list' });
            expect(element.shadowRoot.querySelector('c-ust-card-grid').buttonLayout).toBe('list');
        });

        it('never gives the Hero Banner a layout, even if the record has one stored', async () => {
            const hero = { ...FIRST, Component_Name__c: 'ust_hero_banner' };
            const element = await openWithLayout(hero, { ...hero, Button_Layout__c: 'list' });
            expect(buttonEditor(element).buttonLayout).toBeFalsy();
            expect(element.shadowRoot.querySelector('c-ust-hero-banner').buttonLayout).toBeUndefined();
        });

        it('keeps an edit when the form loads again afterwards with the saved layout', async () => {
            const element = await openWithLayout();
            change(element, 'Button_Layout__c', 'list');
            loadRecord(element, LATER);
            loadRecord(element, LATER);
            await flushPromises();
            expect(previewHost(element).buttonLayout).toBe('list');
        });

        it('Reset returns to the saved layout, and after Save to what was just saved', async () => {
            const element = await openWithLayout();
            change(element, 'Button_Layout__c', 'list');
            await flushPromises();
            await clickReset(element);
            expect(previewHost(element).buttonLayout).toBe('list_compact');

            change(element, 'Button_Layout__c', 'list');
            getForm(element).dispatchEvent(new CustomEvent('success', { detail: { id: RECORD_ID } }));
            await flushPromises();
            change(element, 'Button_Layout__c', '');
            await clickReset(element);
            expect(previewHost(element).buttonLayout).toBe('list');
        });
    });

    describe('card order', () => {
        /** The visible card titles, top to bottom. */
        function cardTitles(element) {
            return Array.from(element.shadowRoot.querySelectorAll('section.ust-section h2')).map((heading) =>
                heading.textContent.trim()
            );
        }

        it('puts Content directly below Widget Setup and Preview directly above Audience Filters for Static Content', async () => {
            const element = createEditor();
            loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
            await flushPromises();

            expect(cardTitles(element)).toEqual([
                'Widget Setup', 'Content', 'Call-to-action buttons', 'Preview', 'Audience Filters'
            ]);
        });

        it('keeps the same two anchors for a Hero Banner, which adds its own card in between', async () => {
            const element = createEditor();
            loadRecord(element, { Component_Name__c: 'ust_hero_banner', Page_Context__c: 'home' });
            await flushPromises();

            const titles = cardTitles(element);
            expect(titles).toEqual([
                'Widget Setup', 'Content', 'Call-to-action buttons', 'Hero Banner', 'Preview', 'Audience Filters'
            ]);
            expect(titles[1]).toBe('Content');
            expect(titles[titles.length - 2]).toBe('Preview');
        });

        it('shows only the setup and filter cards for a widget type with no content', async () => {
            const element = createEditor();
            loadRecord(element, { Component_Name__c: 'ust_links_hub', Page_Context__c: 'home' });
            await flushPromises();

            expect(cardTitles(element)).toEqual(['Widget Setup', 'Audience Filters']);
        });

        it('keeps the order after switching the widget type in the editor', async () => {
            const element = createEditor();
            loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
            await flushPromises();
            getInputField(element, 'Component_Name__c').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'ust_hero_banner' } })
            );
            await flushPromises();

            const titles = cardTitles(element);
            expect(titles[0]).toBe('Widget Setup');
            expect(titles[1]).toBe('Content');
            expect(titles[titles.length - 2]).toBe('Preview');
            expect(titles[titles.length - 1]).toBe('Audience Filters');
        });

        it('gives the buttons and the preview their own cards, with the button editor inside the buttons card', async () => {
            const element = createEditor();
            loadRecord(element, { Component_Name__c: 'ust_static_content', Page_Context__c: 'home' });
            await flushPromises();

            const sections = Array.from(element.shadowRoot.querySelectorAll('section.ust-section'));
            const buttonsCard = sections.find((section) => section.querySelector('h2').textContent.trim() === 'Call-to-action buttons');
            const previewCard = sections.find((section) => section.querySelector('h2').textContent.trim() === 'Preview');
            const contentCard = sections.find((section) => section.querySelector('h2').textContent.trim() === 'Content');

            expect(buttonsCard.querySelector('c-ust-widget-button-editor')).not.toBeNull();
            expect(previewCard.querySelector('c-ust-static-content')).not.toBeNull();
            expect(contentCard.querySelector('c-ust-widget-button-editor')).toBeNull();
            expect(contentCard.querySelector('c-ust-static-content')).toBeNull();
        });
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

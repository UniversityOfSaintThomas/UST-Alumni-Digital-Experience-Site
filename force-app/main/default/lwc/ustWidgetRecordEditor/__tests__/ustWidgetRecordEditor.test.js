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

    it('shows a success toast after saving', async () => {
        const element = createEditor();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        getForm(element).dispatchEvent(new CustomEvent('success', { detail: { id: RECORD_ID } }));

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');
    });
});

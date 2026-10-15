import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getTagDefinitions from '@salesforce/apex/PortalDataTags.getTagDefinitions';
import { resolveTags, sampleValues, MODE_HTML, MODE_TEXT } from 'c/ustDataTags';
import getHeroImages from '@salesforce/apex/PortalHero.getHeroImages';
import { parseButtonsJson, resolveButtonsForPreview } from 'c/ustButtonRules';

/**
 * ustWidgetRecordEditor
 *
 * Custom edit layout for UST_Portal_Widget__c. Replaces the classic page layout with:
 *   1. Widget Setup    - always shown
 *   2. Content         - shown only for widget types listed in COMPONENT_SECTIONS
 *      (header, style class, rich text editor with Heading 2-5, and a live preview)
 *   3. Audience Filters - always shown
 *
 * The Hero Banner widget type also shows a Hero section: two image uploads (the S3 uploader component), alt
 * text, height, text position, and overlay. The uploader writes the image addresses to the record itself,
 * so those two fields are deliberately NOT inputs on this form (a later Save would overwrite the fresh
 * upload with the form's stale copy); they are read back with PortalHero.getHeroImages after each upload.
 *
 * ADDING A CONDITIONAL SECTION LATER
 *   1. Add the Component_Name__c value and the new section key to COMPONENT_SECTIONS.
 *   2. Add a getter (like showContentSection) and a matching template block in the HTML.
 *   3. Include any new field values in handleSubmit if they are not lightning-input-field.
 */

/** Which optional sections each Component_Name__c value turns on. */
const COMPONENT_SECTIONS = {
    ust_static_content: ['content'],
    ust_hero_banner: ['content', 'hero']
};

const HERO_COMPONENT = 'ust_hero_banner';

/**
 * Uploader settings. The suffix is required: the S3 tool builds the file name from it, and a missing suffix
 * is written as the literal text "null". Desktop is a wide crop; mobile a squarer one.
 */
const DESKTOP_IMAGE = { field: 'Hero_Image_URL__c', suffix: '-hero', width: 1600, height: 600 };
const MOBILE_IMAGE = { field: 'Hero_Mobile_Image_URL__c', suffix: '-hero-mobile', width: 800, height: 640 };

export default class UstWidgetRecordEditor extends NavigationMixin(LightningElement) {
    /** Record Id; blank when used to create a new widget. */
    @api recordId;

    /** Object API name; set automatically on record pages. */
    @api objectApiName = 'UST_Portal_Widget__c';

    componentName = '';
    zone = '';
    pageContext = '';
    contentHeader = '';
    contentClass = '';
    buttonsJson = '';
    buttonPlacement = 'Below';
    buttonSize = '';
    staticContent = '';

    // Hero Banner settings (the two image addresses are read separately; see class comment).
    heroAltText = '';
    heroHeight = 'medium';
    heroTextPosition = 'left';
    heroOverlay = 'medium';
    heroImageUrl = '';
    heroMobileImageUrl = '';
    _imageStamp = Date.now();
    _imagesRequested = false;

    /** Values as last loaded or saved, used by Reset. */
    _savedStaticContent = '';
    _savedContentHeader = '';
    _savedHeroAltText = '';
    _savedHeroHeight = 'medium';
    _savedHeroTextPosition = 'left';
    _savedHeroOverlay = 'medium';
    _savedButtonsJson = '';
    _savedButtonPlacement = 'Below';
    _savedButtonSize = '';
    _savedZone = '';
    _savedPageContext = '';

    isSaving = false;

    /** Available {{data tags}} from Apex; feeds the Insert data tag lists and the preview. */
    dataTags = [];

    /** When checked, the preview shows what a guest sees (fallbacks only) instead of sample values. */
    previewAsGuest = false;

    connectedCallback() {
        // The S3 uploader (a child) fires a bubbling lightning__refresh after each upload or delete.
        this.template.addEventListener('lightning__refresh', (event) => this.handleImageRefresh(event));
    }

    @wire(getTagDefinitions)
    wiredTagDefinitions({ data }) {
        if (data) {
            this.dataTags = data;
        }
    }

    // ---- Section visibility ----

    get activeSections() {
        return COMPONENT_SECTIONS[this.componentName] || [];
    }

    get showContentSection() {
        return this.activeSections.includes('content');
    }

    get showHeroSection() {
        return this.activeSections.includes('hero');
    }

    get isHero() {
        return this.componentName === HERO_COMPONENT;
    }

    /** The panel style only applies to Static Content; a hero has its own look. */
    get showPanelStyle() {
        return !this.isHero;
    }

    get headerLabel() {
        return this.isHero ? 'Headline' : 'Static Content Header';
    }

    get bodyLabel() {
        return this.isHero ? 'Overlay text' : 'Static Content';
    }

    get hasRecord() {
        return !!this.recordId;
    }

    get desktopImage() {
        return DESKTOP_IMAGE;
    }

    get mobileImage() {
        return MOBILE_IMAGE;
    }

    // ---- Form events ----

    /**
     * Reads the loaded record so conditional sections and the editor start
     * with the saved values. Fires for existing records only.
     *
     * @param {CustomEvent} event load event from lightning-record-edit-form
     */
    handleLoad(event) {
        const records = event.detail && event.detail.records;
        const record = records && this.recordId ? records[this.recordId] : null;
        if (!record) {
            return;
        }
        const fields = record.fields;
        this.componentName = this.readFieldValue(fields, 'Component_Name__c');
        this.zone = this.readFieldValue(fields, 'Zone__c');
        this.pageContext = this.readFieldValue(fields, 'Page_Context__c');
        this._savedZone = this.zone;
        this._savedPageContext = this.pageContext;
        this.contentHeader = this.readFieldValue(fields, 'Static_Content_Header__c');
        this.contentClass = this.readFieldValue(fields, 'Content_CSS_Class__c');
        this.staticContent = this.readFieldValue(fields, 'Static_Content__c');
        this.buttonsJson = this.readFieldValue(fields, 'Buttons_JSON__c');
        this.buttonPlacement = this.readFieldValue(fields, 'Button_Placement__c') || 'Below';
        this.buttonSize = this.readFieldValue(fields, 'Button_Size__c');
        this.heroAltText = this.readFieldValue(fields, 'Hero_Alt_Text__c');
        this.heroHeight = this.readFieldValue(fields, 'Hero_Height__c') || 'medium';
        this.heroTextPosition = this.readFieldValue(fields, 'Hero_Text_Position__c') || 'left';
        this.heroOverlay = this.readFieldValue(fields, 'Hero_Overlay__c') || 'medium';
        this._savedStaticContent = this.staticContent;
        this._savedContentHeader = this.contentHeader;
        this._savedButtonsJson = this.buttonsJson;
        this._savedButtonPlacement = this.buttonPlacement;
        this._savedButtonSize = this.buttonSize;
        this._savedHeroAltText = this.heroAltText;
        this._savedHeroHeight = this.heroHeight;
        this._savedHeroTextPosition = this.heroTextPosition;
        this._savedHeroOverlay = this.heroOverlay;
        if (this.isHero && !this._imagesRequested) {
            this._imagesRequested = true;
            this.loadHeroImages();
        }
    }

    /**
     * Safely reads one field value from a UI API record payload.
     *
     * @param {Object} fields record.fields map
     * @param {string} apiName field API name
     * @return {string} the value, or '' when absent
     */
    readFieldValue(fields, apiName) {
        return fields && fields[apiName] && fields[apiName].value ? fields[apiName].value : '';
    }

    handleComponentChange(event) {
        this.componentName = event.detail.value || '';
        if (this.isHero && this.hasRecord && !this._imagesRequested) {
            this._imagesRequested = true;
            this.loadHeroImages();
        }
    }

    handleZoneChange(event) {
        this.zone = event.detail.value || '';
    }

    handlePageContextChange(event) {
        event.stopPropagation();
        this.pageContext = event.detail.value;
    }

    handlePreviewAsGuestChange(event) {
        this.previewAsGuest = event.target.checked;
    }

    /** Body shown in the preview, with data tags resolved from sample values (or as a guest). */
    get previewContent() {
        return resolveTags(this.staticContent, this.previewValues, this.dataTags, MODE_HTML);
    }

    /** Header shown in the preview, with data tags resolved. */
    get previewHeader() {
        return resolveTags(this.contentHeader, this.previewValues, this.dataTags, MODE_TEXT);
    }

    get previewValues() {
        return this.previewAsGuest ? {} : sampleValues(this.dataTags);
    }

    get hasTagsInContent() {
        return (
            (this.staticContent || '').includes('{{') ||
            (this.contentHeader || '').includes('{{') ||
            (this.buttonsJson || '').includes('{{')
        );
    }

    handleHeaderChange(event) {
        event.stopPropagation();
        this.contentHeader = event.detail.value || '';
    }

    handleClassChange(event) {
        this.contentClass = event.detail.value || '';
    }

    handleButtonsChange(event) {
        event.stopPropagation();
        this.buttonsJson = event.detail.value || '';
    }

    handlePlacementChange(event) {
        this.buttonPlacement = event.detail.value || 'Below';
    }

    handleSizeChange(event) {
        this.buttonSize = event.detail.value || '';
    }

    /** Buttons as the portal will show them: tags filled in with sample values, unsafe ones dropped. */
    get previewButtons() {
        return resolveButtonsForPreview(parseButtonsJson(this.buttonsJson), this.previewValues, this.dataTags);
    }

    handleEditorChange(event) {
        this.staticContent = event.detail.value;
    }

    // ---- Hero Banner ----

    handleHeroAltChange(event) {
        this.heroAltText = event.detail.value || '';
    }

    handleHeroHeightChange(event) {
        this.heroHeight = event.detail.value || 'medium';
    }

    handleHeroPositionChange(event) {
        this.heroTextPosition = event.detail.value || 'left';
    }

    handleHeroOverlayChange(event) {
        this.heroOverlay = event.detail.value || 'medium';
    }

    /**
     * The uploader fires a bubbling lightning__refresh event after every upload or delete. Left alone it
     * would make the record page reload this form and lose unsaved edits, so it stops here and only the
     * two image addresses are read again.
     *
     * @param {Event} event the refresh event
     */
    handleImageRefresh(event) {
        event.stopPropagation();
        this.loadHeroImages();
    }

    /** Reads the current image addresses (the uploader writes them straight to the record). */
    loadHeroImages() {
        if (!this.recordId) {
            return;
        }
        getHeroImages({ widgetId: this.recordId })
            .then((images) => {
                this.heroImageUrl = (images && images.imageUrl) || '';
                this.heroMobileImageUrl = (images && images.mobileImageUrl) || '';
                this._imageStamp = Date.now();
            })
            .catch(() => {
                // The preview simply shows no picture; the uploaders still work.
            });
    }

    /** Adds a throwaway value so a replaced picture (same file name) is not served from the browser cache. */
    bustCache(url) {
        return url ? url + (url.includes('?') ? '&' : '?') + 't=' + this._imageStamp : '';
    }

    get hasHeroImage() {
        return !!this.heroImageUrl;
    }

    /** Picture settings as the preview needs them (mirrors the server's PortalHero). */
    get previewHero() {
        return {
            imageUrl: this.bustCache(this.heroImageUrl),
            mobileImageUrl: this.bustCache(this.heroMobileImageUrl),
            altText: this.heroAltText,
            height: this.heroHeight,
            textPosition: this.heroTextPosition,
            overlay: this.heroOverlay
        };
    }

    get missingAltText() {
        return this.showHeroSection && this.hasHeroImage && !(this.heroAltText || '').trim();
    }

    /**
     * Adds the custom-editor value to the save payload and submits.
     * Static_Content__c is not a lightning-input-field, so it must be set here.
     *
     * @param {CustomEvent} event submit event from lightning-record-edit-form
     */
    handleSubmit(event) {
        event.preventDefault();
        const fields = { ...event.detail.fields };

        const picker = this.template.querySelector('c-ust-page-context-picker');
        if (picker && !picker.checkValidity()) {
            this.showToast('Page Context is required', 'Choose at least one page for this widget.', 'error');
            return;
        }
        // Page Context is edited by the custom picker, so it is not a lightning-input-field.
        fields.Page_Context__c = this.pageContext;

        if (this.showContentSection) {
            const buttonEditor = this.template.querySelector('c-ust-widget-button-editor');
            if (buttonEditor && buttonEditor.hasOpenDraft()) {
                this.showToast(
                    'Finish the button first',
                    'Add or cancel the button you are editing, then save the widget.',
                    'error'
                );
                return;
            }
            const editor = this.template.querySelector('c-ust-rich-text-editor');
            if (editor && !editor.checkValidity()) {
                this.showToast('Content is too long', 'Shorten the content before saving.', 'error');
                return;
            }
            fields.Static_Content__c = this.staticContent;
            fields.Static_Content_Header__c = this.contentHeader;
            fields.Buttons_JSON__c = this.buttonsJson;
        }

        if (this.missingAltText) {
            this.showToast(
                'Describe the picture',
                'Add alt text for the hero image so people using screen readers know what it shows.',
                'error'
            );
            return;
        }

        this.isSaving = true;
        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleSuccess(event) {
        this.isSaving = false;
        this._savedStaticContent = this.staticContent;
        this._savedContentHeader = this.contentHeader;
        this._savedButtonsJson = this.buttonsJson;
        this._savedButtonPlacement = this.buttonPlacement;
        this._savedButtonSize = this.buttonSize;
        this._savedHeroAltText = this.heroAltText;
        this._savedHeroHeight = this.heroHeight;
        this._savedHeroTextPosition = this.heroTextPosition;
        this._savedHeroOverlay = this.heroOverlay;
        this._savedZone = this.zone;
        this._savedPageContext = this.pageContext;
        this.showToast('Saved', 'Portal widget saved.', 'success');
        if (!this.recordId) {
            this.navigateToRecord(event.detail.id);
        }
    }

    handleError() {
        this.isSaving = false;
    }

    /** Puts every field, including the editor, back to the last saved values. */
    handleReset() {
        this.template.querySelectorAll('lightning-input-field').forEach((field) => {
            field.reset();
        });
        this.staticContent = this._savedStaticContent;
        this.contentHeader = this._savedContentHeader;
        this.heroAltText = this._savedHeroAltText;
        this.heroHeight = this._savedHeroHeight;
        this.heroTextPosition = this._savedHeroTextPosition;
        this.heroOverlay = this._savedHeroOverlay;
        this.buttonsJson = this._savedButtonsJson;
        this.buttonPlacement = this._savedButtonPlacement;
        this.buttonSize = this._savedButtonSize;
        this.zone = this._savedZone;
        this.pageContext = this._savedPageContext;
    }

    // ---- Helpers ----

    navigateToRecord(newRecordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: newRecordId,
                objectApiName: this.objectApiName,
                actionName: 'view'
            }
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
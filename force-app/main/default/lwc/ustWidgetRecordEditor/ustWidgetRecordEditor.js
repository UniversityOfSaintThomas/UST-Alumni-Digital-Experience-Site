import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getTagDefinitions from '@salesforce/apex/PortalDataTags.getTagDefinitions';
import { resolveTags, sampleValues, MODE_HTML, MODE_TEXT } from 'c/ustDataTags';
import getHeroImages from '@salesforce/apex/PortalHero.getHeroImages';
import { parseButtonsJson, resolveButtonsForPreview } from 'c/ustButtonRules';
import getGridPreview from '@salesforce/apex/PortalCardGrid.getGridPreview';

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
 * Several inputs are only drawn once the widget type is known (panel style, section background and accent, button
 * placement and size, the hero settings), so the form does not request them in its first load. Those arrive in
 * LATER load events and are read the first time each one appears (see LATE_FIELDS and initialiseLateFields).
 *
 * ADDING A CONDITIONAL SECTION LATER
 *   1. Add the Component_Name__c value and the new section key to COMPONENT_SECTIONS.
 *   2. Add a getter (like showContentSection) and a matching template block in the HTML.
 *   3. Include any new field values in handleSubmit if they are not lightning-input-field.
 */

/** Which optional sections each Component_Name__c value turns on. */
const COMPONENT_SECTIONS = {
    ust_static_content: ['content'],
    ust_hero_banner: ['content', 'hero'],
    ust_card_grid: ['content', 'cards']
};

const HERO_COMPONENT = 'ust_hero_banner';
const CARD_GRID_COMPONENT = 'ust_card_grid';
const DEFAULT_GRID_COLUMNS = '3';
const DEFAULT_CARD_BAR = 'green';

/**
 * Inputs that only join the form after the widget type is known, so they are missing from the first "load" and
 * arrive in a later one. Each is copied into the editor (state, plus the saved copy that Reset returns to) the
 * FIRST time a load contains it. To add one: put it here, give it a state property and a saved copy, and
 * handle it in applyLateField, handleReset and handleSuccess.
 */
const LATE_FIELDS = [
    'Content_CSS_Class__c',
    'Section_Background__c',
    'Section_Accent__c',
    'Button_Placement__c',
    'Button_Size__c',
    'Grid_Columns__c',
    'Card_Bottom_Bar__c'
];

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
    sectionBackground = '';
    sectionAccent = '';
    gridColumns = DEFAULT_GRID_COLUMNS;
    cardBottomBar = DEFAULT_CARD_BAR;
    /** The grid as the portal would draw it (from PortalCardGrid.getGridPreview); null until loaded. */
    gridPreview = null;
    buttonsJson = '';
    buttonPlacement = 'Below';
    buttonSize = '';
    staticContent = '';

    // Hero Banner settings (the two image addresses are read separately; see class comment).
    heroAltText = '';
    heroHeight = 'medium';
    heroLayout = 'full';
    heroTextPosition = 'left';
    heroOverlay = 'medium';
    heroImageUrl = '';
    heroMobileImageUrl = '';
    _imageStamp = Date.now();
    _imagesRequested = false;

    /** Values as last loaded or saved, used by Reset. */
    _savedStaticContent = '';
    _savedContentHeader = '';
    _savedContentClass = '';
    _savedSectionBackground = '';
    _savedSectionAccent = '';
    _savedGridColumns = DEFAULT_GRID_COLUMNS;
    _savedCardBottomBar = DEFAULT_CARD_BAR;
    _gridPreviewRequest = 0;
    _savedHeroAltText = '';
    _savedHeroHeight = 'medium';
    _savedHeroLayout = 'full';
    _savedHeroTextPosition = 'left';
    _savedHeroOverlay = 'medium';
    _savedButtonsJson = '';
    _savedButtonPlacement = 'Below';
    _savedButtonSize = '';
    _savedZone = '';
    _savedPageContext = '';
    _savedComponentName = '';

    /** The record the form values were last initialised from (see handleLoad). */
    _initialisedRecordId;

    /** The record whose Hero Banner settings were read (they arrive in a later load; see initialiseHeroSettings). */
    _heroInitialisedRecordId;

    /** "recordId:fieldName" for each late field already read (see initialiseLateFields). */
    _lateFieldsRead = new Set();

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

    get showCardsSection() {
        return this.activeSections.includes('cards');
    }

    get isCardGrid() {
        return this.componentName === CARD_GRID_COMPONENT;
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
     * Reads the loaded record so conditional sections and the editor start with the saved values.
     * Fires for existing records only.
     *
     * The form fires "load" again whenever its field list changes, and that happens right after the user edits
     * something: switching Component Name to Hero Banner adds the hero fields, so the form re-fetches and
     * reports the SAVED values again. Copying those over the editor would silently undo the edit (the dropdown
     * still shows the new choice but the sections snap back). So the editor is initialised once per record and
     * later load events are ignored; Save and Reset keep the saved copies up to date.
     *
     * @param {CustomEvent} event load event from lightning-record-edit-form
     */
    handleLoad(event) {
        const records = event.detail && event.detail.records;
        const record = records && this.recordId ? records[this.recordId] : null;
        if (!record) {
            return;
        }
        // The hero fields only join the form after the first load has told us the widget is a Hero Banner, so they
        // arrive in a LATER load. They are read the first time they appear, whether or not this is the first load.
        this.initialiseHeroSettings(record.fields);
        this.initialiseLateFields(record.fields);
        if (this._initialisedRecordId === this.recordId) {
            return;
        }
        this._initialisedRecordId = this.recordId;
        const fields = record.fields;
        this.componentName = this.readFieldValue(fields, 'Component_Name__c');
        this._savedComponentName = this.componentName;
        this.zone = this.readFieldValue(fields, 'Zone__c');
        this.pageContext = this.readFieldValue(fields, 'Page_Context__c');
        this._savedZone = this.zone;
        this._savedPageContext = this.pageContext;
        this.contentHeader = this.readFieldValue(fields, 'Static_Content_Header__c');
        this.staticContent = this.readFieldValue(fields, 'Static_Content__c');
        this.buttonsJson = this.readFieldValue(fields, 'Buttons_JSON__c');
        this._savedStaticContent = this.staticContent;
        this._savedContentHeader = this.contentHeader;
        this._savedButtonsJson = this.buttonsJson;
        if (this.isHero && !this._imagesRequested) {
            this._imagesRequested = true;
            this.loadHeroImages();
        }
    }

    /**
     * Reads the Hero Banner settings from a loaded record, once per record, the first time a load actually
     * contains them. Before that the form has not asked for them (the hero inputs are only drawn for a Hero
     * Banner), and after that a later load would only repeat the SAVED values and undo the user's edits.
     * Nothing can have been edited before the first read, because the hero inputs were not on screen.
     *
     * @param {Object} fields record.fields map from a load event
     */
    initialiseHeroSettings(fields) {
        const hasHeroFields = Object.keys(fields || {}).some((name) => name.startsWith('Hero_'));
        if (!hasHeroFields || this._heroInitialisedRecordId === this.recordId) {
            return;
        }
        this._heroInitialisedRecordId = this.recordId;
        this.heroAltText = this.readFieldValue(fields, 'Hero_Alt_Text__c');
        this.heroHeight = this.readFieldValue(fields, 'Hero_Height__c') || 'medium';
        this.heroLayout = this.readFieldValue(fields, 'Hero_Layout__c') || 'full';
        this.heroTextPosition = this.readFieldValue(fields, 'Hero_Text_Position__c') || 'left';
        // Blank means None (no overlay), exactly as the portal treats it; only a NEW widget starts on Medium.
        this.heroOverlay = this.readFieldValue(fields, 'Hero_Overlay__c') || 'none';
        this._savedHeroAltText = this.heroAltText;
        this._savedHeroHeight = this.heroHeight;
        this._savedHeroLayout = this.heroLayout;
        this._savedHeroTextPosition = this.heroTextPosition;
        this._savedHeroOverlay = this.heroOverlay;
    }

    /**
     * Reads each late input (see LATE_FIELDS) the first time a load contains it, once per record. Until then the
     * input was not on screen, so the user cannot have edited it; afterwards a later load would only repeat the
     * SAVED value and undo their edit, so it is ignored.
     *
     * @param {Object} fields record.fields map from a load event
     */
    initialiseLateFields(fields) {
        LATE_FIELDS.forEach((name) => {
            const key = this.recordId + ':' + name;
            if (!fields || !(name in fields) || this._lateFieldsRead.has(key)) {
                return;
            }
            this._lateFieldsRead.add(key);
            this.applyLateField(name, this.readFieldValue(fields, name));
        });
    }

    /**
     * Copies one late field into the editor state and its saved copy.
     *
     * @param {string} name field API name, one of LATE_FIELDS
     * @param {string} value the saved value ('' when blank)
     */
    applyLateField(name, value) {
        switch (name) {
            case 'Content_CSS_Class__c':
                this.contentClass = value;
                this._savedContentClass = value;
                break;
            case 'Section_Background__c':
                this.sectionBackground = value;
                this._savedSectionBackground = value;
                break;
            case 'Section_Accent__c':
                this.sectionAccent = value;
                this._savedSectionAccent = value;
                break;
            case 'Button_Placement__c':
                this.buttonPlacement = value || 'Below';
                this._savedButtonPlacement = this.buttonPlacement;
                break;
            case 'Button_Size__c':
                this.buttonSize = value;
                this._savedButtonSize = value;
                break;
            case 'Grid_Columns__c':
                this.gridColumns = value || DEFAULT_GRID_COLUMNS;
                this._savedGridColumns = this.gridColumns;
                this.refreshGridPreview();
                break;
            case 'Card_Bottom_Bar__c':
                this.cardBottomBar = value || DEFAULT_CARD_BAR;
                this._savedCardBottomBar = this.cardBottomBar;
                this.refreshGridPreview();
                break;
            default:
                break;
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
        if (this.isCardGrid) {
            this.refreshGridPreview();
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

    handleColumnsChange(event) {
        this.gridColumns = event.detail.value || DEFAULT_GRID_COLUMNS;
        this.refreshGridPreview();
    }

    handleBarChange(event) {
        this.cardBottomBar = event.detail.value || DEFAULT_CARD_BAR;
        this.refreshGridPreview();
    }

    /** The cards changed (the cards editor saves them itself), so ask for the grid again. */
    handleItemsChange(event) {
        event.stopPropagation();
        this.refreshGridPreview();
    }

    /**
     * Asks Apex how the grid looks with the cards as saved and the two grid choices as they are on screen, so the
     * preview applies exactly the portal's rules (pictures, links, limits) with no copy of them here. Only the
     * latest answer is used.
     */
    refreshGridPreview() {
        if (!this.isCardGrid || !this.recordId) {
            return;
        }
        this._gridPreviewRequest += 1;
        const request = this._gridPreviewRequest;
        getGridPreview({ widgetId: this.recordId, columns: this.gridColumns, bottomBar: this.cardBottomBar })
            .then((grid) => {
                if (request === this._gridPreviewRequest) {
                    this.gridPreview = grid;
                }
            })
            .catch(() => {
                // The preview simply shows no cards; the cards editor reports its own problems.
            });
    }

    handleBackgroundChange(event) {
        this.sectionBackground = event.detail.value || '';
    }

    handleAccentChange(event) {
        this.sectionAccent = event.detail.value || '';
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

    handleHeroLayoutChange(event) {
        this.heroLayout = event.detail.value || 'full';
    }

    handleHeroPositionChange(event) {
        this.heroTextPosition = event.detail.value || 'left';
    }

    handleHeroOverlayChange(event) {
        this.heroOverlay = event.detail.value || 'none';
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
            layout: this.heroLayout,
            textPosition: this.heroTextPosition,
            overlay: this.heroOverlay
        };
    }

    /** True while the Split layout is chosen: Text position and Overlay have no effect then. */
    get heroIsSplit() {
        return this.heroLayout === 'split';
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
        this._savedContentClass = this.contentClass;
        this._savedSectionBackground = this.sectionBackground;
        this._savedSectionAccent = this.sectionAccent;
        this._savedGridColumns = this.gridColumns;
        this._savedCardBottomBar = this.cardBottomBar;
        this._savedButtonsJson = this.buttonsJson;
        this._savedButtonPlacement = this.buttonPlacement;
        this._savedButtonSize = this.buttonSize;
        this._savedHeroAltText = this.heroAltText;
        this._savedHeroHeight = this.heroHeight;
        this._savedHeroLayout = this.heroLayout;
        this._savedHeroTextPosition = this.heroTextPosition;
        this._savedHeroOverlay = this.heroOverlay;
        this._savedZone = this.zone;
        this._savedPageContext = this.pageContext;
        this._savedComponentName = this.componentName;
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
        this.contentClass = this._savedContentClass;
        this.sectionBackground = this._savedSectionBackground;
        this.sectionAccent = this._savedSectionAccent;
        this.gridColumns = this._savedGridColumns;
        this.cardBottomBar = this._savedCardBottomBar;
        this.refreshGridPreview();
        this.heroAltText = this._savedHeroAltText;
        this.heroHeight = this._savedHeroHeight;
        this.heroLayout = this._savedHeroLayout;
        this.heroTextPosition = this._savedHeroTextPosition;
        this.heroOverlay = this._savedHeroOverlay;
        this.buttonsJson = this._savedButtonsJson;
        this.buttonPlacement = this._savedButtonPlacement;
        this.buttonSize = this._savedButtonSize;
        this.componentName = this._savedComponentName;
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
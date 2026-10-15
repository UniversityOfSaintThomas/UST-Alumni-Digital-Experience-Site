import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

/**
 * ustWidgetRecordEditor
 *
 * Custom edit layout for UST_Portal_Widget__c. Replaces the classic page layout with:
 *   1. Widget Setup    - always shown
 *   2. Content         - shown only for widget types listed in COMPONENT_SECTIONS
 *      (header, style class, rich text editor with Heading 2-5, and a live preview)
 *   3. Audience Filters - always shown
 *
 * ADDING A CONDITIONAL SECTION LATER
 *   1. Add the Component_Name__c value and the new section key to COMPONENT_SECTIONS.
 *   2. Add a getter (like showContentSection) and a matching template block in the HTML.
 *   3. Include any new field values in handleSubmit if they are not lightning-input-field.
 */

/** Which optional sections each Component_Name__c value turns on. */
const COMPONENT_SECTIONS = {
    ust_static_content: ['content']
};

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
    staticContent = '';

    /** Values as last loaded or saved, used by Reset. */
    _savedStaticContent = '';
    _savedZone = '';
    _savedPageContext = '';

    isSaving = false;

    // ---- Section visibility ----

    get activeSections() {
        return COMPONENT_SECTIONS[this.componentName] || [];
    }

    get showContentSection() {
        return this.activeSections.includes('content');
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
        this._savedStaticContent = this.staticContent;
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
    }

    handleZoneChange(event) {
        this.zone = event.detail.value || '';
    }

    handlePageContextChange(event) {
        event.stopPropagation();
        this.pageContext = event.detail.value;
    }

    handleHeaderChange(event) {
        this.contentHeader = event.detail.value || '';
    }

    handleClassChange(event) {
        this.contentClass = event.detail.value || '';
    }

    handleEditorChange(event) {
        this.staticContent = event.detail.value;
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
            const editor = this.template.querySelector('c-ust-rich-text-editor');
            if (editor && !editor.checkValidity()) {
                this.showToast('Content is too long', 'Shorten the content before saving.', 'error');
                return;
            }
            fields.Static_Content__c = this.staticContent;
        }

        this.isSaving = true;
        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleSuccess(event) {
        this.isSaving = false;
        this._savedStaticContent = this.staticContent;
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

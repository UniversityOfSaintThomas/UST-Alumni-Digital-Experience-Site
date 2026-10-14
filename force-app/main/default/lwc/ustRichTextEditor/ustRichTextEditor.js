import { LightningElement, api } from 'lwc';

/**
 * ustRichTextEditor
 *
 * Wraps lightning-input-rich-text and adds a "Paragraph style" dropdown
 * (Paragraph, Heading 2 - Heading 5) that the base toolbar does not offer.
 * Heading 1 is intentionally excluded: the portal page already supplies the
 * page-level h1, and Static_Content_Header__c renders as an h2.
 *
 * Headings use the base component's setFormat({ header: n }) / getFormat() API.
 *
 * Fires a `change` event whose detail is { value } (the HTML string).
 */

/** Maximum characters the Static_Content__c Html field can store. */
const DEFAULT_MAX_LENGTH = 32768;

/** Heading levels the dropdown offers. */
const HEADING_LEVELS = [2, 3, 4, 5];

/** Dropdown value used for a normal paragraph. */
const PARAGRAPH_VALUE = 'p';

/**
 * Formats allowed in the editor. 'header' is not part of any toolbar category,
 * so it must be listed explicitly. Font and colour formats are left out on
 * purpose so content picks up the portal's typography and brand colours.
 */
const ALLOWED_FORMATS = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'indent', 'align', 'link', 'image', 'clean', 'table'
];

/** Toolbar categories hidden so editors cannot override fonts or colours. */
const DISABLED_CATEGORIES = 'FORMAT_FONT,FORMAT_BACKGROUND';

/** Matches headings the portal does not want: h1 and h6. */
const DISALLOWED_HEADING_PATTERN = /<h[16][\s>]/i;

export default class UstRichTextEditor extends LightningElement {
    /** Visible label above the editor. */
    @api label = 'Content';

    /** Maximum HTML length; defaults to the Html field limit. */
    @api maxLength = DEFAULT_MAX_LENGTH;

    /** Disables both the dropdown and the editor. */
    @api disabled = false;

    _value = '';
    selectedStyle = PARAGRAPH_VALUE;

    /** HTML string held by the editor. */
    @api
    get value() {
        return this._value;
    }
    set value(newValue) {
        this._value = newValue || '';
    }

    /**
     * Returns true when the content is within the length limit.
     *
     * @return {boolean} true if valid
     */
    @api
    checkValidity() {
        return !this.isOverLimit;
    }

    /**
     * Reports validity to the user by rendering the error message.
     *
     * @return {boolean} true if valid
     */
    @api
    reportValidity() {
        return this.checkValidity();
    }

    /** Moves focus into the editor. */
    @api
    focus() {
        const editor = this.editor;
        if (editor) {
            editor.focus();
        }
    }

    get editor() {
        return this.template.querySelector('lightning-input-rich-text');
    }

    get formats() {
        return ALLOWED_FORMATS;
    }

    get disabledCategories() {
        return DISABLED_CATEGORIES;
    }

    get styleOptions() {
        const options = [{ label: 'Paragraph', value: PARAGRAPH_VALUE }];
        HEADING_LEVELS.forEach((level) => {
            options.push({ label: 'Heading ' + level, value: 'h' + level });
        });
        return options;
    }

    get currentLength() {
        return this._value.length;
    }

    get isOverLimit() {
        return this.currentLength > Number(this.maxLength);
    }

    get isValid() {
        return !this.isOverLimit;
    }

    get hasDisallowedHeadings() {
        return DISALLOWED_HEADING_PATTERN.test(this._value);
    }

    get counterClass() {
        return this.isOverLimit
            ? 'slds-text-body_small slds-text-color_error'
            : 'slds-text-body_small slds-text-color_weak';
    }

    get counterText() {
        return this.currentLength + ' / ' + this.maxLength + ' characters';
    }

    /**
     * Applies the chosen paragraph style to the current selection, then
     * returns focus to the editor so typing continues where the cursor was.
     *
     * @param {CustomEvent} event combobox change event
     */
    handleStyleChange(event) {
        // The combobox's own change event bubbles out of this component and would
        // be mistaken by the parent for a content change. Keep it internal.
        event.stopPropagation();
        const chosen = event.detail.value;
        const editor = this.editor;
        if (!editor) {
            return;
        }
        const level = chosen === PARAGRAPH_VALUE ? false : Number(chosen.substring(1));
        editor.setFormat({ header: level });
        this.selectedStyle = chosen;
        editor.focus();
    }

    /**
     * Keeps the dropdown in sync with the block under the cursor.
     * Called on click, key release, and focus because the base component
     * does not emit a selection-change event.
     */
    syncStyleToCursor() {
        const editor = this.editor;
        if (!editor || typeof editor.getFormat !== 'function') {
            return;
        }
        const format = editor.getFormat() || {};
        const level = Number(format.header);
        this.selectedStyle = HEADING_LEVELS.includes(level) ? 'h' + level : PARAGRAPH_VALUE;
    }

    /**
     * Stores the new HTML and forwards it to the parent.
     *
     * @param {CustomEvent} event change event from lightning-input-rich-text
     */
    handleEditorChange(event) {
        // Same reason as handleStyleChange: only our own re-dispatched event should reach the parent.
        event.stopPropagation();
        this._value = event.detail.value || '';
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this._value } }));
    }
}

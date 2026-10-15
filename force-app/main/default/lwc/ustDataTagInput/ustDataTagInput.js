import { LightningElement, api } from 'lwc';
import { findUnknownTags, tagToken } from 'c/ustDataTags';

/**
 * ustDataTagInput
 *
 * A plain text input with an "Insert data tag" list and a warning for unknown {{tags}}. Used for the
 * widget header (and, later, button labels). Tags are inserted at the cursor, replacing any selection.
 *
 * Fires `change` with detail { value }.
 */
export default class UstDataTagInput extends LightningElement {
    @api label = '';
    @api maxLength = 255;
    @api disabled = false;

    /** Available data tags ({ name, label, sample, allowInUrl }). */
    @api tagDefinitions = [];

    _value = '';

    @api
    get value() {
        return this._value;
    }
    set value(newValue) {
        this._value = newValue || '';
    }

    get input() {
        return this.template.querySelector('lightning-input');
    }

    get hasDataTags() {
        return Array.isArray(this.tagDefinitions) && this.tagDefinitions.length > 0;
    }

    get tagOptions() {
        return (this.tagDefinitions || []).map((tag) => ({
            label: tag.label + '  ' + tagToken(tag.name),
            value: tag.name
        }));
    }

    get unknownTagsText() {
        return findUnknownTags(this._value, this.tagDefinitions).join(', ');
    }

    get hasUnknownTags() {
        return this.unknownTagsText !== '';
    }

    handleInput(event) {
        event.stopPropagation();
        this._value = event.target.value || '';
        this.notifyChange();
    }

    /**
     * Inserts the chosen tag at the cursor, or over the selected text. lightning-input reports the
     * cursor through selectionStart/selectionEnd (which survive the input losing focus to this list)
     * but has no setRangeText method, so the new value is spliced together here.
     *
     * @param {CustomEvent} event combobox change event
     */
    handleInsertTag(event) {
        event.stopPropagation();
        const token = tagToken(event.detail.value);
        event.target.value = '';
        const input = this.input;
        const current = input && typeof input.value === 'string' ? input.value : this._value;
        const start = input && typeof input.selectionStart === 'number' ? input.selectionStart : current.length;
        const end = input && typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
        this._value = current.slice(0, start) + token + current.slice(end);
        this.notifyChange();
        if (input) {
            input.focus();
        }
    }

    notifyChange() {
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this._value } }));
    }
}

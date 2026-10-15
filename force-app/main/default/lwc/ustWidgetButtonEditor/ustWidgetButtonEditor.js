import { LightningElement, api } from 'lwc';
import getPortalLinkSuggestions from '@salesforce/apex/PortalButtons.getPortalLinkSuggestions';
import {
    ALIGN_OPTIONS, STYLE_OPTIONS, TYPE_EXTERNAL, TYPE_OPTIONS, TYPE_PORTAL,
    newButton, parseButtonsJson, serializeButtons, validateButton
} from 'c/ustButtonRules';

/**
 * ustWidgetButtonEditor
 *
 * Lets an admin add, edit, reorder, and delete a widget's call-to-action buttons. Changes are held in
 * memory and reported through `change` ({ value } = the JSON to store in Buttons_JSON__c); they are saved
 * together with the rest of the widget when the admin presses Save on the record.
 *
 * A button being added or edited is a "draft" that only joins the list when the admin presses Add/Update.
 * The parent asks hasOpenDraft() before saving so a half-finished button is never silently lost.
 *
 * The same rules the portal enforces (c/ustButtonRules, mirrored by the Apex class PortalButtons) are
 * checked here so mistakes are caught before they are saved.
 */
export default class UstWidgetButtonEditor extends LightningElement {
    /** Available data tags ({ name, label, sample, allowInUrl }) for labels and links. */
    @api tagDefinitions = [];

    /** Disables everything (used while the parent is saving). */
    @api disabled = false;

    buttons = [];
    draft = null;
    isNewDraft = false;
    errors = {};
    showErrors = false;
    suggestions = [];
    suggestionsFailed = false;

    _lastEmitted;

    typeOptions = TYPE_OPTIONS;
    styleOptions = STYLE_OPTIONS;
    alignOptions = ALIGN_OPTIONS;

    /** The stored JSON (Buttons_JSON__c). Ignored when it is the value this component just reported. */
    @api
    get value() {
        return serializeButtons(this.buttons);
    }
    set value(newValue) {
        const incoming = newValue || '';
        if (incoming === this._lastEmitted) {
            return;
        }
        this._lastEmitted = incoming;
        this.buttons = parseButtonsJson(incoming);
        this.cancelDraft();
    }

    /** True while a button is being added or edited and has not been added to the list yet. */
    @api
    hasOpenDraft() {
        return this.draft !== null;
    }

    connectedCallback() {
        getPortalLinkSuggestions()
            .then((result) => {
                this.suggestions = result || [];
            })
            .catch(() => {
                this.suggestionsFailed = true;
            });
    }

    // ---- List view ----

    get rows() {
        return this.buttons.map((button, index) => ({
            id: button.id,
            label: button.label || '(no text)',
            summary: this.describe(button),
            upDisabled: this.disabled || index === 0,
            downDisabled: this.disabled || index === this.buttons.length - 1,
            editLabel: 'Edit button ' + (button.label || index + 1),
            deleteLabel: 'Delete button ' + (button.label || index + 1),
            upLabel: 'Move button ' + (button.label || index + 1) + ' up',
            downLabel: 'Move button ' + (button.label || index + 1) + ' down'
        }));
    }

    get hasButtons() {
        return this.buttons.length > 0;
    }

    get countText() {
        return this.buttons.length === 1 ? '1 button' : this.buttons.length + ' buttons';
    }

    describe(button) {
        const styleLabel = (STYLE_OPTIONS.find((option) => option.value === button.style) || {}).label || button.style;
        const target = button.type === TYPE_PORTAL ? 'Portal page ' : 'Link ';
        return target + (button.url || '(no link)') + ' | ' + styleLabel;
    }

    get addDisabled() {
        return this.disabled || this.draft !== null;
    }

    // ---- Draft form ----

    get isEditing() {
        return this.draft !== null;
    }

    get formTitle() {
        return this.isNewDraft ? 'New button' : 'Edit button';
    }

    get submitLabel() {
        return this.isNewDraft ? 'Add button' : 'Update button';
    }

    get isExternal() {
        return this.draft !== null && this.draft.type === TYPE_EXTERNAL;
    }

    get isPortal() {
        return this.draft !== null && this.draft.type === TYPE_PORTAL;
    }

    /** Only tags that make sense in a link (identifiers) are offered for the link field. */
    get urlTagDefinitions() {
        return (this.tagDefinitions || []).filter((tag) => tag.allowInUrl);
    }

    get linkLabel() {
        return this.isPortal ? 'Page path (must start with /)' : 'Link (https://, mailto:, or tel:)';
    }

    get pageOptions() {
        return this.suggestions.map((suggestion) => ({
            label: suggestion.label + '  (' + suggestion.path + ')' + (suggestion.loginRequired ? '  - login required' : ''),
            value: suggestion.path
        }));
    }

    get hasPageOptions() {
        return this.suggestions.length > 0;
    }

    get selectedPage() {
        const match = this.suggestions.find((suggestion) => suggestion.path === this.draft.url);
        return match ? match.path : undefined;
    }

    get loginRequiredNote() {
        const match = this.suggestions.find((suggestion) => suggestion.path === this.draft.url);
        return match && match.loginRequired
            ? 'This page requires sign-in, so visitors who are not signed in will be asked to log in.'
            : '';
    }

    get draftLabel() {
        return this.draft.label;
    }

    get draftUrl() {
        return this.draft.url;
    }

    get draftNewTab() {
        return this.draft.newTab !== false;
    }

    get draftIcon() {
        return this.draft.icon || '';
    }

    get labelError() {
        return this.errors.label || '';
    }

    get urlError() {
        return this.errors.url || '';
    }

    get iconError() {
        return this.errors.icon || '';
    }

    get typeError() {
        return this.errors.type || '';
    }

    // ---- Actions ----

    handleAdd() {
        this.draft = newButton(TYPE_EXTERNAL);
        this.isNewDraft = true;
        this.errors = {};
        this.showErrors = false;
    }

    handleEdit(event) {
        const found = this.buttons.find((button) => button.id === event.currentTarget.dataset.id);
        if (found && this.draft === null) {
            this.draft = { ...found };
            this.isNewDraft = false;
            this.errors = {};
            this.showErrors = false;
        }
    }

    handleDelete(event) {
        const id = event.currentTarget.dataset.id;
        this.buttons = this.buttons.filter((button) => button.id !== id);
        if (this.draft && this.draft.id === id) {
            this.cancelDraft();
        }
        this.emitChange();
    }

    handleMoveUp(event) {
        this.move(event.currentTarget.dataset.id, -1);
    }

    handleMoveDown(event) {
        this.move(event.currentTarget.dataset.id, 1);
    }

    move(id, direction) {
        const index = this.buttons.findIndex((button) => button.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= this.buttons.length) {
            return;
        }
        const reordered = [...this.buttons];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        this.buttons = reordered;
        this.emitChange();
    }

    handleTypeChange(event) {
        event.stopPropagation();
        this.updateDraft({ type: event.detail.value });
    }

    handleLabelChange(event) {
        event.stopPropagation();
        this.updateDraft({ label: event.detail.value });
    }

    handleUrlChange(event) {
        event.stopPropagation();
        this.updateDraft({ url: event.detail.value });
    }

    handlePageChoice(event) {
        event.stopPropagation();
        this.updateDraft({ url: event.detail.value });
    }

    handleNewTabChange(event) {
        event.stopPropagation();
        this.updateDraft({ newTab: event.target.checked });
    }

    handleStyleChange(event) {
        event.stopPropagation();
        this.updateDraft({ style: event.detail.value });
    }

    handleAlignChange(event) {
        event.stopPropagation();
        this.updateDraft({ align: event.detail.value });
    }

    handleIconChange(event) {
        event.stopPropagation();
        this.updateDraft({ icon: event.target.value || '' });
    }

    handleSubmitDraft() {
        this.showErrors = true;
        this.errors = validateButton(this.draft, this.tagDefinitions);
        if (Object.keys(this.errors).length > 0) {
            return;
        }
        const finished = { ...this.draft };
        if (this.isNewDraft) {
            this.buttons = [...this.buttons, finished];
        } else {
            this.buttons = this.buttons.map((button) => (button.id === finished.id ? finished : button));
        }
        this.cancelDraft();
        this.emitChange();
    }

    handleCancelDraft() {
        this.cancelDraft();
    }

    // ---- Helpers ----

    updateDraft(changes) {
        this.draft = { ...this.draft, ...changes };
        if (this.showErrors) {
            this.errors = validateButton(this.draft, this.tagDefinitions);
        }
    }

    cancelDraft() {
        this.draft = null;
        this.isNewDraft = false;
        this.errors = {};
        this.showErrors = false;
    }

    emitChange() {
        this._lastEmitted = serializeButtons(this.buttons);
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this._lastEmitted } }));
    }
}

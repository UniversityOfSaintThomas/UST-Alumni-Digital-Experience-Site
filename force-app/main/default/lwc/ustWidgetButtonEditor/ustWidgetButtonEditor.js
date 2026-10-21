import { LightningElement, api } from 'lwc';
import getPortalLinkSuggestions from '@salesforce/apex/PortalButtons.getPortalLinkSuggestions';
import cleanNote from '@salesforce/apex/PortalButtons.cleanNote';
import {
    ALIGN_OPTIONS, MAX_ITEMS, MAX_NOTE_HTML, MAX_NOTES, STYLE_OPTIONS, TYPE_EXTERNAL, TYPE_OPTIONS, TYPE_PORTAL,
    isListLayout, isNote, newButton, newNote, noteLength, noteText, parseButtonsJson, serializeButtons, validateButton
} from 'c/ustButtonRules';

/**
 * A note allows only these formats; everything else is left out of the toolbar. The server rebuilds the note from
 * an allowlist whatever is sent, so this only keeps the toolbar honest.
 */
const NOTE_FORMATS = ['bold', 'italic', 'underline', 'link'];
const NOTE_DISABLED_CATEGORIES = 'FORMAT_FONT,FORMAT_BACKGROUND,FORMAT_BODY,ALIGN_TEXT,REMOVE_FORMATTING';

/**
 * ustWidgetButtonEditor
 *
 * Lets an admin add, edit, reorder, and delete a widget's call-to-action buttons. Changes are held in
 * memory and reported through `change` ({ value } = the JSON to store in Buttons_JSON__c); they are saved
 * together with the rest of the widget when the admin presses Save on the record.
 *
 * Besides buttons the list can hold short notes (a few words of formatted text shown between the rows of a
 * links list). A note is cleaned by the server when it is added (PortalButtons.cleanNote refuses with a message,
 * or returns the cleaned text that is stored), so no HTML cleaning is done here.
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

    /**
     * The widget's Button_Layout__c. In a links list each link is a row with an arrow, so the style, position
     * and icon of a link are not used and the form hides them.
     */
    @api buttonLayout = '';

    buttons = [];
    draft = null;
    isNewDraft = false;
    errors = {};
    showErrors = false;
    suggestions = [];
    suggestionsFailed = false;
    isNoteDraft = false;
    noteError = '';
    isCheckingNote = false;

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
        return this.buttons.map((button, index) => {
            const note = isNote(button);
            const name = note ? 'note ' + (index + 1) : 'button ' + (button.label || index + 1);
            return {
                id: button.id,
                isNote: note,
                label: note ? noteText(button.html) || '(empty note)' : button.label || '(no text)',
                summary: note ? 'Note | ' + noteLength(button.html) + ' of ' + MAX_NOTE_HTML + ' characters' : this.describe(button),
                upDisabled: this.disabled || index === 0,
                downDisabled: this.disabled || index === this.buttons.length - 1,
                editLabel: 'Edit ' + name,
                deleteLabel: 'Delete ' + name,
                upLabel: 'Move ' + name + ' up',
                downLabel: 'Move ' + name + ' down'
            };
        });
    }

    get hasButtons() {
        return this.buttons.length > 0;
    }

    get noteCount() {
        return this.buttons.filter((item) => isNote(item)).length;
    }

    get linkCount() {
        return this.buttons.length - this.noteCount;
    }

    get countText() {
        const links = this.linkCount === 1 ? '1 button' : this.linkCount + ' buttons';
        if (this.noteCount === 0) {
            return links;
        }
        return links + ', ' + (this.noteCount === 1 ? '1 note' : this.noteCount + ' notes');
    }

    get isList() {
        return isListLayout(this.buttonLayout);
    }

    /** Notes only show in a links list, or as a block between rows of buttons; both work, so always offered. */
    get atItemLimit() {
        return this.buttons.length >= MAX_ITEMS;
    }

    get atNoteLimit() {
        return this.noteCount >= MAX_NOTES;
    }

    get addLinkDisabled() {
        return this.addDisabled || this.atItemLimit;
    }

    get addNoteDisabled() {
        return this.addDisabled || this.atItemLimit || this.atNoteLimit;
    }

    get limitText() {
        if (this.atItemLimit) {
            return 'A widget can have at most ' + MAX_ITEMS + ' buttons and notes.';
        }
        if (this.atNoteLimit) {
            return 'A widget can have at most ' + MAX_NOTES + ' notes.';
        }
        return '';
    }

    get layoutHint() {
        return this.isList
            ? 'In a links list each link is a full-width row with an arrow. Style, position and icon are not used.'
            : '';
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
        if (this.isNoteDraft) {
            return this.isNewDraft ? 'New note' : 'Edit note';
        }
        return this.isNewDraft ? 'New button' : 'Edit button';
    }

    get submitLabel() {
        if (this.isNoteDraft) {
            return this.isNewDraft ? 'Add note' : 'Update note';
        }
        return this.isNewDraft ? 'Add button' : 'Update button';
    }

    // ---- Note form ----

    get noteFormats() {
        return NOTE_FORMATS;
    }

    get noteDisabledCategories() {
        return NOTE_DISABLED_CATEGORIES;
    }

    get noteHtml() {
        return this.draft ? this.draft.html || '' : '';
    }

    get noteCounter() {
        return noteLength(this.noteHtml) + ' of ' + MAX_NOTE_HTML + ' characters (formatting counts too)';
    }

    get noteOverLimit() {
        return noteLength(this.noteHtml) > MAX_NOTE_HTML;
    }

    get noteValid() {
        return !this.noteOverLimit && !this.noteError;
    }

    get showLinkStyleFields() {
        return !this.isList;
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
        this.isNoteDraft = false;
        this.isNewDraft = true;
        this.errors = {};
        this.showErrors = false;
        this.noteError = '';
    }

    handleAddNote() {
        this.draft = newNote();
        this.isNoteDraft = true;
        this.isNewDraft = true;
        this.errors = {};
        this.showErrors = false;
        this.noteError = '';
    }

    handleEdit(event) {
        const found = this.buttons.find((button) => button.id === event.currentTarget.dataset.id);
        if (found && this.draft === null) {
            this.draft = { ...found };
            this.isNoteDraft = isNote(found);
            this.isNewDraft = false;
            this.errors = {};
            this.showErrors = false;
            this.noteError = '';
        }
    }

    handleNoteChange(event) {
        event.stopPropagation();
        this.draft = { ...this.draft, html: event.detail.value || '' };
        this.noteError = '';
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
        if (this.isNoteDraft) {
            this.submitNote();
            return;
        }
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

    /**
     * Sends the note to the server to be checked and cleaned. A refusal is shown and the note stays open; the
     * cleaned text it returns is what gets stored.
     */
    submitNote() {
        const html = this.draft.html || '';
        if (noteLength(html) > MAX_NOTE_HTML) {
            this.noteError = 'The note is too long (' + noteLength(html) + ' of ' + MAX_NOTE_HTML + ' characters). Shorten it.';
            return;
        }
        this.isCheckingNote = true;
        this.noteError = '';
        const draftId = this.draft.id;
        cleanNote({ html })
            .then((cleaned) => {
                if (!this.draft || this.draft.id !== draftId) {
                    return;
                }
                const finished = { id: draftId, kind: 'note', html: cleaned };
                if (this.isNewDraft) {
                    this.buttons = [...this.buttons, finished];
                } else {
                    this.buttons = this.buttons.map((item) => (item.id === draftId ? finished : item));
                }
                this.cancelDraft();
                this.emitChange();
            })
            .catch((error) => {
                this.noteError = (error && error.body && error.body.message) || 'The note could not be checked. Try again.';
            })
            .finally(() => {
                this.isCheckingNote = false;
            });
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
        this.isNoteDraft = false;
        this.noteError = '';
        this.isNewDraft = false;
        this.errors = {};
        this.showErrors = false;
    }

    emitChange() {
        this._lastEmitted = serializeButtons(this.buttons);
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this._lastEmitted } }));
    }
}
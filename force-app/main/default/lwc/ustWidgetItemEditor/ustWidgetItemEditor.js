import { LightningElement, api } from 'lwc';
import getEditorItems from '@salesforce/apex/PortalCardGrid.getEditorItems';
import saveItem from '@salesforce/apex/PortalCardGrid.saveItem';
import deleteItem from '@salesforce/apex/PortalCardGrid.deleteItem';
import reorder from '@salesforce/apex/PortalCardGrid.reorder';

/** Most cards a grid can hold (same as PortalCardGrid.MAX_CARDS). */
const MAX_CARDS = 24;

/** Uploader settings: a 3 by 2 crop, as the cards show. The suffix is required by the S3 tool. */
const PICTURE = { field: 'Image_URL__c', suffix: '-card', width: 600, height: 400 };

const BLANK_DRAFT = { id: null, title: '', text: '', imageUrl: '', altText: '', linkUrl: '', newTab: false };

/**
 * ustWidgetItemEditor
 *
 * The cards of one Card Grid widget: a list with move up / move down, edit and delete, and a form to add or
 * edit a card. Cards are saved one at a time through Apex (PortalCardGrid), which checks the picture address
 * and the link with the same rules the portal uses and answers with a message the admin can act on. The cards
 * are separate records, so they save immediately and are not part of the widget's Save or Reset.
 *
 * The picture uploader writes the address straight to the card record, so the form takes the new address from
 * the refresh it announces; otherwise a later Save would put the old address back.
 *
 * Fires "itemschange" after every change so the parent can refresh its preview.
 */
export default class UstWidgetItemEditor extends LightningElement {
    /** The Card Grid widget. Blank for a widget that is not saved yet. */
    @api
    get widgetId() {
        return this._widgetId;
    }
    set widgetId(value) {
        if (value !== this._widgetId) {
            this._widgetId = value;
            this.rows = [];
            this.draft = null;
            this.errorMessage = '';
            this.loadRows();
        }
    }

    /** Disables every control, for example while the widget itself is saving. */
    @api disabled = false;

    _widgetId;
    rows = [];
    draft = null;
    isLoading = false;
    isBusy = false;
    errorMessage = '';
    confirmDeleteId = null;
    /** Changes whenever the picture changes, so the thumbnail does not show a cached copy. */
    pictureStamp = Date.now();

    get hasWidget() {
        return !!this._widgetId;
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    get isEditing() {
        return this.draft !== null;
    }

    get isSavedCard() {
        return !!(this.draft && this.draft.id);
    }

    get formTitle() {
        return this.isSavedCard ? 'Edit card' : 'New card';
    }

    get atLimit() {
        return this.rows.length >= MAX_CARDS;
    }

    get addDisabled() {
        return this.disabled || this.isBusy || this.atLimit || this.isEditing;
    }

    get controlsDisabled() {
        return this.disabled || this.isBusy;
    }

    get limitMessage() {
        return 'A grid can have at most ' + MAX_CARDS + ' cards.';
    }

    get picture() {
        return PICTURE;
    }

    get draftPictureSrc() {
        const url = this.draft && this.draft.imageUrl;
        if (!url || !/^https:\/\//i.test(url)) {
            return '';
        }
        return url + (url.includes('?') ? '&' : '?') + 'e=' + this.pictureStamp;
    }

    get rowViews() {
        return this.rows.map((row, index) => {
            const notes = [];
            if (row.imageUrl) {
                notes.push('picture');
            }
            if (row.linkUrl) {
                notes.push('link');
            }
            return {
                id: row.id,
                title: row.title,
                notes: notes.length ? notes.join(', ') : 'no picture or link',
                position: index + 1,
                moveUpLabel: 'Move ' + row.title + ' up',
                moveDownLabel: 'Move ' + row.title + ' down',
                editLabel: 'Edit ' + row.title,
                deleteLabel: 'Delete ' + row.title,
                upDisabled: this.controlsDisabled || index === 0,
                downDisabled: this.controlsDisabled || index === this.rows.length - 1,
                confirming: this.confirmDeleteId === row.id
            };
        });
    }

    connectedCallback() {
        // The S3 uploader fires a bubbling lightning__refresh after each upload or delete. A template attribute
        // cannot name that event (double underscore), so listen here. Stop it so the widget editor, which
        // listens for the hero picture's refresh, does not also react.
        this.template.addEventListener('lightning__refresh', (event) => this.handlePictureRefresh(event));
    }

    // ---- Loading ----

    loadRows() {
        if (!this._widgetId) {
            return Promise.resolve();
        }
        const requested = this._widgetId;
        this.isLoading = true;
        return getEditorItems({ widgetId: requested })
            .then((rows) => {
                if (requested === this._widgetId) {
                    this.rows = rows || [];
                }
            })
            .catch((error) => {
                this.errorMessage = this.messageFrom(error, 'The cards could not be loaded.');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // ---- Add and edit ----

    handleAdd() {
        this.errorMessage = '';
        this.confirmDeleteId = null;
        this.draft = { ...BLANK_DRAFT };
    }

    handleEdit(event) {
        const row = this.rows.find((candidate) => candidate.id === event.currentTarget.dataset.id);
        if (!row) {
            return;
        }
        this.errorMessage = '';
        this.confirmDeleteId = null;
        this.draft = {
            id: row.id,
            title: row.title || '',
            text: row.text || '',
            imageUrl: row.imageUrl || '',
            altText: row.altText || '',
            linkUrl: row.linkUrl || '',
            newTab: row.newTab === true
        };
    }

    handleDraftChange(event) {
        const field = event.currentTarget.dataset.field;
        const value = field === 'newTab' ? event.detail.checked === true : event.detail.value;
        this.draft = { ...this.draft, [field]: value };
    }

    handleCancel() {
        this.draft = null;
        this.errorMessage = '';
    }

    handleSaveCard() {
        const inputs = Array.from(this.template.querySelectorAll('.ust-item-input'));
        const valid = inputs.reduce((allValid, input) => input.reportValidity() && allValid, true);
        if (!valid) {
            return;
        }
        this.isBusy = true;
        this.errorMessage = '';
        saveItem({
            widgetId: this._widgetId,
            itemId: this.draft.id,
            title: this.draft.title,
            text: this.draft.text,
            imageUrl: this.draft.imageUrl,
            altText: this.draft.altText,
            linkUrl: this.draft.linkUrl,
            newTab: this.draft.newTab
        })
            .then(() => this.loadRows())
            .then(() => {
                this.draft = null;
                this.notifyChange();
            })
            .catch((error) => {
                this.errorMessage = this.messageFrom(error, 'The card could not be saved.');
            })
            .finally(() => {
                this.isBusy = false;
            });
    }

    /** The uploader changed the card's picture (it writes the address to the record itself). */
    handlePictureRefresh(event) {
        event.stopPropagation();
        const cardId = this.draft && this.draft.id;
        this.pictureStamp = Date.now();
        this.loadRows().then(() => {
            const fresh = this.rows.find((row) => row.id === cardId);
            if (fresh && this.draft && this.draft.id === cardId) {
                this.draft = { ...this.draft, imageUrl: fresh.imageUrl || '' };
            }
            this.notifyChange();
        });
    }

    handleRemovePicture() {
        this.draft = { ...this.draft, imageUrl: '' };
    }

    // ---- Delete (two clicks, no browser dialog) ----

    handleDeleteAsk(event) {
        this.confirmDeleteId = event.currentTarget.dataset.id;
    }

    handleDeleteCancel() {
        this.confirmDeleteId = null;
    }

    handleDeleteConfirm(event) {
        const itemId = event.currentTarget.dataset.id;
        this.isBusy = true;
        this.errorMessage = '';
        deleteItem({ widgetId: this._widgetId, itemId })
            .then(() => {
                this.confirmDeleteId = null;
                if (this.draft && this.draft.id === itemId) {
                    this.draft = null;
                }
                return this.loadRows();
            })
            .then(() => this.notifyChange())
            .catch((error) => {
                this.errorMessage = this.messageFrom(error, 'The card could not be deleted.');
            })
            .finally(() => {
                this.isBusy = false;
            });
    }

    // ---- Order ----

    handleMoveUp(event) {
        this.move(event.currentTarget.dataset.id, -1);
    }

    handleMoveDown(event) {
        this.move(event.currentTarget.dataset.id, 1);
    }

    move(itemId, step) {
        const ids = this.rows.map((row) => row.id);
        const from = ids.indexOf(itemId);
        const to = from + step;
        if (from < 0 || to < 0 || to >= ids.length) {
            return;
        }
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        this.isBusy = true;
        this.errorMessage = '';
        reorder({ widgetId: this._widgetId, orderedIds: ids })
            .then(() => this.loadRows())
            .then(() => this.notifyChange())
            .catch((error) => {
                this.errorMessage = this.messageFrom(error, 'The order could not be saved.');
            })
            .finally(() => {
                this.isBusy = false;
            });
    }

    // ---- Helpers ----

    notifyChange() {
        this.dispatchEvent(new CustomEvent('itemschange'));
    }

    messageFrom(error, fallback) {
        const body = error && error.body;
        if (body && typeof body.message === 'string' && body.message) {
            return body.message;
        }
        return fallback;
    }
}

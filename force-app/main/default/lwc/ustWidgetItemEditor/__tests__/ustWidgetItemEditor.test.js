import { createElement } from 'lwc';
import UstWidgetItemEditor from 'c/ustWidgetItemEditor';
import getEditorItems from '@salesforce/apex/PortalCardGrid.getEditorItems';
import saveItem from '@salesforce/apex/PortalCardGrid.saveItem';
import deleteItem from '@salesforce/apex/PortalCardGrid.deleteItem';
import reorder from '@salesforce/apex/PortalCardGrid.reorder';

jest.mock('@salesforce/apex/PortalCardGrid.getEditorItems', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/PortalCardGrid.saveItem', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/PortalCardGrid.deleteItem', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/PortalCardGrid.reorder', () => ({ default: jest.fn() }), { virtual: true });

const WIDGET_ID = 'a1Nhs0000004WIDGET';

function row(id, title, extra = {}) {
    return { id, title, text: null, imageUrl: null, altText: null, linkUrl: null, newTab: false, sortOrder: 10, ...extra };
}

const THREE = [row('i1', 'First', { imageUrl: 'https://x.edu/a.jpg', linkUrl: '/alumni-directory' }), row('i2', 'Second'), row('i3', 'Third')];

const flush = async () => {
    for (let i = 0; i < 8; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
};

async function createEditor(properties = { widgetId: WIDGET_ID }, rows = THREE) {
    getEditorItems.mockResolvedValue(rows);
    const element = createElement('c-ust-widget-item-editor', { is: UstWidgetItemEditor });
    Object.assign(element, properties);
    document.body.appendChild(element);
    await flush();
    return element;
}

const q = (element, selector) => element.shadowRoot.querySelector(selector);
const qa = (element, selector) => Array.from(element.shadowRoot.querySelectorAll(selector));
const button = (element, label) => qa(element, 'lightning-button').find((b) => b.label === label);
const rowButtons = (element, index, label) => qa(element, 'li')[index].querySelector(`lightning-button-icon[title="${label}"]`);
const titles = (element) => qa(element, '.ust-item-title').map((n) => n.textContent);
const field = (element, name) => q(element, `[data-field="${name}"]`);
/** The base component stubs have a reportValidity that returns nothing; a real input answers true when valid. */
const makeInputsValid = (element) => qa(element, '.ust-item-input').forEach((input) => {
    input.reportValidity = jest.fn(() => true);
});
const saveCard = (element) => {
    makeInputsValid(element);
    button(element, 'Save card').click();
};
const type = (element, name, value) => field(element, name).dispatchEvent(new CustomEvent('change', { detail: { value } }));

describe('c-ust-widget-item-editor', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.resetAllMocks();
    });

    describe('loading and listing', () => {
        it('asks to save the widget first when there is no widget yet', async () => {
            const element = await createEditor({});
            expect(element.shadowRoot.textContent).toContain('Save the widget first');
            expect(getEditorItems).not.toHaveBeenCalled();
            expect(button(element, 'Add card')).toBeUndefined();
        });

        it('lists the cards in order with a note about what each has', async () => {
            const element = await createEditor();
            expect(getEditorItems).toHaveBeenCalledWith({ widgetId: WIDGET_ID });
            expect(titles(element)).toEqual(['First', 'Second', 'Third']);
            const notes = qa(element, '.ust-item-notes').map((n) => n.textContent);
            expect(notes).toEqual(['picture, link', 'no picture or link', 'no picture or link']);
        });

        it('says so when there are no cards', async () => {
            const element = await createEditor({ widgetId: WIDGET_ID }, []);
            expect(element.shadowRoot.textContent).toContain('No cards yet');
            expect(qa(element, 'li')).toHaveLength(0);
        });

        it('shows a message when the cards cannot be loaded', async () => {
            getEditorItems.mockRejectedValue({ body: { message: 'Insufficient access' } });
            const element = createElement('c-ust-widget-item-editor', { is: UstWidgetItemEditor });
            element.widgetId = WIDGET_ID;
            document.body.appendChild(element);
            await flush();
            expect(q(element, '[role="alert"]').textContent).toContain('Insufficient access');
        });

        it('reloads, and drops an open form, when it is pointed at another widget', async () => {
            const element = await createEditor();
            button(element, 'Add card').click();
            await flush();
            expect(q(element, '.ust-item-form')).not.toBeNull();
            getEditorItems.mockResolvedValue([row('z1', 'Elsewhere')]);
            element.widgetId = 'a1Nhs0000004OTHER0';
            await flush();
            expect(getEditorItems).toHaveBeenLastCalledWith({ widgetId: 'a1Nhs0000004OTHER0' });
            expect(titles(element)).toEqual(['Elsewhere']);
            expect(q(element, '.ust-item-form')).toBeNull();
        });
    });

    describe('adding a card', () => {
        it('opens an empty form, saves it through Apex as a new card, then reloads and announces the change', async () => {
            const element = await createEditor();
            const changed = jest.fn();
            element.addEventListener('itemschange', changed);
            button(element, 'Add card').click();
            await flush();
            expect(q(element, '.ust-item-form')).not.toBeNull();
            expect(button(element, 'Add card')).toBeUndefined();

            type(element, 'title', 'New card');
            type(element, 'text', 'Hello');
            type(element, 'linkUrl', 'https://www.stthomas.edu');
            type(element, 'imageUrl', 'https://x.edu/p.jpg');
            type(element, 'altText', 'A picture');
            field(element, 'newTab').dispatchEvent(new CustomEvent('change', { detail: { checked: true } }));
            saveItem.mockResolvedValue(row('i4', 'New card'));
            getEditorItems.mockResolvedValue([...THREE, row('i4', 'New card')]);
            saveCard(element);
            await flush();

            expect(saveItem).toHaveBeenCalledWith({
                widgetId: WIDGET_ID, itemId: null, title: 'New card', text: 'Hello', imageUrl: 'https://x.edu/p.jpg',
                altText: 'A picture', linkUrl: 'https://www.stthomas.edu', newTab: true
            });
            expect(titles(element)).toHaveLength(4);
            expect(q(element, '.ust-item-form')).toBeNull();
            expect(changed).toHaveBeenCalledTimes(1);
        });

        it('keeps the form open and shows the message when Apex refuses the card', async () => {
            const element = await createEditor();
            button(element, 'Add card').click();
            await flush();
            type(element, 'title', 'Bad link');
            type(element, 'linkUrl', 'javascript:alert(1)');
            saveItem.mockRejectedValue({ body: { message: 'The link must be a site page that starts with /' } });
            const changed = jest.fn();
            element.addEventListener('itemschange', changed);
            saveCard(element);
            await flush();

            expect(q(element, '[role="alert"]').textContent).toContain('The link must be a site page');
            expect(q(element, '.ust-item-form')).not.toBeNull();
            expect(field(element, 'linkUrl').value).toBe('javascript:alert(1)');
            expect(changed).not.toHaveBeenCalled();
        });

        it('falls back to a plain message when the error has no text', async () => {
            const element = await createEditor();
            button(element, 'Add card').click();
            await flush();
            type(element, 'title', 'x');
            saveItem.mockRejectedValue(new Error('boom'));
            saveCard(element);
            await flush();
            expect(q(element, '[role="alert"]').textContent).toContain('The card could not be saved.');
        });

        it('does not call Apex when a required field fails the browser check', async () => {
            const element = await createEditor();
            button(element, 'Add card').click();
            await flush();
            const title = field(element, 'title');
            title.reportValidity = jest.fn(() => false);
            button(element, 'Save card').click();
            await flush();
            expect(title.reportValidity).toHaveBeenCalled();
            expect(saveItem).not.toHaveBeenCalled();
        });

        it('cancels without saving', async () => {
            const element = await createEditor();
            button(element, 'Add card').click();
            await flush();
            button(element, 'Cancel').click();
            await flush();
            expect(q(element, '.ust-item-form')).toBeNull();
            expect(saveItem).not.toHaveBeenCalled();
        });

        it('says to save the card before uploading, and offers no uploader for a new card', async () => {
            const element = await createEditor();
            button(element, 'Add card').click();
            await flush();
            expect(q(element, 'c-aws-s3-directory-image')).toBeNull();
            expect(q(element, '.ust-item-form').textContent).toContain('save the card first');
        });
    });

    describe('editing a card', () => {
        it('fills the form with the saved values and saves it as that card', async () => {
            const element = await createEditor({ widgetId: WIDGET_ID }, [
                row('i1', 'First', { text: 'T', imageUrl: 'https://x.edu/a.jpg', altText: 'Alt', linkUrl: 'https://x.edu', newTab: true })
            ]);
            rowButtons(element, 0, 'Edit').click();
            await flush();
            expect(field(element, 'title').value).toBe('First');
            expect(field(element, 'text').value).toBe('T');
            expect(field(element, 'imageUrl').value).toBe('https://x.edu/a.jpg');
            expect(field(element, 'altText').value).toBe('Alt');
            expect(field(element, 'linkUrl').value).toBe('https://x.edu');
            expect(field(element, 'newTab').checked).toBe(true);

            type(element, 'title', 'First, renamed');
            saveItem.mockResolvedValue(row('i1', 'First, renamed'));
            saveCard(element);
            await flush();
            expect(saveItem).toHaveBeenCalledWith(expect.objectContaining({ widgetId: WIDGET_ID, itemId: 'i1', title: 'First, renamed' }));
        });

        it('offers the picture uploader for a saved card, set up like the hero uploader', async () => {
            const element = await createEditor();
            rowButtons(element, 1, 'Edit').click();
            await flush();
            const uploader = q(element, 'c-aws-s3-directory-image');
            expect(uploader).not.toBeNull();
            expect(uploader.recordId).toBe('i2');
            expect(uploader.imageField).toBe('Image_URL__c');
            expect(uploader.fileNameSuffix).toBe('-card');
            expect(uploader.imageMode).toBe('crop');
            expect(uploader.imageMaxWidth).toBe(600);
            expect(uploader.imageMaxHeight).toBe(400);
        });

        it('takes the new picture address from the record after an upload, so a later Save does not undo it', async () => {
            const element = await createEditor();
            rowButtons(element, 1, 'Edit').click();
            await flush();
            const changed = jest.fn();
            element.addEventListener('itemschange', changed);
            getEditorItems.mockResolvedValue([THREE[0], row('i2', 'Second', { imageUrl: 'https://bucket.x.edu/uploaded.jpg' }), THREE[2]]);
            q(element, 'c-aws-s3-directory-image').dispatchEvent(new CustomEvent('lightning__refresh', { bubbles: true, composed: true }));
            await flush();
            expect(field(element, 'imageUrl').value).toBe('https://bucket.x.edu/uploaded.jpg');
            expect(changed).toHaveBeenCalledTimes(1);
            expect(q(element, '.ust-item-thumb img').getAttribute('src')).toContain('https://bucket.x.edu/uploaded.jpg');
        });

        it('keeps the other edits when the picture changes underneath', async () => {
            const element = await createEditor();
            rowButtons(element, 1, 'Edit').click();
            await flush();
            type(element, 'title', 'Typed but not saved');
            getEditorItems.mockResolvedValue([THREE[0], row('i2', 'Second', { imageUrl: 'https://bucket.x.edu/up.jpg' }), THREE[2]]);
            q(element, 'c-aws-s3-directory-image').dispatchEvent(new CustomEvent('lightning__refresh', { bubbles: true, composed: true }));
            await flush();
            expect(field(element, 'title').value).toBe('Typed but not saved');
        });

        it('only draws a thumbnail for an https picture', async () => {
            const element = await createEditor();
            button(element, 'Add card').click();
            await flush();
            type(element, 'imageUrl', 'javascript:alert(1)');
            await flush();
            expect(q(element, '.ust-item-thumb')).toBeNull();
            type(element, 'imageUrl', 'https://x.edu/a.jpg');
            await flush();
            expect(q(element, '.ust-item-thumb img')).not.toBeNull();
            q(element, '.ust-item-thumb lightning-button').click();
            await flush();
            expect(field(element, 'imageUrl').value).toBe('');
        });
    });

    describe('deleting a card', () => {
        it('needs a second click, and Keep backs out', async () => {
            const element = await createEditor();
            rowButtons(element, 1, 'Delete').click();
            await flush();
            expect(deleteItem).not.toHaveBeenCalled();
            expect(button(element, 'Delete')).toBeDefined();
            button(element, 'Keep').click();
            await flush();
            expect(button(element, 'Delete')).toBeUndefined();
            expect(deleteItem).not.toHaveBeenCalled();
        });

        it('deletes that card through Apex, reloads, and announces the change', async () => {
            const element = await createEditor();
            const changed = jest.fn();
            element.addEventListener('itemschange', changed);
            rowButtons(element, 1, 'Delete').click();
            await flush();
            deleteItem.mockResolvedValue();
            getEditorItems.mockResolvedValue([THREE[0], THREE[2]]);
            button(element, 'Delete').click();
            await flush();
            expect(deleteItem).toHaveBeenCalledWith({ widgetId: WIDGET_ID, itemId: 'i2' });
            expect(titles(element)).toEqual(['First', 'Third']);
            expect(changed).toHaveBeenCalledTimes(1);
        });

        it('closes the form when the card being edited is deleted', async () => {
            const element = await createEditor();
            rowButtons(element, 0, 'Edit').click();
            await flush();
            rowButtons(element, 0, 'Delete').click();
            await flush();
            deleteItem.mockResolvedValue();
            getEditorItems.mockResolvedValue([THREE[1], THREE[2]]);
            button(element, 'Delete').click();
            await flush();
            expect(q(element, '.ust-item-form')).toBeNull();
        });

        it('shows a message when the delete fails', async () => {
            const element = await createEditor();
            rowButtons(element, 0, 'Delete').click();
            await flush();
            deleteItem.mockRejectedValue({ body: { message: 'That card no longer exists.' } });
            button(element, 'Delete').click();
            await flush();
            expect(q(element, '[role="alert"]').textContent).toContain('no longer exists');
        });
    });

    describe('order', () => {
        it('moves a card down by sending the new order, then reloads and announces the change', async () => {
            const element = await createEditor();
            const changed = jest.fn();
            element.addEventListener('itemschange', changed);
            reorder.mockResolvedValue();
            getEditorItems.mockResolvedValue([THREE[1], THREE[0], THREE[2]]);
            rowButtons(element, 0, 'Move down').click();
            await flush();
            expect(reorder).toHaveBeenCalledWith({ widgetId: WIDGET_ID, orderedIds: ['i2', 'i1', 'i3'] });
            expect(titles(element)).toEqual(['Second', 'First', 'Third']);
            expect(changed).toHaveBeenCalledTimes(1);
        });

        it('moves a card up', async () => {
            const element = await createEditor();
            reorder.mockResolvedValue();
            rowButtons(element, 2, 'Move up').click();
            await flush();
            expect(reorder).toHaveBeenCalledWith({ widgetId: WIDGET_ID, orderedIds: ['i1', 'i3', 'i2'] });
        });

        it('cannot move the first card up or the last card down', async () => {
            const element = await createEditor();
            expect(rowButtons(element, 0, 'Move up').disabled).toBe(true);
            expect(rowButtons(element, 0, 'Move down').disabled).toBe(false);
            expect(rowButtons(element, 2, 'Move down').disabled).toBe(true);
            expect(rowButtons(element, 2, 'Move up').disabled).toBe(false);
        });

        it('names the card in each control for screen readers', async () => {
            const element = await createEditor();
            expect(rowButtons(element, 1, 'Move up').alternativeText).toBe('Move Second up');
            expect(rowButtons(element, 1, 'Edit').alternativeText).toBe('Edit Second');
            expect(rowButtons(element, 1, 'Delete').alternativeText).toBe('Delete Second');
        });

        it('shows a message when reordering fails', async () => {
            const element = await createEditor();
            reorder.mockRejectedValue({ body: { message: 'No access' } });
            rowButtons(element, 0, 'Move down').click();
            await flush();
            expect(q(element, '[role="alert"]').textContent).toContain('No access');
        });
    });

    describe('limits and disabled state', () => {
        it('stops adding at 24 cards and says why', async () => {
            const many = Array.from({ length: 24 }, (_, i) => row('i' + i, 'Card ' + i));
            const element = await createEditor({ widgetId: WIDGET_ID }, many);
            expect(button(element, 'Add card').disabled).toBe(true);
            expect(element.shadowRoot.textContent).toContain('at most 24 cards');
        });

        it('disables every control while the widget is saving', async () => {
            const element = await createEditor({ widgetId: WIDGET_ID, disabled: true });
            expect(button(element, 'Add card').disabled).toBe(true);
            expect(rowButtons(element, 1, 'Edit').disabled).toBe(true);
            expect(rowButtons(element, 1, 'Delete').disabled).toBe(true);
            expect(rowButtons(element, 1, 'Move up').disabled).toBe(true);
        });
    });
});

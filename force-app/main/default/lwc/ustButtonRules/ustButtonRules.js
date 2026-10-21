/**
 * ustButtonRules
 *
 * Shared rules for call-to-action buttons: the options an admin can pick, link validation, storage
 * format, and a preview resolver. These mirror the Apex class PortalButtons, which re-checks everything
 * on every read; the portal never trusts what the editor allowed.
 *
 * Stored JSON: { "version": 1, "buttons": [{ id, label, type, url, newTab, style, align, icon }] }
 * A list can also hold short notes (shown between the rows of a links list): { id, kind: "note", html }. The
 * html was cleaned by Apex (PortalButtons.cleanNote) when it was added; the portal cleans it again on every read.
 *   type "external": https://, mailto:, or tel: link
 *   type "portal":   a path on this site such as /alumni-directory (base path is added at render time)
 */
import { MODE_TEXT, MODE_URL, parseTagBody, resolveTags } from 'c/ustDataTags';

export const TYPE_EXTERNAL = 'external';
export const TYPE_PORTAL = 'portal';
export const DEFAULT_STYLE = 'brand';
export const DEFAULT_ALIGN = 'left';
export const MAX_LABEL_LENGTH = 80;
export const MAX_URL_LENGTH = 2048;
export const KIND_NOTE = 'note';
/** Same limits as PortalButtons (Apex), which enforces them: a note counts its HTML tags too. */
export const MAX_NOTE_HTML = 500;
export const MAX_NOTES = 10;
export const MAX_ITEMS = 40;

export const LAYOUT_ROW = 'row';
export const LAYOUT_LIST = 'list';
export const LAYOUT_LIST_COMPACT = 'list_compact';
export const LAYOUT_OPTIONS = [
    { label: 'Row of buttons', value: LAYOUT_ROW },
    { label: 'Links list', value: LAYOUT_LIST },
    { label: 'Links list, compact (sidebar)', value: LAYOUT_LIST_COMPACT }
];

export const TYPE_OPTIONS = [
    { label: 'External link (https, email, or phone)', value: TYPE_EXTERNAL },
    { label: 'Portal page', value: TYPE_PORTAL }
];

export const STYLE_OPTIONS = [
    { label: 'Brand (solid purple)', value: 'brand' },
    { label: 'Outline', value: 'outline-brand' },
    { label: 'Neutral', value: 'neutral' },
    { label: 'Success', value: 'success' },
    { label: 'Destructive', value: 'destructive' },
    { label: 'Text link', value: 'text_link' },
    { label: 'Arrow link', value: 'arrow_link' },
    { label: 'Destructive text link', value: 'text-destructive' }
];

export const ALIGN_OPTIONS = [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'end' }
];

const STYLE_VALUES = STYLE_OPTIONS.map((option) => option.value);
const ALIGN_VALUES = ALIGN_OPTIONS.map((option) => option.value);

// No whitespace, control characters (U+0000-U+001F, U+007F), or backslashes anywhere in a link.
// Built from strings so the control-character ranges are written as escapes without a lint override.
const BAD = '\\s\\u0000-\\u001F\\u007F\\\\';
const HTTPS_PATTERN = new RegExp('^https://[^' + BAD + '/?#]+[^' + BAD + ']*$', 'i');
const MAILTO_PATTERN = new RegExp('^mailto:[^' + BAD + ']+$', 'i');
const TEL_PATTERN = /^tel:[+0-9().,;#*-]+$/i;
const PORTAL_PATH_PATTERN = new RegExp('^/(?!/)[^' + BAD + ']*$');
const ICON_PATTERN = /^(?:utility:)?([a-z0-9_]+)$/;
const TAG_ANYWHERE = /\{\{[^{}]*\}\}/g;

/**
 * Checks a fully resolved link against the allowlist for its type.
 *
 * @param {string} type TYPE_EXTERNAL or TYPE_PORTAL
 * @param {string} url the resolved URL
 * @return {boolean} true if the link is safe to render
 */
export function isAllowedUrl(type, url) {
    if (typeof url !== 'string' || url === '' || url.length > MAX_URL_LENGTH || url.includes('{{')) {
        return false;
    }
    if (type === TYPE_PORTAL) {
        return PORTAL_PATH_PATTERN.test(url);
    }
    if (type === TYPE_EXTERNAL) {
        return HTTPS_PATTERN.test(url) || MAILTO_PATTERN.test(url) || TEL_PATTERN.test(url);
    }
    return false;
}

/**
 * Accepts "heart" or "utility:heart" and returns "utility:heart"; anything else returns null.
 *
 * @param {string} rawIcon icon as typed
 * @return {string|null} normalized utility icon name
 */
export function normalizeIcon(rawIcon) {
    if (!rawIcon || !String(rawIcon).trim()) {
        return null;
    }
    const match = ICON_PATTERN.exec(String(rawIcon).trim().toLowerCase());
    return match ? 'utility:' + match[1] : null;
}

/**
 * @param {Object} item a stored button or note
 * @return {boolean} true for a note
 */
export function isNote(item) {
    return !!item && item.kind === KIND_NOTE;
}

/**
 * @param {string} layout a Button_Layout__c value
 * @return {boolean} true for either links list layout
 */
export function isListLayout(layout) {
    return layout === LAYOUT_LIST || layout === LAYOUT_LIST_COMPACT;
}

/**
 * Creates an empty note with a fresh id.
 *
 * @return {Object} a new note
 */
export function newNote() {
    return { id: 'n' + newButtonId().slice(1), kind: KIND_NOTE, html: '' };
}

/**
 * Counts a note the way the server does: the length of its HTML, tags included.
 *
 * @param {string} html the note as typed
 * @return {number} characters used
 */
export function noteLength(html) {
    return typeof html === 'string' ? html.length : 0;
}

/**
 * The words of a note without its tags, for a one-line summary in a list.
 *
 * @param {string} html the note
 * @return {string} plain text
 */
export function noteText(html) {
    return typeof html === 'string' ? html.replace(/<[^<>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

/**
 * Creates a button with sensible defaults and a fresh id.
 *
 * @param {string} type TYPE_EXTERNAL or TYPE_PORTAL
 * @return {Object} a new button
 */
export function newButton(type = TYPE_EXTERNAL) {
    return {
        id: newButtonId(),
        label: '',
        type,
        url: '',
        newTab: true,
        style: DEFAULT_STYLE,
        align: DEFAULT_ALIGN,
        icon: ''
    };
}

let idCounter = 0;

/**
 * Generates a stable id for a new button (unique within the widget; ids never depend on position).
 *
 * @return {string} for example "b1k3x9a"
 */
export function newButtonId() {
    idCounter += 1;
    return 'b' + Date.now().toString(36).slice(-4) + idCounter.toString(36) + Math.random().toString(36).slice(2, 5);
}

/**
 * Validates one button as the admin typed it (tags still in place) and returns messages by field.
 *
 * @param {Object} button the button
 * @param {Array<{name: string, label: string, allowInUrl: boolean}>} tagDefinitions available data tags
 * @return {Object} field name to message; empty when valid
 */
export function validateButton(button, tagDefinitions) {
    const problems = {};
    if (!button.label || !button.label.trim()) {
        problems.label = 'Enter the text for the button.';
    } else if (button.label.length > MAX_LABEL_LENGTH) {
        problems.label = 'Keep the button text to ' + MAX_LABEL_LENGTH + ' characters or fewer.';
    }

    if (button.type !== TYPE_EXTERNAL && button.type !== TYPE_PORTAL) {
        problems.type = 'Choose what the button links to.';
    }

    const url = (button.url || '').trim();
    if (!url) {
        problems.url = 'Enter where the button goes.';
    } else {
        const tagProblem = urlTagProblem(url, tagDefinitions);
        // Judge the link as it will look once tags are filled in.
        const filledIn = url.replace(TAG_ANYWHERE, 'x');
        if (tagProblem) {
            problems.url = tagProblem;
        } else if (!isAllowedUrl(button.type, filledIn)) {
            problems.url =
                button.type === TYPE_PORTAL
                    ? 'Start with a single / and no spaces, for example /alumni-directory.'
                    : 'Use a full https:// link, or a mailto: or tel: link, with no spaces.';
        }
    }

    if (button.icon && button.icon.trim() && !normalizeIcon(button.icon)) {
        problems.icon = 'Use a utility icon name such as heart or new_window.';
    }
    return problems;
}

/**
 * Finds data tags in a link that cannot work: unknown names, or tags not allowed in links.
 *
 * @param {string} url the link as typed
 * @param {Array} tagDefinitions available data tags
 * @return {string|null} a message, or null
 */
function urlTagProblem(url, tagDefinitions) {
    const byKey = new Map((tagDefinitions || []).map((definition) => [definition.name.toLowerCase(), definition]));
    for (const match of url.matchAll(TAG_ANYWHERE)) {
        const { key, name } = parseTagBody(match[0].slice(2, -2));
        const definition = byKey.get(key);
        if (!definition) {
            return 'Unknown data tag {{' + name + '}} in the link.';
        }
        if (!definition.allowInUrl) {
            return 'Only identifier tags (such as Banner ID and Contact Id) can be used in a link; {{' + name + '}} cannot.';
        }
    }
    return null;
}

/**
 * Reads one stored entry (a button or a note) leniently.
 *
 * @param {Object} item the stored entry
 * @param {number} index its position, used to make an id when none is stored
 * @return {Object} a button or a note with every field filled in
 */
function readItem(item, index) {
    if (item.kind === KIND_NOTE) {
        return {
            id: typeof item.id === 'string' && item.id ? item.id : 'n' + (index + 1),
            kind: KIND_NOTE,
            html: typeof item.html === 'string' ? item.html : ''
        };
    }
    return {
        id: typeof item.id === 'string' && item.id ? item.id : 'b' + (index + 1),
        label: typeof item.label === 'string' ? item.label : '',
        type: item.type === TYPE_PORTAL ? TYPE_PORTAL : TYPE_EXTERNAL,
        url: typeof item.url === 'string' ? item.url : '',
        newTab: typeof item.newTab === 'boolean' ? item.newTab : true,
        style: STYLE_VALUES.includes(item.style) ? item.style : DEFAULT_STYLE,
        align: ALIGN_VALUES.includes(item.align) ? item.align : DEFAULT_ALIGN,
        icon: typeof item.icon === 'string' ? item.icon : ''
    };
}

/**
 * Reads the stored JSON leniently. Bad data yields an empty list, never an error.
 *
 * @param {string} json the Buttons_JSON__c value
 * @return {Array<Object>} buttons and notes as stored (not yet validated)
 */
export function parseButtonsJson(json) {
    if (!json) {
        return [];
    }
    try {
        const parsed = JSON.parse(json);
        const list = parsed && Array.isArray(parsed.buttons) ? parsed.buttons : [];
        return list.filter((item) => item && typeof item === 'object').map(readItem);
    } catch {
        return [];
    }
}

/**
 * Writes one entry for storage. A note keeps no type or link, so an older release drops it instead of
 * showing it as a broken button.
 *
 * @param {Object} item a button or a note
 * @return {Object} the stored shape
 */
function writeItem(item) {
    if (isNote(item)) {
        return { id: item.id, kind: KIND_NOTE, html: item.html || '' };
    }
    return {
        id: item.id,
        label: (item.label || '').trim(),
        type: item.type,
        url: (item.url || '').trim(),
        newTab: item.type === TYPE_EXTERNAL ? item.newTab !== false : false,
        style: item.style,
        align: item.align,
        icon: item.icon && item.icon.trim() ? normalizeIcon(item.icon) || '' : ''
    };
}

/**
 * Builds the JSON to store. An empty list stores nothing.
 *
 * @param {Array<Object>} buttons the buttons and notes
 * @return {string} the JSON, or an empty string when there is nothing
 */
export function serializeButtons(buttons) {
    if (!buttons || buttons.length === 0) {
        return '';
    }
    return JSON.stringify({ version: 1, buttons: buttons.map(writeItem) });
}

/**
 * Resolves buttons the way the portal will (tags filled in, invalid ones dropped) for the admin preview.
 *
 * @param {Array<Object>} buttons stored buttons
 * @param {Object} values sample tag values keyed by lowercase tag name ({} for a guest)
 * @param {Array} tagDefinitions available data tags
 * @return {Array<Object>} buttons ready for the renderer
 */
export function resolveButtonsForPreview(buttons, values, tagDefinitions) {
    const ready = [];
    let notes = 0;
    // The server looks at the first MAX_ITEMS entries only (valid or not) and keeps at most MAX_NOTES notes.
    (buttons || []).slice(0, MAX_ITEMS).forEach((button) => {
        if (isNote(button)) {
            const html = typeof button.html === 'string' ? button.html : '';
            if (noteText(html) && !html.includes('{{') && html.length <= MAX_NOTE_HTML && notes < MAX_NOTES) {
                ready.push({ id: button.id, kind: KIND_NOTE, html });
                notes += 1;
            }
            return;
        }
        const label = (resolveTags(button.label, values, tagDefinitions, MODE_TEXT) || '').trim();
        const url = resolveTags((button.url || '').trim(), values, tagDefinitions, MODE_URL);
        if (!label || !isAllowedUrl(button.type, url)) {
            return;
        }
        ready.push({
            id: button.id,
            label: label.slice(0, MAX_LABEL_LENGTH),
            type: button.type,
            url,
            newTab: button.type === TYPE_EXTERNAL && /^https:/i.test(url) && button.newTab !== false,
            style: STYLE_VALUES.includes(button.style) ? button.style : DEFAULT_STYLE,
            align: ALIGN_VALUES.includes(button.align) ? button.align : DEFAULT_ALIGN,
            icon: normalizeIcon(button.icon)
        });
    });
    return ready;
}

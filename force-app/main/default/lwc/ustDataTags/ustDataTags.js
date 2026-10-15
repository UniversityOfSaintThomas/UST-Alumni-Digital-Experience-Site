/**
 * ustDataTags
 *
 * Shared helpers for {{data tags}} in widget content. Mirrors the parsing rules of the Apex resolver
 * (PortalDataTags) so the editor's warnings and sample preview behave like the real thing. The real
 * substitution for site visitors always happens server-side in Apex.
 *
 * Syntax: {{Tag_Name}} or {{Tag_Name|fallback}}. Tag names ignore case; spaces count as underscores.
 * Markup inside a tag (the editor can split a tag with formatting) and non-breaking spaces are ignored.
 */

const TAG_PATTERN = /\{\{((?:[^{}<]|<[^>]*>)+?)\}\}/g;
const MARKUP_PATTERN = /<[^>]*>/g;

/** Rendering modes, matching PortalDataTags.Mode. */
export const MODE_HTML = 'html';
export const MODE_TEXT = 'text';
/** Link mode: only tags flagged allowInUrl resolve, values are URL-encoded (like Apex Mode.LINK_URL). */
export const MODE_URL = 'url';

/**
 * Splits the inside of a tag into its normalized key and fallback.
 *
 * @param {string} tagBody the text between {{ and }}
 * @return {{key: string, name: string, fallback: string}} key is lowercase_with_underscores
 */
export function parseTagBody(tagBody) {
    const cleaned = tagBody.replace(MARKUP_PATTERN, '').replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
    const pipeIndex = cleaned.indexOf('|');
    const name = (pipeIndex >= 0 ? cleaned.substring(0, pipeIndex) : cleaned).trim();
    const fallback = pipeIndex >= 0 ? cleaned.substring(pipeIndex + 1).trim() : '';
    return { key: name.replace(/ /g, '_').toLowerCase(), name, fallback };
}

/**
 * URL-encodes a value the way Apex EncodingUtil.urlEncode does (space becomes +, and the characters
 * encodeURIComponent leaves alone that Java encodes are encoded too).
 *
 * @param {string} value raw value
 * @return {string} encoded value
 */
export function urlEncode(value) {
    return encodeURIComponent(String(value))
        .replace(/[!'()~]/g, (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%20/g, '+');
}

/**
 * Escapes text for safe use inside HTML, like Apex escapeHtml4 for the characters that matter.
 *
 * @param {string} value raw value
 * @return {string} escaped value
 */
export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Lists tags in the text whose name is not a known tag, so admins can fix typos.
 *
 * @param {string} text content that may contain tags
 * @param {Array<{name: string}>} definitions the available tags
 * @return {string[]} unique tags as typed, such as "{{Fist_Name}}"
 */
export function findUnknownTags(text, definitions) {
    if (!text || !text.includes('{{')) {
        return [];
    }
    const known = new Set((definitions || []).map((definition) => definition.name.toLowerCase()));
    const unknown = [];
    for (const match of text.matchAll(TAG_PATTERN)) {
        const { key, name } = parseTagBody(match[1]);
        const shown = '{{' + name + '}}';
        if (!known.has(key) && !unknown.includes(shown)) {
            unknown.push(shown);
        }
    }
    return unknown;
}

/**
 * Resolves known tags using the given values, like the Apex resolver does.
 *
 * @param {string} text content that may contain tags
 * @param {Object} values tag values keyed by lowercase tag name; empty or null means "no data" (guest)
 * @param {Array<{name: string}>} definitions the available tags (unknown tags are left as typed)
 * @param {string} mode MODE_HTML (escapes values), MODE_TEXT, or MODE_URL (identifier tags only, encoded)
 * @return {string} the resolved text
 */
export function resolveTags(text, values, definitions, mode) {
    if (!text || !text.includes('{{')) {
        return text;
    }
    const byKey = new Map((definitions || []).map((definition) => [definition.name.toLowerCase(), definition]));
    return text.replace(TAG_PATTERN, (original, tagBody) => {
        const { key, fallback } = parseTagBody(tagBody);
        const definition = byKey.get(key);
        if (!definition) {
            return original;
        }
        if (mode === MODE_URL && !definition.allowInUrl) {
            return '';
        }
        const value = values ? values[key] : undefined;
        const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
        if (mode === MODE_HTML) {
            return hasValue ? escapeHtml(value) : fallback;
        }
        const chosen = hasValue ? String(value) : fallback;
        return mode === MODE_URL ? urlEncode(chosen) : chosen;
    });
}

/**
 * Builds a values map from the definitions' sample values, for the admin preview.
 *
 * @param {Array<{name: string, sample: string}>} definitions the available tags
 * @return {Object} sample values keyed by lowercase tag name
 */
export function sampleValues(definitions) {
    const values = {};
    (definitions || []).forEach((definition) => {
        values[definition.name.toLowerCase()] = definition.sample;
    });
    return values;
}

/**
 * Formats a tag for insertion into content.
 *
 * @param {string} name the tag name
 * @return {string} for example "{{First_Name}}"
 */
export function tagToken(name) {
    return '{{' + name + '}}';
}

/**
 * Appends text to the end of HTML content, inside the last block (paragraph, heading, list item)
 * when there is one. Used as the fallback when the editor cannot insert at the cursor.
 *
 * @param {string} html current HTML
 * @param {string} token text to append
 * @return {string} the new HTML
 */
export function appendToHtml(html, token) {
    const value = html || '';
    const closing = /(<\/(?:p|h[1-6]|li)>)\s*$/i;
    if (closing.test(value)) {
        return value.replace(closing, token + '$1');
    }
    return value + token;
}
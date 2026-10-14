import { LightningElement, api } from 'lwc';

/**
 * CSS classes an admin may pick in Content_CSS_Class__c. Anything else is
 * ignored so a stray value can never inject an arbitrary class name.
 * To add a style: add a picklist value (API name = class) on the field,
 * list it here, and add its rule in ustStaticContent.css.
 */
const ALLOWED_CONTENT_CLASSES = [
    'ust-content-callout',
    'ust-content-inverse',
    'ust-content-centered',
    'ust-content-muted'
];

/**
 * ustStaticContent
 *
 * Renders admin-authored rich-text content from the UST_Portal_Widget__c
 * Static_Content__c field. Used when Widget Type is set to "Static Content".
 * Content is displayed using the platform's lightning-formatted-rich-text
 * component, which safely renders HTML from the Salesforce rich-text editor.
 *
 * The optional contentClass (from Content_CSS_Class__c) styles the whole
 * widget. Only inherited properties (colour, text alignment, font) reach the
 * rich text itself, because the formatted-rich-text component owns its markup.
 */
export default class UstStaticContent extends LightningElement {
    /**
     * Rich-text HTML string from Static_Content__c on the widget record.
     * Passed in by ustWidgetZone from the PortalWidgetDto.staticContent property.
     */
    @api richTextContent;
    @api textHeader;

    /** Style class from Content_CSS_Class__c; must be one of ALLOWED_CONTENT_CLASSES. */
    @api contentClass;

    /** Returns true only when there is content to render. */
    get hasContent() {
        return !!this.richTextContent;
    }
    get hasHeader() {
        return !!this.textHeader;
    }

    /** Wrapper classes: the base class plus the chosen style when it is on the allowlist. */
    get wrapperClass() {
        const base = 'ust-static-content';
        return ALLOWED_CONTENT_CLASSES.includes(this.contentClass)
            ? base + ' ' + this.contentClass
            : base;
    }
}

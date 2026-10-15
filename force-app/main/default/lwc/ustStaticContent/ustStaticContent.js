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

    /** Call-to-action buttons prepared by the server (see PortalButtons). */
    @api buttons = [];

    /** Above or Below the text; anything else means Below. */
    @api buttonPlacement = 'Below';

    /** Widget-wide button size class from Button_Size__c. */
    @api buttonSize = '';

    /** True in the admin editor preview: buttons are drawn but never navigate. */
    @api previewMode = false;

    /** True when shown over a picture (the Hero Banner): light text, light-outline buttons. */
    @api overImage = false;

    /** Returns true only when there is content or at least one button to render. */
    get hasContent() {
        return !!this.richTextContent || this.hasButtons;
    }

    get hasRichText() {
        return !!this.richTextContent;
    }

    get hasButtons() {
        return Array.isArray(this.buttons) && this.buttons.length > 0;
    }

    get showButtonsAbove() {
        return this.hasButtons && this.buttonPlacement === 'Above';
    }

    get showButtonsBelow() {
        return this.hasButtons && this.buttonPlacement !== 'Above';
    }
    get hasHeader() {
        return !!this.textHeader;
    }

    /** Wrapper classes: the base class plus the chosen style when it is on the allowlist. */
    get wrapperClass() {
        const base = this.overImage ? 'ust-static-content ust-on-image' : 'ust-static-content';
        return ALLOWED_CONTENT_CLASSES.includes(this.contentClass)
            ? base + ' ' + this.contentClass
            : base;
    }
}

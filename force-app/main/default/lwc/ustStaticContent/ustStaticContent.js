import { LightningElement, api } from 'lwc';

/**
 * ustStaticContent
 *
 * Renders admin-authored rich-text content from the UST_Portal_Widget__c
 * Static_Content__c field. Used when Widget Type is set to "Static Content".
 * Content is displayed using the platform's lightning-formatted-rich-text
 * component, which safely renders HTML from the Salesforce rich-text editor.
 */
export default class UstStaticContent extends LightningElement {
    /**
     * Rich-text HTML string from Static_Content__c on the widget record.
     * Passed in by ustWidgetZone from the PortalWidgetDto.staticContent property.
     */
    @api richTextContent;
    @api textHeader;

    /** Returns true only when there is content to render. */
    get hasContent() {
        return !!this.richTextContent;
    }
    get hasHeader() {
        return !!this.textHeader;
    }
}
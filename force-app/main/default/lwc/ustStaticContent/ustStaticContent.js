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
 * Section backgrounds an admin may pick in Section_Background__c (picklist API names), mapped to the class that
 * paints them. Anything else is ignored. To add one: picklist value + this map + a rule in ustStaticContent.css.
 */
const BACKGROUND_CLASSES = {
    white: 'ust-bg-white',
    gray: 'ust-bg-gray',
    light_purple: 'ust-bg-light-purple',
    purple: 'ust-bg-purple',
    dark_purple: 'ust-bg-dark-purple'
};

/** Backgrounds that are dark: text, links and buttons inside turn light (see ustSharedStyles .ust-on-dark). */
const DARK_BACKGROUNDS = ['purple', 'dark_purple'];

/** Decorative circles (Section_Accent__c), drawn only on a widget that has a background. */
const ACCENT_CLASSES = {
    green_circles: 'ust-accent-green',
    purple_circles: 'ust-accent-purple'
};

/**
 * The older Content_CSS_Class__c panel looks, expressed as section backgrounds. They keep working for widgets
 * saved before Section_Background__c existed; an explicit Section_Background__c replaces them.
 */
const LEGACY_BACKGROUNDS = {
    'ust-content-callout': 'light_purple',
    'ust-content-inverse': 'purple'
};

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

    /** Section_Background__c value: white, gray, light_purple, purple, dark_purple. Blank or unknown: no panel. */
    @api sectionBackground;

    /** Section_Accent__c value: green_circles or purple_circles. Needs a background; blank or unknown: none. */
    @api sectionAccent;

    /**
     * True when a parent widget (the Card Grid) puts its own content in the slot, so the panel is drawn even with
     * no text or buttons. The slot comes last: heading, buttons above, text, buttons below, then the slot.
     */
    @api hasSlotContent = false;

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

    /** True on a Purple, Dark Purple or similar background that is not a picture: light text, links and buttons. */
    @api darkBackground = false;

    /** True for a page-title sized headline (the Hero Banner uses it); false for a normal section heading. */
    @api largeHeading = false;

    /** Returns true only when there is content or at least one button to render. */
    get hasContent() {
        return !!this.richTextContent || this.hasButtons || this.hasSlotContent === true;
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

    /** True when Section_Background__c holds a value on the allowlist (it then replaces the older panel looks). */
    get hasExplicitBackground() {
        return Object.prototype.hasOwnProperty.call(BACKGROUND_CLASSES, this.sectionBackground);
    }

    /**
     * The background in effect: the chosen Section Background, else the one an older panel style stands for, else
     * none. A widget over a picture (the Hero Banner) has no panel of its own.
     *
     * @return {string} a key of BACKGROUND_CLASSES, or '' for no panel
     */
    get effectiveBackground() {
        if (this.overImage) {
            return '';
        }
        if (this.hasExplicitBackground) {
            return this.sectionBackground;
        }
        return LEGACY_BACKGROUNDS[this.contentClass] || '';
    }

    /** True for a dark background that is not a picture; over a picture the renderer is told through overImage. */
    get onDarkPanel() {
        return !this.overImage && (this.darkBackground || DARK_BACKGROUNDS.includes(this.effectiveBackground));
    }

    /** The decorative circles are drawn only on a widget that has a panel. */
    get showAccent() {
        return !!this.effectiveBackground && Object.prototype.hasOwnProperty.call(ACCENT_CLASSES, this.sectionAccent);
    }

    /** Wrapper classes: the base class, the panel and its accent, and the chosen style when it is on the allowlist. */
    get wrapperClass() {
        let classes = this.overImage ? 'ust-static-content ust-on-image' : 'ust-static-content';
        if (this.effectiveBackground) {
            classes += ' ust-bg ' + BACKGROUND_CLASSES[this.effectiveBackground];
        }
        if (this.showAccent) {
            classes += ' ust-has-accent ' + ACCENT_CLASSES[this.sectionAccent];
        }
        // A chosen Section Background replaces the older panel looks, so their extra styling (such as the rule
        // under the callout heading) is dropped; the other styles (centered, muted) combine with it.
        const replacedByBackground = this.hasExplicitBackground && !!LEGACY_BACKGROUNDS[this.contentClass];
        if (ALLOWED_CONTENT_CLASSES.includes(this.contentClass) && !replacedByBackground) {
            classes += ' ' + this.contentClass;
        }
        if (this.onDarkPanel) {
            classes += ' ust-on-dark';
        }
        return this.largeHeading ? classes + ' ust-static-content_large' : classes;
    }
}
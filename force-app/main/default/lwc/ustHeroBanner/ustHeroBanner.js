import { LightningElement, api } from 'lwc';

/** Allowlisted look settings (Hero_Height__c, Hero_Text_Position__c, Hero_Overlay__c). */
const HEIGHTS = ['short', 'medium', 'tall'];
const POSITIONS = ['left', 'center', 'right'];
const OVERLAYS = ['light', 'medium', 'strong'];

/** No dark layer at all: the picture is shown as it is. */
const OVERLAY_NONE = 'none';

/** The hero's text position also decides where its buttons sit (per-button alignment is ignored). */
const BUTTON_ALIGN_FOR_POSITION = { left: 'left', center: 'center', right: 'end' };

/** Screens narrower than this use the mobile image, when there is one. */
const MOBILE_MEDIA = '(max-width: 767px)';

/**
 * ustHeroBanner
 *
 * A full-width banner: a picture with a dark layer, and the widget's headline, text, and buttons on top.
 * The headline, text, and buttons are rendered by ustStaticContent (so tags, headings, and buttons behave
 * exactly as they do in a Static Content widget); this component adds the picture and the layout.
 *
 * - No picture, or one that fails to load: a solid brand-colour background, so the text stays readable.
 * - An optional second picture is used on narrow screens.
 * - Without alt text the picture is decorative (empty alt).
 * - The dark layer has no "off" setting on purpose: the text is white, so it always needs one.
 * - Height is a minimum, so long text never clips.
 *
 * Server side, PortalHero has already checked the image addresses; the template only ever sees safe ones.
 */
export default class UstHeroBanner extends LightningElement {
    /** Picture settings from the server: { imageUrl, mobileImageUrl, altText, height, textPosition, overlay }. */
    @api hero;

    /** Overlay text (HTML) with data tags already resolved. */
    @api richTextContent;

    /** Headline with data tags already resolved. */
    @api textHeader;

    /** Cleaned call-to-action buttons. */
    @api buttons = [];

    /** Above or Below the text. */
    @api buttonPlacement = 'Below';

    /** Widget-wide button size class. */
    @api buttonSize = '';

    /** True in the admin editor preview: buttons never navigate. */
    @api previewMode = false;

    /**
     * True when the hero spans the whole page (the banner and above-footer regions, which sit outside any
     * Builder section). Its text then lines up with the 1344px page grid. False (the default) when the hero
     * is inside a section, which already supplies the side padding.
     */
    @api fullWidth = false;

    imageFailed = false;

    get settings() {
        return this.hero || {};
    }

    get showImage() {
        return !!this.settings.imageUrl && !this.imageFailed;
    }

    get hasMobileImage() {
        return this.showImage && !!this.settings.mobileImageUrl;
    }

    get mobileMedia() {
        return MOBILE_MEDIA;
    }

    /** Empty alt marks the picture as decorative. */
    get altText() {
        return this.settings.altText || '';
    }

    get hasText() {
        return !!this.richTextContent || !!this.textHeader;
    }

    get hasButtons() {
        return Array.isArray(this.buttons) && this.buttons.length > 0;
    }

    /** Nothing to show: no picture and nothing to say. */
    get isEmpty() {
        return !this.showImage && !this.hasText && !this.hasButtons;
    }

    get position() {
        return POSITIONS.includes(this.settings.textPosition) ? this.settings.textPosition : 'left';
    }

    get bannerClass() {
        const height = HEIGHTS.includes(this.settings.height) ? this.settings.height : 'medium';
        const base = 'ust-hero ust-hero_' + height + ' ust-hero_' + this.position;
        return this.fullWidth ? base + ' ust-hero_full' : base;
    }

    /** False when the overlay is None, so no dark layer is drawn over the picture. */
    get hasScrim() {
        return this.settings.overlay !== OVERLAY_NONE;
    }

    /** An unknown value still gets a layer (Medium), so white text is never left unprotected by accident. */
    get scrimClass() {
        const overlay = OVERLAYS.includes(this.settings.overlay) ? this.settings.overlay : 'medium';
        return 'ust-hero-scrim ust-hero-scrim_' + overlay;
    }

    /** Buttons follow the text position. */
    get alignedButtons() {
        if (!this.hasButtons) {
            return [];
        }
        const align = BUTTON_ALIGN_FOR_POSITION[this.position];
        return this.buttons.map((button) => ({ ...button, align }));
    }

    handleImageError() {
        this.imageFailed = true;
    }
}
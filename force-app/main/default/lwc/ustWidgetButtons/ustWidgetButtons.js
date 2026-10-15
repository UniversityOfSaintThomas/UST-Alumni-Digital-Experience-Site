import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { isAllowedUrl, TYPE_PORTAL } from 'c/ustButtonRules';

/** Button style (from the stored JSON) to the classes that draw it. */
const STYLE_CLASSES = {
    brand: 'slds-button slds-button_brand',
    'outline-brand': 'slds-button slds-button_outline-brand',
    neutral: 'slds-button slds-button_neutral',
    success: 'slds-button slds-button_success',
    destructive: 'slds-button slds-button_destructive',
    'text-destructive': 'slds-button slds-button_text-destructive',
    text_link: 'ust-text-link'
};
const DEFAULT_STYLE_CLASS = STYLE_CLASSES.brand;

/** Sizes a widget may choose (Button_Size__c); anything else is ignored. */
const SIZE_CLASSES = ['ust-buttons-wide', 'ust-buttons-full'];

const ALIGN_CLASSES = {
    left: 'ust-button-row ust-button-row_left',
    center: 'ust-button-row ust-button-row_center',
    end: 'ust-button-row ust-button-row_end'
};

/**
 * ustWidgetButtons
 *
 * Shared renderer for a widget's call-to-action buttons. Used by ustStaticContent today and by the hero
 * widget later. Receives the cleaned list the server prepared (PortalButtons), and re-checks every link
 * anyway: it never renders a URL that fails the allowlist.
 *
 * - Real <a> elements, not buttons, so links behave like links (open in new tab, copy address, etc.).
 * - Portal links are stored as site paths. The site base path is added with NavigationMixin.GenerateUrl
 *   (the same JSON then works in sandbox and production); a plain click navigates inside the app.
 * - External https links open in a new tab with rel="noopener noreferrer" and say so to screen readers.
 * - In previewMode (the admin editor) nothing navigates.
 */
export default class UstWidgetButtons extends NavigationMixin(LightningElement) {
    /** Widget-wide size class from Button_Size__c: ust-buttons-wide, ust-buttons-full, or blank. */
    @api buttonSize = '';

    /** When true (the admin editor preview) clicks never navigate. */
    @api previewMode = false;

    /** True over a picture (Hero Banner): outline and text-link buttons turn white to stay readable. */
    @api overImage = false;

    _buttons = [];
    _connected = false;
    portalHrefs = {};

    /** Cleaned buttons: { id, label, type, url, newTab, style, align, icon }. */
    @api
    get buttons() {
        return this._buttons;
    }
    set buttons(newButtons) {
        this._buttons = Array.isArray(newButtons) ? newButtons : [];
        // GenerateUrl needs a connected component; the parent sets this before it is attached.
        if (this._connected) {
            this.resolvePortalHrefs();
        }
    }

    connectedCallback() {
        this._connected = true;
        this.resolvePortalHrefs();
    }

    disconnectedCallback() {
        this._connected = false;
    }

    get safeButtons() {
        return this._buttons.filter((button) => button && button.label && isAllowedUrl(button.type, button.url));
    }

    get hasButtons() {
        return this.safeButtons.length > 0;
    }

    get containerClass() {
        let classes = SIZE_CLASSES.includes(this.buttonSize) ? 'ust-widget-buttons ' + this.buttonSize : 'ust-widget-buttons';
        if (this.overImage) {
            classes += ' ust-buttons-on-image';
        }
        return classes;
    }

    /** Consecutive buttons with the same alignment share a row. */
    get rows() {
        const rows = [];
        this.safeButtons.forEach((button) => {
            const alignClass = ALIGN_CLASSES[button.align] || ALIGN_CLASSES.left;
            const last = rows[rows.length - 1];
            const view = this.toView(button);
            if (last && last.className === alignClass) {
                last.buttons.push(view);
            } else {
                rows.push({ key: 'row-' + button.id, className: alignClass, buttons: [view] });
            }
        });
        return rows;
    }

    toView(button) {
        const isPortal = button.type === TYPE_PORTAL;
        // Only real web links open a new tab, whatever the stored flag says (never mailto: or tel:).
        const opensNewTab = !this.previewMode && !isPortal && button.newTab === true && /^https:/i.test(button.url);
        let href = button.url;
        if (this.previewMode) {
            href = '#';
        } else if (isPortal) {
            href = this.portalHrefs[button.url];
        }
        return {
            id: button.id,
            label: button.label,
            icon: button.icon,
            href,
            target: opensNewTab ? '_blank' : undefined,
            rel: opensNewTab ? 'noopener noreferrer' : undefined,
            opensNewTab,
            className: STYLE_CLASSES[button.style] || DEFAULT_STYLE_CLASS
        };
    }

    /**
     * Asks the platform for the real address of each portal path (adds the site base path).
     * A path can't be linked before this resolves, so those links appear a moment later.
     */
    resolvePortalHrefs() {
        if (this.previewMode) {
            return;
        }
        this.safeButtons
            .filter((button) => button.type === TYPE_PORTAL && !this.portalHrefs[button.url])
            .forEach((button) => {
                this[NavigationMixin.GenerateUrl]({ type: 'standard__webPage', attributes: { url: button.url } })
                    .then((generated) => {
                        this.portalHrefs = { ...this.portalHrefs, [button.url]: generated };
                    })
                    .catch(() => {
                        // Leave the link unresolved; the button simply isn't clickable.
                    });
            });
    }

    handleClick(event) {
        const button = this.safeButtons.find((candidate) => candidate.id === event.currentTarget.dataset.id);
        if (this.previewMode) {
            event.preventDefault();
            return;
        }
        // Let the browser handle modified clicks (new tab, new window) and non-portal links.
        const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0;
        if (button && button.type === TYPE_PORTAL && !modified) {
            event.preventDefault();
            this[NavigationMixin.Navigate]({ type: 'standard__webPage', attributes: { url: button.url } });
        }
    }
}

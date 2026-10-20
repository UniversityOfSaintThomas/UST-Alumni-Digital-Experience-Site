import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { isAllowedUrl, TYPE_PORTAL } from 'c/ustButtonRules';

/** Columns an admin may choose (Grid_Columns__c); anything else is 3. */
const COLUMN_CHOICES = ['2', '3', '4'];
const DEFAULT_COLUMNS = '3';

/** Only https pictures are drawn, whatever the server sent. */
const HTTPS_IMAGE = /^https:\/\//i;

/**
 * ustCardGrid
 *
 * The Card Grid widget. The heading, text and buttons above the grid, and the Section Background and Accent,
 * are drawn by ustStaticContent (the grid is its slot content), so they behave exactly like any other Static
 * Content widget. This component draws the cards.
 *
 * Cards arrive already cleaned by PortalCardGrid (Apex): a picture is a safe https address, a link passed the
 * button link rules. This component checks both again before using them (defence in depth).
 *
 * Columns: the widget's choice applies on a wide screen; narrower screens show fewer (see ustCardGrid.css).
 * Bottom bar: one setting for every card, green by default, "none" removes it.
 *
 * Card titles are h3 elements: with a heading above they sit under it; without one they are the first headings
 * in the widget, so give the widget a header.
 */
export default class UstCardGrid extends NavigationMixin(LightningElement) {
    /** { columns: '2'|'3'|'4', bottomBar: 'green'|'none', cards: [...] } from PortalCardGrid. */
    @api grid;

    @api richTextContent;
    @api textHeader;
    @api contentClass;
    @api sectionBackground;
    @api sectionAccent;
    @api buttons;
    @api buttonPlacement;
    @api buttonSize;

    /** True in the admin editor: links do nothing, so clicking a card in the preview never leaves the page. */
    @api previewMode = false;

    /** Real addresses of portal paths, filled in by resolvePortalHrefs. */
    portalHrefs = {};

    get safeCards() {
        const cards = this.grid && Array.isArray(this.grid.cards) ? this.grid.cards : [];
        return cards.filter((card) => card && card.id && card.title);
    }

    get hasCards() {
        return this.safeCards.length > 0;
    }

    get columns() {
        const requested = this.grid && this.grid.columns;
        return COLUMN_CHOICES.includes(requested) ? requested : DEFAULT_COLUMNS;
    }

    get hasBar() {
        return !(this.grid && this.grid.bottomBar === 'none');
    }

    /** True when something is drawn above the grid, so the grid needs a gap above it. */
    get hasIntro() {
        const hasButtons = Array.isArray(this.buttons) && this.buttons.length > 0;
        return !!this.textHeader || !!this.richTextContent || hasButtons;
    }

    get gridClass() {
        let classes = 'ust-card-grid ust-card-grid_cols-' + this.columns;
        if (this.hasBar) {
            classes += ' ust-card-grid_bar';
        }
        if (this.hasIntro) {
            classes += ' ust-card-grid_after-intro';
        }
        return classes;
    }

    get cardViews() {
        return this.safeCards.map((card) => this.toView(card));
    }

    connectedCallback() {
        this.resolvePortalHrefs();
    }

    renderedCallback() {
        this.resolvePortalHrefs();
    }

    toView(card) {
        const type = card.linkType;
        const linkable = !!type && isAllowedUrl(type, card.linkUrl);
        const isPortal = linkable && type === TYPE_PORTAL;
        const opensNewTab = linkable && !isPortal && !this.previewMode && card.newTab === true
            && /^https:/i.test(card.linkUrl);
        let href;
        if (linkable) {
            if (this.previewMode) {
                href = '#';
            } else if (isPortal) {
                href = this.portalHrefs[card.linkUrl];
            } else {
                href = card.linkUrl;
            }
        }
        return {
            id: card.id,
            title: card.title,
            text: card.text,
            imageUrl: card.imageUrl && HTTPS_IMAGE.test(card.imageUrl) ? card.imageUrl : null,
            // An empty string is deliberate: it marks a decorative picture.
            altText: card.altText || '',
            hasLink: linkable && !!href,
            href,
            target: opensNewTab ? '_blank' : undefined,
            rel: opensNewTab ? 'noopener noreferrer' : undefined,
            opensNewTab,
            className: linkable ? 'ust-card ust-card_linked' : 'ust-card'
        };
    }

    /** Asks the platform for the real address of each portal path (adds the site base path). */
    resolvePortalHrefs() {
        if (this.previewMode) {
            return;
        }
        this.safeCards
            .filter((card) => card.linkType === TYPE_PORTAL && isAllowedUrl(TYPE_PORTAL, card.linkUrl)
                && !this.portalHrefs[card.linkUrl])
            .forEach((card) => {
                this[NavigationMixin.GenerateUrl]({ type: 'standard__webPage', attributes: { url: card.linkUrl } })
                    .then((generated) => {
                        this.portalHrefs = { ...this.portalHrefs, [card.linkUrl]: generated };
                    })
                    .catch(() => {
                        // Leave the card without a link until it resolves.
                    });
            });
    }

    handleLinkClick(event) {
        if (this.previewMode) {
            event.preventDefault();
            return;
        }
        const card = this.safeCards.find((candidate) => candidate.id === event.currentTarget.dataset.id);
        // Let the browser handle modified clicks (new tab, new window) and non-portal links.
        const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0;
        if (card && card.linkType === TYPE_PORTAL && !modified) {
            event.preventDefault();
            this[NavigationMixin.Navigate]({ type: 'standard__webPage', attributes: { url: card.linkUrl } });
        }
    }
}

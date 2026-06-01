import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import UST_ALUMNI_TEMPLATE from '@salesforce/resourceUrl/ustAlumniThemplate';
import basePath from '@salesforce/community/basePath';

export default class UstAlumniHeader extends NavigationMixin(LightningElement) {
    @track isSearchOpen = false;
    @track searchQuery = '';

    logoUrl = UST_ALUMNI_TEMPLATE + '/images/ustLogoPurple.svg';

    /* ------- Community base path ------- */
    get homeUrl() {
        return basePath + '/';
    }

    get updateContactUrl() {
        return basePath + '/update-contact-info';
    }

    /* ------- Search ------- */
    handleSearchToggle() {
        this.isSearchOpen = !this.isSearchOpen;
        if (this.isSearchOpen) {
            // Focus search input on next tick after DOM renders
            Promise.resolve().then(() => {
                const input = this.template.querySelector('#ust-search-input');
                if (input) {
                    input.focus();
                }
            });
        }
    }

    handleSearchInput(event) {
        this.searchQuery = event.target.value;
    }

    handleSearchSubmit(event) {
        event.preventDefault();
        if (!this.searchQuery.trim()) { return; }
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: basePath + '/search?q=' + encodeURIComponent(this.searchQuery.trim()) }
        });
        this.isSearchOpen = false;
        this.searchQuery = '';
    }

    /* ------- Outside-click listener (retained for stability) ------- */
    connectedCallback() {
        this._handleOutsideClick = this._closeAllDropdowns.bind(this);
        document.addEventListener('click', this._handleOutsideClick);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._handleOutsideClick);
    }

    _closeAllDropdowns() {
        // No-op: standard Experience Cloud navigation components manage their own dropdowns.
        // Retained so connectedCallback/disconnectedCallback wiring remains stable.
    }

    /* ------- Computed class helpers ------- */

    get searchPanelCssClass() {
        return 'ust-header__search-panel' + (this.isSearchOpen ? ' ust-header__search-panel--open' : '');
    }

    get searchPanelAriaHidden() {
        return (!this.isSearchOpen).toString();
    }
}

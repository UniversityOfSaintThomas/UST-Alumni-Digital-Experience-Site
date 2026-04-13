import { LightningElement, api, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getMenuItems from '@salesforce/apex/NavMenuController.getMenuItems';
import UST_LOGO_PURPLE from '@salesforce/resourceUrl/ustLogoPurple';
import basePath from '@salesforce/community/basePath';

/**
 * Default portal navigation rendered when no Experience Cloud menu is configured yet.
 * Replace / augment these once Experience Builder navigation menus are created.
 */
const DEFAULT_MENU_ITEMS = [
    { id: 'home',    label: 'Home',    actionType: 'InternalLink', actionValue: basePath + '/', target: 'CurrentWindow', subMenu: [] },
    { id: 'events',  label: 'Events',  actionType: 'InternalLink', actionValue: basePath + '/events', target: 'CurrentWindow', subMenu: [] },
    { id: 'profile', label: 'My Profile', actionType: 'InternalLink', actionValue: basePath + '/profile', target: 'CurrentWindow', subMenu: [] },
    { id: 'give',    label: 'Give',    actionType: 'ExternalLink', actionValue: 'https://give.stthomas.edu/', target: 'NewWindow', subMenu: [] },
    { id: 'connect', label: 'Connect', actionType: 'InternalLink', actionValue: basePath + '/connect', target: 'CurrentWindow', subMenu: [] },
];

export default class UstAlumniHeader extends NavigationMixin(LightningElement) {
    /** Developer Name of the Experience Cloud navigation menu to render */
    @api navMenuName = 'Alumni_Portal_Navigation';

    @track _rawMenuItems = null;
    @track _openDropdownId = null;
    @track _openMobileIds = {};
    @track isSearchOpen = false;
    @track isMobileMenuOpen = false;
    @track searchQuery = '';

    /* ------- Static resource ------- */
    logoUrl = UST_LOGO_PURPLE;

    /* ------- Community base path ------- */
    get homeUrl() {
        return basePath + '/';
    }

    get updateContactUrl() {
        return basePath + '/update-contact-info';
    }

    /* ------- Wire: Apex NavMenuController ------- */
    @wire(getMenuItems, { menuName: '$navMenuName' })
    wiredMenuItems({ data, error }) {
        if (data && data.length > 0) {
            this._rawMenuItems = data;
        } else if (error) {
            // Silently fall back to defaults; org may not have the menu configured yet
            this._rawMenuItems = null;
        }
    }

    /* ------- Derived menu items with state ------- */
    get menuItems() {
        const rawItems = this._rawMenuItems || DEFAULT_MENU_ITEMS;
        return rawItems.map(item => {
            const hasChildren = item.subMenu && item.subMenu.length > 0;
            const isOpen = this._openDropdownId === item.id;
            const isMobileOpen = Boolean(this._openMobileIds[item.id]);

            return {
                ...item,
                hasChildren,
                isOpen,
                isMobileOpen,
                isNewTab: item.target === 'NewWindow',
                actionValue: this._resolveUrl(item),
                liCssClass: this._liCss(isOpen, hasChildren),
                dropdownCssClass: 'ust-header__dropdown' + (isOpen ? ' ust-header__dropdown--open' : ''),
                mobileLiCssClass: 'ust-header__mobile-item' + (isMobileOpen ? ' ust-header__mobile-item--open' : ''),
                mobileSubCssClass: 'ust-header__mobile-sub' + (isMobileOpen ? ' ust-header__mobile-sub--open' : ''),
                mobileSubAriaHidden: (!isMobileOpen).toString(),
                subMenu: hasChildren ? item.subMenu.map(child => ({
                    ...child,
                    isNewTab: child.target === 'NewWindow',
                    actionValue: this._resolveUrl(child),
                })) : [],
            };
        });
    }

    /* ------- Desktop dropdown ------- */
    handleDropdownToggle(event) {
        const id = event.currentTarget.dataset.id;
        this._openDropdownId = this._openDropdownId === id ? null : id;
    }

    handleNavClick(event) {
        const { url, type, newtab } = event.currentTarget.dataset;
        if (!url) return;
        if (newtab === 'true' || type === 'ExternalLink') {
            // Let the default anchor href handle external links
            return;
        }
        event.preventDefault();
        this._openDropdownId = null;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url }
        });
    }

    /* ------- Mobile menu ------- */
    handleMobileMenuToggle() {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
        // Prevent body scroll when mobile menu is open
        document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
    }

    handleMobileAccordionToggle(event) {
        const id = event.currentTarget.dataset.id;
        this._openMobileIds = {
            ...this._openMobileIds,
            [id]: !this._openMobileIds[id]
        };
    }

    handleMobileNavClick(event) {
        const { url, type } = event.currentTarget.dataset;
        if (!url || type === 'ExternalLink') {
            return;
        }
        event.preventDefault();
        this.isMobileMenuOpen = false;
        document.body.style.overflow = '';
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url }
        });
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

    /* ------- Close dropdowns when clicking outside ------- */
    connectedCallback() {
        this._handleOutsideClick = this._closeAllDropdowns.bind(this);
        document.addEventListener('click', this._handleOutsideClick);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._handleOutsideClick);
        document.body.style.overflow = '';
    }

    _closeAllDropdowns(event) {
        if (!this.template.contains(event.target)) {
            this._openDropdownId = null;
        }
    }

    /* ------- Computed class helpers ------- */
    get showHamburger() {
        return !this.isMobileMenuOpen;
    }

    get mobileMenuAriaLabel() {
        return this.isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu';
    }

    get searchPanelCssClass() {
        return 'ust-header__search-panel' + (this.isSearchOpen ? ' ust-header__search-panel--open' : '');
    }

    get searchPanelAriaHidden() {
        return (!this.isSearchOpen).toString();
    }

    get mobileMenuCssClass() {
        return 'ust-header__mobile-nav' + (this.isMobileMenuOpen ? ' ust-header__mobile-nav--open' : '');
    }

    get mobileMenuAriaHidden() {
        return (!this.isMobileMenuOpen).toString();
    }

    /* ------- Private helpers ------- */
    _liCss(isOpen, hasChildren) {
        let css = 'ust-header__nav-item';
        if (hasChildren) { css += ' ust-header__nav-item--has-children'; }
        if (isOpen) { css += ' ust-header__nav-item--open'; }
        return css;
    }

    _resolveUrl(item) {
        if (!item.actionValue) { return '#'; }
        if (item.actionType === 'ExternalLink') { return item.actionValue; }
        if (item.actionValue.startsWith('http')) { return item.actionValue; }
        // Internal community pages — prepend base path if needed
        if (item.actionValue.startsWith('/')) { return item.actionValue; }
        return basePath + '/' + item.actionValue;
    }
}


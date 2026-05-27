import { LightningElement, api, wire, track } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import getMenuItems from '@salesforce/apex/NavMenuController.getMenuItems';
import UST_ALUMNI_TEMPLATE from '@salesforce/resourceUrl/ustAlumniThemplate';
import basePath from '@salesforce/community/basePath';

/**
 * Default portal navigation rendered when no Experience Cloud menu is configured yet.
 * Mirrors the structure of alumni.stthomas.edu.
 * Replace / augment these once Experience Builder navigation menus are created.
 */
const DEFAULT_MENU_ITEMS = [
    {
        id: 'about', label: 'About', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/about/index.html', target: 'CurrentWindow',
        subMenu: [
            { id: 'a1', label: 'About the Tommie Network', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/about/index.html', target: 'CurrentWindow' },
            { id: 'a2', label: 'Alumni Awards', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/about/awards/index.html', target: 'CurrentWindow' },
            { id: 'a3', label: 'Athletics Hall of Fame', actionType: 'ExternalLink', actionValue: 'https://tommiesports.com/sports/2022/6/14/hall-of-fame', target: 'NewWindow' },
            { id: 'a4', label: 'Engagement Board', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/about/alumni-engagement-board/index.html', target: 'CurrentWindow' },
            { id: 'a5', label: 'Alumni Surveys', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/about/surveys/index.html', target: 'CurrentWindow' },
            { id: 'a6', label: 'Contact the Alumni Team', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/contact/index.html', target: 'CurrentWindow' },
        ],
    },
    {
        id: 'benefits', label: 'Benefits & Resources', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/index.html', target: 'CurrentWindow',
        subMenu: [
            { id: 'b1', label: 'Career Resources', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/career/index.html', target: 'CurrentWindow' },
            { id: 'b2', label: 'Continuing Education', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/continuing-education/index.html', target: 'CurrentWindow' },
            { id: 'b3', label: 'Faith & Spirituality', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/faith-spirituality/index.html', target: 'CurrentWindow' },
            { id: 'b4', label: 'Financial Wellness', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/financial/index.html', target: 'CurrentWindow' },
        ],
    },
    {
        id: 'involved', label: 'Get Involved', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/get-involved/index.html', target: 'CurrentWindow',
        subMenu: [
            { id: 'i1', label: 'Join St. Thomas Connect', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/get-involved/join-st-thomas-connect/index.html', target: 'CurrentWindow' },
            { id: 'i2', label: 'Corporate Alumni Groups', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/get-involved/corporate-alumni-groups/index.html', target: 'CurrentWindow' },
            { id: 'i3', label: 'Social Media Directory', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/get-involved/social-media/index.html', target: 'CurrentWindow' },
            { id: 'i4', label: 'Alumni Engagement Board', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/about/alumni-engagement-board/index.html', target: 'CurrentWindow' },
        ],
    },
    {
        id: 'news', label: 'News & Events', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/events/index.html', target: 'CurrentWindow',
        subMenu: [
            { id: 'n1', label: 'Alumni Stories', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/news/stories/index.html', target: 'CurrentWindow' },
            { id: 'n2', label: 'Alumni Newsletter', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/news/newsletter/index.html', target: 'CurrentWindow' },
            { id: 'n3', label: 'St. Thomas News', actionType: 'ExternalLink', actionValue: 'https://news.stthomas.edu/', target: 'NewWindow' },
            { id: 'n4', label: 'Signature Events', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/events/index.html#signature-events', target: 'CurrentWindow' },
            { id: 'n5', label: 'Events Calendar', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/events/calendar/index.html', target: 'CurrentWindow' },
        ],
    },
    {
        id: 'support', label: 'Support St. Thomas', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/index.html', target: 'CurrentWindow',
        subMenu: [
            { id: 's1', label: 'Refer a Student', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/refer-a-student/index.html', target: 'CurrentWindow' },
            { id: 's2', label: 'Mentor a Student', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/mentor-a-student/index.html', target: 'CurrentWindow' },
            { id: 's3', label: 'Hire a Tommie', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/hire-a-tommie/index.html', target: 'CurrentWindow' },
            { id: 's4', label: 'Volunteer', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/volunteer/index.html', target: 'CurrentWindow' },
            { id: 's5', label: 'Make a Gift', actionType: 'ExternalLink', actionValue: 'https://give.stthomas.edu/', target: 'NewWindow' },
        ],
    },
    { id: 'update-contact', label: 'Update Contact Info', actionType: 'InternalLink', actionValue: basePath + '/update-contact-info', target: 'CurrentWindow', subMenu: [] },
    { id: 'give', label: 'Make a Gift', actionType: 'ExternalLink', actionValue: 'https://give.stthomas.edu/', target: 'NewWindow', subMenu: [] },
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

    /**
     * Publish status detected from CurrentPageReference.
     * 'Draft' when inside Experience Builder (commeditor), 'Live' otherwise.
     * Starts undefined so the wire adapter waits until this is resolved before fetching.
     */
    _publishStatus;


    /* ------- Detect Experience Builder vs published site ------- */
    @wire(CurrentPageReference)
    setCurrentPageReference(currentPageReference) {
        const app = currentPageReference && currentPageReference.state && currentPageReference.state.app;
        this._publishStatus = (app === 'commeditor') ? 'Draft' : 'Live';
    }

    /* ------- Static resource ------- */
    logoUrl = UST_ALUMNI_TEMPLATE + '/images/ustLogoPurple.svg';
    caretUrl = UST_ALUMNI_TEMPLATE + '/images/caret-down-outline.svg';

    /* ------- Community base path ------- */
    get homeUrl() {
        return basePath + '/';
    }

    get updateContactUrl() {
        return basePath + '/update-contact-info';
    }

    /* ------- Wire: Apex NavMenuController ------- */
    @wire(getMenuItems, { menuName: '$navMenuName', publishStatus: '$_publishStatus' })
    wiredMenuItems({ data, error }) {
        if (data && data.length > 0) {
            this._rawMenuItems = data;
        } else if (data) {
            // Apex returned successfully but with an empty list — menu not configured yet
            // Fallback to DEFAULT_MENU_ITEMS (no sub-menus)
            this._rawMenuItems = null;
        } else if (error) {
            // Apex call failed — likely a permissions issue or the class isn't accessible
            // to the current user. Check Alumni_Portal_Guest permission set assignment.
            console.warn('[ustAlumniHeader] getMenuItems error:', JSON.stringify(error));
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
        // Stop the click from bubbling to the document-level outside-click listener.
        // In LWR (native shadow DOM), composed events like click DO bubble across
        // shadow boundaries to the document. Stopping propagation here prevents
        // _closeAllDropdowns from firing on the same click that opens the dropdown.
        event.stopPropagation();
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

    _closeAllDropdowns() {
        // Fires on any click that reaches the document (i.e. clicks OUTSIDE the
        // component). Clicks inside the component are stopped in their respective
        // handlers via event.stopPropagation() so they never reach this listener.
        this._openDropdownId = null;
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
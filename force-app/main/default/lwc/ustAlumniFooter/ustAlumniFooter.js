import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import getMenuItems from '@salesforce/apex/NavMenuController.getMenuItems';
import UST_ALUMNI_TEMPLATE from '@salesforce/resourceUrl/ustAlumniThemplate';
import basePath from '@salesforce/community/basePath';

/**
 * Default footer columns — mirrors the structure of alumni.stthomas.edu.
 * These render when no Experience Cloud footer navigation menu is configured.
 */
const DEFAULT_FOOTER_COLUMNS = [
    {
        id: 'col-benefits',
        label: 'Benefits & Resources',
        items: [
            { id: 'b1', label: 'Career Resources', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/career/index.html' },
            { id: 'b2', label: 'Continuing Education', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/continuing-education/index.html' },
            { id: 'b3', label: 'Faith & Spirituality', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/faith-spirituality/index.html' },
            { id: 'b4', label: 'Financial Wellness', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/benefits-resources/financial/index.html' },
        ],
    },
    {
        id: 'col-involved',
        label: 'Get Involved',
        items: [
            { id: 'i1', label: 'Join St. Thomas Connect', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/get-involved/join-st-thomas-connect/index.html' },
            { id: 'i2', label: 'Corporate Alumni Groups', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/get-involved/corporate-alumni-groups/index.html' },
            { id: 'i3', label: 'Social Media Directory', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/get-involved/social-media/index.html' },
            { id: 'i4', label: 'Alumni Engagement Board', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/about/alumni-engagement-board/index.html' },
        ],
    },
    {
        id: 'col-news',
        label: 'News & Events',
        items: [
            { id: 'n1', label: 'Alumni Stories', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/news/stories/index.html' },
            { id: 'n2', label: 'Alumni Newsletter', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/news/newsletter/index.html' },
            { id: 'n3', label: 'St. Thomas News', actionType: 'ExternalLink', actionValue: 'https://news.stthomas.edu/' },
            { id: 'n4', label: 'Signature Events', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/events/index.html#signature-events' },
            { id: 'n5', label: 'Events Calendar', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/events/calendar/index.html' },
        ],
    },
    {
        id: 'col-support',
        label: 'Support St. Thomas',
        items: [
            { id: 's1', label: 'Refer a Student', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/refer-a-student/index.html' },
            { id: 's2', label: 'Mentor a Student', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/mentor-a-student/index.html' },
            { id: 's3', label: 'Hire a Tommie', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/hire-a-tommie/index.html' },
            { id: 's4', label: 'Volunteer', actionType: 'ExternalLink', actionValue: 'https://alumni.stthomas.edu/support-st-thomas/volunteer/index.html' },
            { id: 's5', label: 'Make a Gift', actionType: 'ExternalLink', actionValue: 'https://give.stthomas.edu/' },
        ],
    },
];

export default class UstAlumniFooter extends NavigationMixin(LightningElement) {
    /** Developer Name of the Experience Cloud footer navigation menu */
    @api footerMenuName = 'Alumni_Portal_Footer';

    logoUrl = UST_ALUMNI_TEMPLATE + '/images/ustLogoPurple.svg';

    _rawFooterItems = null;

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

    get homeUrl() {
        return basePath + '/';
    }

    get contactUrl() {
        return basePath + '/contact';
    }

    get updateContactUrl() {
        return basePath + '/update-contact-info';
    }

    get currentYear() {
        return new Date().getFullYear();
    }

    /* ------- Wire: Apex NavMenuController ------- */
    @wire(getMenuItems, { menuName: '$footerMenuName', publishStatus: '$_publishStatus' })
    wiredFooterItems({ data, error }) {
        if (data && data.length > 0) {
            this._rawFooterItems = data;
        } else if (error) {
            this._rawFooterItems = null;
        }
    }

    /**
     * @return {Array} Footer columns — either parsed from Experience Cloud nav or from defaults.
     *
     * When the Experience Cloud footer menu is configured, top-level items become column headings
     * and their subMenu children become the column links.
     * When no menu is configured, the hardcoded DEFAULT_FOOTER_COLUMNS are used.
     */
    get footerColumns() {
        if (this._rawFooterItems && this._rawFooterItems.length > 0) {
            return this._rawFooterItems.map((section, idx) => ({
                id: section.id || 'fc-' + idx,
                label: section.label,
                items: (section.subMenu || []).map(item => ({
                    ...item,
                    actionValue: this._resolveUrl(item),
                })),
            }));
        }
        return DEFAULT_FOOTER_COLUMNS;
    }

    /* ------- Navigation ------- */
    handleNavClick(event) {
        const { url, type } = event.currentTarget.dataset;
        if (!url || type === 'ExternalLink') {
            return; // let browser handle href
        }
        event.preventDefault();
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url }
        });
    }

    /* ------- Private helpers ------- */
    _resolveUrl(item) {
        if (!item.actionValue) { return '#'; }
        if (item.actionType === 'ExternalLink') { return item.actionValue; }
        if (item.actionValue.startsWith('http') || item.actionValue.startsWith('/')) {
            return item.actionValue;
        }
        return basePath + '/' + item.actionValue;
    }
}


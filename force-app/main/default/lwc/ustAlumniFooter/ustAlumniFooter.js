import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getMenuItems from '@salesforce/apex/NavMenuController.getMenuItems';
import UST_LOGO_PURPLE from '@salesforce/resourceUrl/ustLogoPurple';
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
            { id: 'b1', label: 'Career Resources', actionType: 'InternalLink', actionValue: basePath + '/career-resources' },
            { id: 'b2', label: 'Continuing Education', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/benefits/continuing-education/' },
            { id: 'b3', label: 'Faith & Spirituality', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/benefits/faith-spirituality/' },
            { id: 'b4', label: 'Financial Wellness', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/benefits/financial-wellness/' },
            { id: 'b5', label: 'Library Access', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/benefits/library-access/' },
        ],
    },
    {
        id: 'col-involved',
        label: 'Get Involved',
        items: [
            { id: 'i1', label: 'St. Thomas Connect', actionType: 'ExternalLink', actionValue: 'https://stthomas.alumnifire.com/' },
            { id: 'i2', label: 'Corporate Alumni Groups', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/get-involved/corporate-alumni-groups/' },
            { id: 'i3', label: 'Social Media Directory', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/get-involved/social-media-directory/' },
            { id: 'i4', label: 'Alumni Engagement Board', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/get-involved/alumni-engagement-board/' },
            { id: 'i5', label: 'Volunteer', actionType: 'InternalLink', actionValue: basePath + '/volunteer' },
        ],
    },
    {
        id: 'col-news',
        label: 'News & Events',
        items: [
            { id: 'n1', label: 'Alumni Stories', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/news-events/alumni-stories/' },
            { id: 'n2', label: 'Alumni Newsletter', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/news-events/newsletter/' },
            { id: 'n3', label: 'St. Thomas News', actionType: 'ExternalLink', actionValue: 'https://news.stthomas.edu/' },
            { id: 'n4', label: 'Events Calendar', actionType: 'InternalLink', actionValue: basePath + '/events' },
            { id: 'n5', label: 'Signature Events', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/news-events/signature-events/' },
        ],
    },
    {
        id: 'col-support',
        label: 'Support St. Thomas',
        items: [
            { id: 's1', label: 'Make a Gift', actionType: 'ExternalLink', actionValue: 'https://give.stthomas.edu/' },
            { id: 's2', label: 'Refer a Student', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/support/refer/' },
            { id: 's3', label: 'Mentor a Student', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/support/mentor/' },
            { id: 's4', label: 'Hire a Tommie', actionType: 'ExternalLink', actionValue: 'https://www.stthomas.edu/alumni/support/hire/' },
            { id: 's5', label: 'Tommy Give Day', actionType: 'ExternalLink', actionValue: 'https://give.stthomas.edu/tommie-give-day' },
        ],
    },
];

export default class UstAlumniFooter extends NavigationMixin(LightningElement) {
    /** Developer Name of the Experience Cloud footer navigation menu */
    @api footerMenuName = 'Alumni_Portal_Footer';

    logoUrl = UST_LOGO_PURPLE;

    _rawFooterItems = null;

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
    @wire(getMenuItems, { menuName: '$footerMenuName' })
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


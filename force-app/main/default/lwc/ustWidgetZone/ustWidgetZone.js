import { LightningElement, api, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getWidgetsForZone from '@salesforce/apex/PortalWidgetController.getWidgetsForZone';

/**
 * ustWidgetZone
 *
 * Host container placed once per zone in Experience Builder. Queries
 * UST_Portal_Widget__c via PortalWidgetController and renders the matching
 * widgets in sort order.
 *
 * ADDING A WIDGET TO THE REGISTRY
 * When a new widget LWC is built (e.g. c-ust-profile-card):
 *   1. Add a boolean entry to WIDGET_REGISTRY below.
 *   2. Add the matching lwc:if / lwc:elseif block in ustWidgetZone.html.
 *   3. Deploy both files together.
 *
 * The stub (ustPortalWidgetStub) renders for any componentName that does not
 * yet have a matching entry. In the live site the stub is invisible;
 * in Experience Builder it shows a labeled placeholder card.
 */

/**
 * Registry of known Widget Type values → boolean flag name.
 * Each key must exactly match a Component_Name__c picklist value.
 * Each value is the flag property set on the widget object and referenced
 * by lwc:if in the template.
 *
 * HOW TO ADD A NEW WIDGET
 * 1. Add:  ust_profile_card: 'isProfileCard'
 * 2. Add matching lwc:if block in ustWidgetZone.html
 */
const WIDGET_REGISTRY = {
    ust_static_content: 'isStaticContent',
    // ust_profile_card:           'isProfileCard',
    // ust_events_widget:          'isEventsWidget',
    // ust_give_widget:            'isGiveWidget',
    // ust_engagement_summary:     'isEngagementSummary',
    // ust_connection_messages:    'isConnectionMessages',
    // ust_preference_center:      'isPreferenceCenter',
    // ust_alumni_directory:       'isAlumniDirectory',
    // ust_links_hub:              'isLinksHub',
    // ust_communications_history: 'isCommunicationsHistory',
    // ust_photo_story:            'isPhotoStory',
    // ust_athletics:              'isAthletics',
    // ust_videos_media:           'isVideosMedia',
    // ust_volunteer:              'isVolunteer',
    // ust_alumni_news:            'isAlumniNews',
};

export default class UstWidgetZone extends LightningElement {
    /** Zone identifier - set in Experience Builder property panel.
     *  Must match Zone__c picklist value: body, sidebar, banner, above_footer */
    @api zoneName;

    /** Page context slug - set in Experience Builder property panel.
     *  Must match Page_Context__c value: home, events, giving, profile, directory, news, all */
    @api pageContext;

    @track activeWidgets = [];
    @track isLoading = true;
    @track hasError = false;
    @track errorMessage = '';

    _isBuilderMode = false;

    /** Detects whether the component is rendering inside Experience Builder (commeditor). */
    @wire(CurrentPageReference)
    setCurrentPageReference(currentPageReference) {
        const application = currentPageReference && currentPageReference.state && currentPageReference.state.app;
        this._isBuilderMode = application === 'commeditor';
    }

    /** Wire adapter - fires reactively when zoneName or pageContext are set or change. */
    @wire(getWidgetsForZone, { zoneName: '$zoneName', pageContext: '$pageContext' })
    loadWidgetsResult({ data, error }) {
        if (data === undefined && error === undefined) {
            return;
        }
        this.isLoading = false;
        if (data) {
            this.activeWidgets = this.buildWidgetRegistry(data);
            this.hasError = false;
        } else if (error) {
            this.hasError = true;
            this.errorMessage = (error.body && error.body.message)
                ? error.body.message
                : (error.message || 'Unknown error loading widgets');
        }
    }

    connectedCallback() {
        if (!this.zoneName || !this.pageContext) {
            this.isLoading = false;
        }
    }

    /**
     * Maps each PortalWidgetDto from Apex into a plain object with boolean flags
     * derived from WIDGET_REGISTRY. The flags drive the lwc:if/lwc:elseif chain
     * in the template.
     *
     * @param {Array} items - PortalWidgetDto list from Apex
     * @return {Array} enriched widget objects with boolean registry flags
     */
    buildWidgetRegistry(items) {
        return (items || []).map(item => {
            const flags = {};
            const flagName = WIDGET_REGISTRY[item.componentName];
            if (flagName) {
                flags[flagName] = true;
            }
            return {
                id:            item.id,
                widgetLabel:   item.widgetLabel,
                componentName: item.componentName,
                sortOrder:     item.sortOrder,
                description:   item.description,
                staticContent: item.staticContent,
                ...flags
            };
        });
    }

    get isBuilderMode() {
        return this._isBuilderMode;
    }

    get isEmpty() {
        return !this.isLoading && !this.hasError && this.activeWidgets.length === 0;
    }
}

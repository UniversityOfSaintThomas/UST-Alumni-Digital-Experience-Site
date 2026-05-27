import { LightningElement, api, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getWidgetsForZone from '@salesforce/apex/PortalWidgetController.getWidgetsForZone';

/**
 * ustWidgetZone
 *
 * Host container placed once per zone in Experience Builder. Queries
 * UST_Portal_Widget__c via PortalWidgetController and renders the matching
 * widgets in sort order. Each widget is mapped to a boolean flag that drives
 * the lwc:if/lwc:elseif registry chain in the template.
 *
 * ADDING A WIDGET TO THE REGISTRY
 * When a new widget LWC is built (e.g. c-ust-profile-card):
 *   1. Add a boolean entry to buildWidgetRegistry() below.
 *   2. Add the matching lwc:if/lwc:elseif block in ustWidgetZone.html.
 *   3. Deploy both files together.
 *
 * The stub (ustPortalWidgetStub) renders for any componentName that does not
 * yet have a matching lwc:if entry. In the live site the stub is invisible;
 * in Experience Builder it shows a labeled placeholder card.
 */
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
            // Wire not yet ready (params not set)
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
        // If zoneName or pageContext are not configured in Experience Builder,
        // clear the loading state immediately so the empty-state message renders.
        if (!this.zoneName || !this.pageContext) {
            this.isLoading = false;
        }
    }

    /**
     * Maps each PortalWidgetDto from Apex into a plain object augmented with
     * boolean flags. The flags power the lwc:if/lwc:elseif registry chain in
     * the template - they cannot be getters on a class instance because LWC
     * templates can only access plain object properties in lwc:for iterations.
     *
     * HOW TO ADD A NEW WIDGET
     * Uncomment (or add) one boolean line per new widget component:
     *   isProfileCard: item.componentName === 'ust_profile_card',
     * Then add the matching <template lwc:if={widget.isProfileCard}> block
     * in ustWidgetZone.html.
     *
     * @param {Array} items - PortalWidgetDto list from Apex
     * @return {Array} enriched widget objects with boolean registry flags
     */
    buildWidgetRegistry(items) {
        return (items || []).map(item => ({
            id:            item.id,
            widgetLabel:   item.widgetLabel,
            componentName: item.componentName,
            sortOrder:     item.sortOrder,
            description:   item.description,

            // ----- COMPONENT REGISTRY -----
            // Uncomment one line per widget as its LWC is built and deployed.
            // Keep this list in the same order as the lwc:if chain in the HTML.
            //
            // isProfileCard:          item.componentName === 'ust_profile_card',
            // isEventsWidget:         item.componentName === 'ust_events_widget',
            // isGiveWidget:           item.componentName === 'ust_give_widget',
            // isEngagementSummary:    item.componentName === 'ust_engagement_summary',
            // isConnectionMessages:   item.componentName === 'ust_connection_messages',
            // isPreferenceCenter:     item.componentName === 'ust_preference_center',
            // isAlumniDirectory:      item.componentName === 'ust_alumni_directory',
            // isLinksHub:             item.componentName === 'ust_links_hub',
            // isCommunicationsHistory:item.componentName === 'ust_communications_history',
            // isPhotoStory:           item.componentName === 'ust_photo_story',
            // isAthletics:            item.componentName === 'ust_athletics',
            // isVideosMedia:          item.componentName === 'ust_videos_media',
            // isVolunteer:            item.componentName === 'ust_volunteer',
            // isAlumniNews:           item.componentName === 'ust_alumni_news',
        }));
    }

    get isBuilderMode() {
        return this._isBuilderMode;
    }

    get isEmpty() {
        return !this.isLoading && !this.hasError && this.activeWidgets.length === 0;
    }
}
import { LightningElement, api } from 'lwc';

/**
 * ustPortalWidgetStub
 *
 * Development placeholder for widget registry slots that do not yet have
 * a real LWC implementation. Visible in Experience Builder so the zone
 * layout is legible before widgets are built; invisible in the live site
 * so alumni never see a stub card.
 */
export default class UstPortalWidgetStub extends LightningElement {
    /** Admin-assigned Widget Name from UST_Portal_Widget__c */
    @api widgetLabel;

    /** Component_Name__c value this stub is standing in for */
    @api componentName;

    /** True when rendering inside Experience Builder (commeditor mode) */
    @api isBuilderMode = false;

    get stubAriaLabel() {
        return 'Placeholder: ' + (this.widgetLabel || this.componentName || 'Unregistered Widget');
    }
}
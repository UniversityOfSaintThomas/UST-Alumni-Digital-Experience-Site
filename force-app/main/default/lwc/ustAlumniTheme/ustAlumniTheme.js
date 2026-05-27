import { LightningElement, api } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import UST_ALUMNI_TEMPLATE from '@salesforce/resourceUrl/ustAlumniThemplate';

export default class UstAlumniTheme extends LightningElement {
    /** Developer Name of the primary navigation menu set in Experience Builder */
    @api navMenuName = 'Alumni_Portal_Navigation';

    /** Developer Name of the footer navigation menu set in Experience Builder */
    @api footerMenuName = 'Alumni_Portal_Footer';

    /**
     * Load brand assets from the static resource zip at the document level so
     * they apply outside shadow DOM boundaries:
     *
     *  ust-branding.css — sets all --dxp-* hooks to UST values on :root.
     *                     Affects every Salesforce base component on the page
     *                     and integrates with the Experience Builder Theme panel.
     *
     *  ust-fonts.css    — @font-face declarations for Lato (sans) and Lora (serif).
     *                     Must load BEFORE ust-branding.css references the font names,
     *                     but order isn't strictly enforced by the browser at parse time.
     */
    connectedCallback() {
        Promise.all([
            loadStyle(this, UST_ALUMNI_TEMPLATE + '/css/ust-branding.css'),
            loadStyle(this, UST_ALUMNI_TEMPLATE + '/css/ust-fonts.css')
        ]).catch(error => {
            // Non-fatal: components degrade gracefully to system font / color fallbacks
            console.warn('UST Alumni: could not load brand assets.', error);
        });
    }
}
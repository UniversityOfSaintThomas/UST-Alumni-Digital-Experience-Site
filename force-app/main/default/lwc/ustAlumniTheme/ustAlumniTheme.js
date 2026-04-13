import { LightningElement, api } from 'lwc';

export default class UstAlumniTheme extends LightningElement {
    /** Developer Name of the primary navigation menu set in Experience Builder */
    @api navMenuName = 'Alumni_Portal_Navigation';

    /** Developer Name of the footer navigation menu set in Experience Builder */
    @api footerMenuName = 'Alumni_Portal_Footer';
}


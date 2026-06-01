import { LightningElement } from 'lwc';
import UST_ALUMNI_TEMPLATE from '@salesforce/resourceUrl/ustAlumniThemplate';
import basePath from '@salesforce/community/basePath';

/**
 * @slot navFooter
 */
export default class UstAlumniFooter extends LightningElement {
    logoUrl = UST_ALUMNI_TEMPLATE + '/images/ustLogoPurple.svg';

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
}
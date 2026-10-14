/**
 * ustMyFavorites
 *
 * Renders the current alumnus's personal favorites list on the My Profile page, grouped by
 * target type into "Alumni I'm Following" and "Businesses I'm Following" sections. Read-only
 * curation view - favoriting/unfavoriting itself happens via ustFavoriteToggle in the
 * directory/news/business lists elsewhere in the portal, not from this component.
 *
 * Favorites whose target record has been deleted/archived (isOrphaned) are shown with a
 * distinct, de-emphasized treatment rather than being silently dropped, so the alumnus isn't
 * confused by a favorite count that doesn't match what renders.
 */
import { LightningElement } from 'lwc';
import getMyFavorites from '@salesforce/apex/AlumniFavoriteController.getMyFavorites';

const TARGET_TYPE_ALUMNI_DIRECTORY = 'Alumni_Directory';
const TARGET_TYPE_PROFESSIONAL_DIRECTORY = 'Professional_Directory';

export default class UstMyFavorites extends LightningElement {
    isLoading = true;
    errorMessage = '';
    alumniFavorites = [];
    businessFavorites = [];

    connectedCallback() {
        this.loadFavorites();
    }

    loadFavorites() {
        this.isLoading = true;
        getMyFavorites()
            .then((favorites) => {
                this.alumniFavorites = favorites.filter(
                    (favorite) => favorite.targetType === TARGET_TYPE_ALUMNI_DIRECTORY
                );
                this.businessFavorites = favorites.filter(
                    (favorite) => favorite.targetType === TARGET_TYPE_PROFESSIONAL_DIRECTORY
                );
                this.errorMessage = '';
            })
            .catch((error) => {
                this.errorMessage = error?.body?.message || 'Unable to load your favorites.';
                this.alumniFavorites = [];
                this.businessFavorites = [];
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    get hasAlumniFavorites() {
        return this.alumniFavorites.length > 0;
    }

    get hasBusinessFavorites() {
        return this.businessFavorites.length > 0;
    }

    get hasAnyFavorites() {
        return this.hasAlumniFavorites || this.hasBusinessFavorites;
    }

    get showEmptyState() {
        return !this.isLoading && !this.errorMessage && !this.hasAnyFavorites;
    }
}

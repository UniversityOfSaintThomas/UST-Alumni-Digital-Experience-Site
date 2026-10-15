/**
 * ustFavoriteToggle
 *
 * Small, reusable favorite/unfavorite button. Embedded wherever an alumnus can favorite an
 * alumni profile (Alumni_Directory__c) or a business listing (Professional_Directory__c) -
 * currently alumniDirectoryList, alumniNewsList, and alumniBusinessDirectory (Task 4).
 *
 * @api targetType matches AlumniFavoriteController.TARGET_TYPE_* string constants
 * ('Alumni_Directory' or 'Professional_Directory'). @api targetRecordId is the Id of the
 * Alumni_Directory__c or Professional_Directory__c row this toggle controls.
 */
import { LightningElement, api } from 'lwc';
import isFavorited from '@salesforce/apex/AlumniFavoriteController.isFavorited';
import addFavorite from '@salesforce/apex/AlumniFavoriteController.addFavorite';
import removeFavorite from '@salesforce/apex/AlumniFavoriteController.removeFavorite';

export default class UstFavoriteToggle extends LightningElement {
    @api targetType;
    @api targetRecordId;

    isFavorited = false;
    isLoading = true;
    isSaving = false;
    errorMessage = '';

    connectedCallback() {
        this.loadFavoriteState();
    }

    loadFavoriteState() {
        if (!this.targetType || !this.targetRecordId) {
            this.isLoading = false;
            return;
        }

        this.isLoading = true;
        isFavorited({ targetType: this.targetType, targetRecordId: this.targetRecordId })
            .then((result) => {
                this.isFavorited = result;
                this.errorMessage = '';
            })
            .catch((error) => {
                this.errorMessage = error?.body?.message || 'Unable to load favorite status.';
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    get iconName() {
        return this.isFavorited ? 'utility:favorite' : 'utility:add';
    }

    get variant() {
        return this.isFavorited ? 'brand' : 'border-filled';
    }

    get buttonLabel() {
        return this.isFavorited ? 'Remove from favorites' : 'Add to favorites';
    }

    get isDisabled() {
        return this.isLoading || this.isSaving || !this.targetType || !this.targetRecordId;
    }

    handleToggleClick() {
        // Optimistic UI: flip immediately, roll back on error, so the button feels
        // responsive even though add/remove are not cacheable Apex calls.
        const wasFavorited = this.isFavorited;
        const nextState = !wasFavorited;
        this.isFavorited = nextState;
        this.isSaving = true;
        this.errorMessage = '';

        const request = nextState
            ? addFavorite({ targetType: this.targetType, targetRecordId: this.targetRecordId })
            : removeFavorite({ targetType: this.targetType, targetRecordId: this.targetRecordId });

        request
            .then(() => {
                this.dispatchEvent(
                    new CustomEvent('favoritechange', {
                        detail: {
                            targetType: this.targetType,
                            targetRecordId: this.targetRecordId,
                            isFavorited: nextState
                        }
                    })
                );
            })
            .catch((error) => {
                this.isFavorited = wasFavorited;
                this.errorMessage = error?.body?.message || 'Unable to update your favorites.';
            })
            .finally(() => {
                this.isSaving = false;
            });
    }
}
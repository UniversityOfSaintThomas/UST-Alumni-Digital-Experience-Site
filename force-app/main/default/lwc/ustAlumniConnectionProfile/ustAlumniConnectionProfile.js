/**
 * ustAlumniConnectionProfile
 *
 * Read-only detail widget for the Alumni Connections page. Subscribes to the AlumniSelection
 * Lightning Message Channel - when a list/search widget elsewhere on the page (directory,
 * news, business) publishes a contactId, this component loads and renders that alumnus's
 * connected profile (directory info + public news mentions + approved business listings)
 * via AlumniConnectionsController, plus an embedded favorite toggle for the viewed alum.
 *
 * Deliberately has no state before a message arrives ("showPromptState") and no fallback to
 * any URL parameter - selection is in-memory only per the project's decision not to expose
 * Contact/Alumni_Directory Ids in the address bar. A page refresh returns to the prompt state.
 */
import { LightningElement, wire } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import getConnectedProfile from '@salesforce/apex/AlumniConnectionsController.getConnectedProfile';
import ALUMNI_SELECTION_CHANNEL from '@salesforce/messageChannel/AlumniSelection__c';

export default class UstAlumniConnectionProfile extends LightningElement {
    profile = {};
    hasSelection = false;
    isLoading = false;
    errorMessage = '';

    subscription = null;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        this.subscription = subscribe(
            this.messageContext,
            ALUMNI_SELECTION_CHANNEL,
            (message) => this.handleAlumniSelected(message)
        );
    }

    disconnectedCallback() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }

    handleAlumniSelected(message) {
        this.hasSelection = true;

        if (!message?.contactId) {
            this.profile = {};
            this.errorMessage = '';
            this.isLoading = false;
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        getConnectedProfile({ contactId: message.contactId })
            .then((data) => {
                this.profile = data;
            })
            .catch((error) => {
                this.errorMessage = error?.body?.message || 'Unable to load this alumni connection.';
                this.profile = {};
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // ─── Computed display getters ────────────────────────────────────────────

    get hasProfile() {
        return !!this.profile?.hasProfile;
    }

    get showPromptState() {
        return !this.isLoading && !this.errorMessage && !this.hasSelection;
    }

    get showEmptyState() {
        return !this.isLoading && !this.errorMessage && this.hasSelection && !this.hasProfile;
    }

    get displayFirstName() {
        return this.profile.nickname?.trim() || this.profile.firstNameText || '';
    }

    get displayLastName() {
        const lastName = this.profile.lastNameText || '';
        const studentLastName = this.profile.studentLastNameText;
        return studentLastName && studentLastName !== lastName
            ? `${lastName} (${studentLastName})`
            : lastName;
    }

    get newsItems() {
        return this.profile.newsItems || [];
    }

    get hasNewsItems() {
        return this.newsItems.length > 0;
    }

    get businessListings() {
        return this.profile.businessListings || [];
    }

    get hasBusinessListings() {
        return this.businessListings.length > 0;
    }
}

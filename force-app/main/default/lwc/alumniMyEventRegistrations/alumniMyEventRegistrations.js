/**
 * Created by nguy0092 on 7/31/2026.
 *
 * Alumni My Event Registrations — shows the logged-in alumnus's current and future
 * Summit Event registrations, sorted by Event Instance start date.
 */

import { LightningElement, wire } from 'lwc';
import userId from '@salesforce/user/Id';
import isGuest from '@salesforce/user/isGuest';
import CONTACTID from '@salesforce/schema/User.ContactId';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import getCurrentAndFutureRegistrations from '@salesforce/apex/AlumniMyEventRegistrationsController.getCurrentAndFutureRegistrations';

export default class AlumniMyEventRegistrations extends LightningElement {
    currentUserId = userId;
    isUserGuest = isGuest;
    contactId;
    registrations = [];
    isLoading = true;
    activeEventId;
    popoverBelow = false;
    windowStart = 0;
    WINDOW_SIZE = 3;

    @wire(getRecord, { recordId: '$currentUserId', fields: [CONTACTID] })
    wiredUser({ data, error }) {
        if (data) {
            this.contactId = getFieldValue(data, CONTACTID);
            if (!this.contactId) {
                this.isLoading = false;
            }
        } else if (error) {
            console.error('Error fetching current user contact', error);
            this.isLoading = false;
        }
    }

    @wire(getCurrentAndFutureRegistrations, { contactId: '$contactId' })
    wiredRegistrations({ data, error }) {
        if (!this.contactId) {
            return;
        }
        if (data) {
            this.registrations = data;
        } else if (error) {
            console.error('Error fetching event registrations', error);
            this.registrations = [];
        }
        this.isLoading = false;
    }

    get shouldRender() {
        return !this.isUserGuest && !this.isLoading && this.registrations.length > 0;
    }

    get decoratedRegistrations() {
        return this.registrations.slice(this.windowStart, this.windowStart + this.WINDOW_SIZE).map((registration, index) => ({
            ...registration,
            isActive: registration.registrationId === this.activeEventId,
            popoverClass: this.getPopoverClass(registration.registrationId),
            formattedStartDate: this.formatDateMmDdYyyy(registration.startDate),
            plainDescription: this.stripHtml(registration.description),
            rowNumber: this.windowStart + index + 1
        }));
    }

    get showWindowControls() {
        return this.registrations.length > this.WINDOW_SIZE;
    }

    get isAtWindowStart() {
        return this.windowStart === 0;
    }

    get isAtWindowEnd() {
        return this.windowStart + this.WINDOW_SIZE >= this.registrations.length;
    }

    handleWindowUp() {
        if (!this.isAtWindowStart) {
            this.windowStart -= 1;
        }
    }

    handleWindowDown() {
        if (!this.isAtWindowEnd) {
            this.windowStart += 1;
        }
    }

    getPopoverClass(registrationId) {
        const baseClass = 'slds-popover slds-popover_tooltip alumni-event-listings-popover';
        if (registrationId === this.activeEventId && this.popoverBelow) {
            return `${baseClass} alumni-event-listings-popover_below`;
        }
        return baseClass;
    }

    formatDateMmDdYyyy(isoDateString) {
        if (!isoDateString) {
            return '';
        }
        const [year, month, day] = isoDateString.split('-');
        if (!year || !month || !day) {
            return '';
        }
        return `${month}/${day}/${year}`;
    }

    stripHtml(htmlString) {
        if (!htmlString) {
            return '';
        }
        const parsedDocument = new DOMParser().parseFromString(htmlString, 'text/html');
        return (parsedDocument.body.textContent || '').replace(/\s+/g, ' ').trim();
    }

    handleRowActivate(event) {
        this.activeEventId = event.currentTarget.dataset.id;

        const POPOVER_MIN_SPACE_ABOVE = 150;
        const rowRect = event.currentTarget.getBoundingClientRect();
        this.popoverBelow = rowRect.top < POPOVER_MIN_SPACE_ABOVE;
    }

    handleRowDeactivate() {
        this.activeEventId = undefined;
    }
}

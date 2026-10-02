/**
 * Created by nguy0092 on 10/1/2026.
 *
 * Alumni My Upcoming Events — shows upcoming Summit Events filtered against the
 * logged-in alumnus's Alumni Directory affiliations/preferences, grouped by
 * event with each event's instance dates listed underneath, sorted by
 * Event Instance start date.
 */

import { LightningElement, wire } from 'lwc';
import userId from '@salesforce/user/Id';
import isGuest from '@salesforce/user/isGuest';
import CONTACTID from '@salesforce/schema/User.ContactId';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import getFilteredUpcomingEvents from '@salesforce/apex/AlumniMyUpcomingEventsController.getFilteredUpcomingEvents';

export default class AlumniMyUpcomingEvents extends LightningElement {
    currentUserId = userId;
    isUserGuest = isGuest;
    contactId;
    upcomingEvents = [];
    isLoading = true;
    activeEventId;
    popoverBelow = false;
    windowStart = 0;
    WINDOW_SIZE = 3;
    HOVER_DELAY_MS = 300;
    hoverTimeoutId;
    expandedEventIds = new Set();

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

    @wire(getFilteredUpcomingEvents, { contactId: '$contactId' })
    wiredUpcomingEvents({ data, error }) {
        if (!this.contactId) {
            return;
        }
        if (data) {
            this.upcomingEvents = data;
        } else if (error) {
            console.error('Error fetching upcoming events', error);
            this.upcomingEvents = [];
        }
        this.isLoading = false;
    }

    get shouldRender() {
        return !this.isUserGuest && !this.isLoading && this.upcomingEvents.length > 0;
    }

    get decoratedUpcomingEvents() {
        return this.upcomingEvents.slice(this.windowStart, this.windowStart + this.WINDOW_SIZE).map((upcomingEvent, index) => {
            const isExpanded = this.expandedEventIds.has(upcomingEvent.eventId);
            return {
                ...upcomingEvent,
                isActive: upcomingEvent.eventId === this.activeEventId,
                popoverClass: this.getPopoverClass(upcomingEvent.eventId),
                plainDescription: this.stripHtml(upcomingEvent.description),
                rowNumber: this.windowStart + index + 1,
                isExpanded,
                toggleLabel: isExpanded ? 'Close dates' : 'See dates and register for event',
                decoratedInstances: upcomingEvent.instances.map((instance) => ({
                    ...instance,
                    formattedStartDate: this.formatDateMmDdYyyy(instance.startDate)
                }))
            };
        });
    }

    get showWindowControls() {
        return this.upcomingEvents.length > this.WINDOW_SIZE;
    }

    get isAtWindowStart() {
        return this.windowStart === 0;
    }

    get isAtWindowEnd() {
        return this.windowStart + this.WINDOW_SIZE >= this.upcomingEvents.length;
    }

    get totalEventsLabel() {
        const total = this.upcomingEvents.length;
        return `${total} total event${total === 1 ? '' : 's'}`;
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

    handleToggleDates(event) {
        // Prevent the row's hover/focus popover handlers from reacting to this click.
        event.stopPropagation();

        const eventId = event.currentTarget.dataset.id;
        const expandedEventIds = new Set(this.expandedEventIds);
        if (expandedEventIds.has(eventId)) {
            expandedEventIds.delete(eventId);
        } else {
            expandedEventIds.add(eventId);
        }
        this.expandedEventIds = expandedEventIds;
    }

    getPopoverClass(eventId) {
        const baseClass = 'slds-popover slds-popover_tooltip alumni-event-listings-popover';
        if (eventId === this.activeEventId && this.popoverBelow) {
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
        const currentTarget = event.currentTarget;
        const eventId = currentTarget.dataset.id;

        // Keyboard focus should show the popover immediately for accessibility.
        if (event.type === 'focus') {
            this.activateRow(currentTarget, eventId);
            return;
        }

        // Delay hover activation slightly so quickly passing over a row
        // (e.g. to reach a row above/below it) doesn't flash its popover.
        this.clearHoverTimeout();
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.hoverTimeoutId = setTimeout(() => {
            this.hoverTimeoutId = undefined;
            this.activateRow(currentTarget, eventId);
        }, this.HOVER_DELAY_MS);
    }

    handleRowDeactivate() {
        this.clearHoverTimeout();
        this.activeEventId = undefined;
    }

    activateRow(currentTarget, eventId) {
        this.activeEventId = eventId;

        const POPOVER_MIN_SPACE_ABOVE = 150;
        const rowRect = currentTarget.getBoundingClientRect();
        this.popoverBelow = rowRect.top < POPOVER_MIN_SPACE_ABOVE;
    }

    clearHoverTimeout() {
        if (this.hoverTimeoutId) {
            clearTimeout(this.hoverTimeoutId);
            this.hoverTimeoutId = undefined;
        }
    }

    disconnectedCallback() {
        this.clearHoverTimeout();
    }
}

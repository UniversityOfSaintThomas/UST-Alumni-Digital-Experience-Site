import { LightningElement, api } from 'lwc';
import getPlacements from '@salesforce/apex/PortalPageRegistry.getPlacements';

/** Page Context value meaning "every page that has the selected zone". */
const ALL_PAGES_VALUE = 'all';

/** Registry wildcard for zones that live in a shared theme layout. */
const LAYOUT_PAGE_NAME = '*';

/** Allowed characters in a typed page name (lowercased page API names). */
const PAGE_NAME_PATTERN = /^[a-z0-9_-]+$/;

/**
 * ustPageContextPicker
 *
 * Page Context chooser for a Portal Widget. Only offers pages that actually have the widget's zone,
 * using the registry that Experience Builder keeps up to date (UST_Portal_Zone_Placement__c).
 *
 * - Choosing a different zone automatically removes known pages that lack it, with a notice and Undo.
 * - Pages the registry does not know (legacy values, or pages not yet opened in Experience Builder)
 *   are kept and flagged, and a page name can be typed in to pre-configure a widget.
 * - Shows where the widget will appear.
 *
 * Fires `change` with detail { value } where value is the semicolon-separated Page_Context__c string.
 */
export default class UstPageContextPicker extends LightningElement {
    /** Label shown above the picker. */
    @api label = 'Page Context';

    _zone = '';
    _zoneInitialized = false;
    _selectedPages = [];

    placements = [];
    isLoaded = false;
    loadFailed = false;

    typedPageName = '';
    typedPageError = '';

    removedPages = [];
    removalNotice = '';

    /** Zone the widget is placed in (body, sidebar, banner, above_footer). */
    @api
    get zone() {
        return this._zone;
    }
    set zone(newZone) {
        const previousZone = this._zone;
        this._zone = newZone || '';
        if (!this._zone) {
            return;
        }
        if (!this._zoneInitialized) {
            this._zoneInitialized = true;
            return;
        }
        if (previousZone !== this._zone && this.isLoaded) {
            this.removePagesWithoutZone();
        }
    }

    /** Semicolon-separated page names, as stored in Page_Context__c. */
    @api
    get value() {
        return this._selectedPages.join(';');
    }
    set value(newValue) {
        this._selectedPages = this.parseValue(newValue);
    }

    /** True when at least one page is selected. */
    @api
    checkValidity() {
        return this._selectedPages.length > 0;
    }

    connectedCallback() {
        getPlacements()
            .then((result) => {
                this.placements = result || [];
                this.isLoaded = true;
            })
            .catch(() => {
                this.loadFailed = true;
                this.isLoaded = true;
            });
    }

    // ---- Registry lookups ----

    /** Distinct real page names in the registry (the layout wildcard is not a page). */
    get knownPageNames() {
        const names = new Set();
        this.placements.forEach((placement) => {
            if (placement.pageName !== LAYOUT_PAGE_NAME) {
                names.add(placement.pageName);
            }
        });
        return names;
    }

    pageLabel(pageName) {
        const match = this.placements.find((placement) => placement.pageName === pageName && placement.pageLabel);
        return match ? match.pageLabel : pageName;
    }

    /** True if the registry says the zone is present on that page (directly or through a layout zone). */
    pageHasZone(pageName) {
        return this.placements.some(
            (placement) =>
                placement.zone === this._zone &&
                (placement.pageName === pageName || placement.pageName === LAYOUT_PAGE_NAME)
        );
    }

    get zoneLabel() {
        return this._zone
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /** Known pages that have the selected zone, sorted by label. */
    get availablePageNames() {
        return Array.from(this.knownPageNames)
            .filter((pageName) => this.pageHasZone(pageName))
            .sort((first, second) => this.pageLabel(first).localeCompare(this.pageLabel(second)));
    }

    /** Selected values the registry does not know (other than "all"). */
    get unregisteredSelected() {
        return this._selectedPages.filter(
            (pageName) => pageName !== ALL_PAGES_VALUE && !this.knownPageNames.has(pageName)
        );
    }

    /** Selected known pages that do not have the selected zone. */
    get mismatchedSelected() {
        if (!this._zone) {
            return [];
        }
        return this._selectedPages.filter(
            (pageName) =>
                pageName !== ALL_PAGES_VALUE && this.knownPageNames.has(pageName) && !this.pageHasZone(pageName)
        );
    }

    // ---- Template state ----

    get options() {
        const options = [{ label: 'All Pages', value: ALL_PAGES_VALUE }];
        this.availablePageNames.forEach((pageName) => {
            options.push({ label: this.pageLabel(pageName), value: pageName });
        });
        // Keep every selected value visible so it can be removed, even when it is not offered.
        this._selectedPages.forEach((pageName) => {
            if (!options.some((option) => option.value === pageName)) {
                const suffix = this.knownPageNames.has(pageName) ? ' (no ' + this.zoneLabel + ' zone)' : ' (not registered)';
                options.push({ label: this.pageLabel(pageName) + suffix, value: pageName });
            }
        });
        return options;
    }

    get selectedValues() {
        return this._selectedPages;
    }

    get needsZone() {
        return this.isLoaded && !this._zone;
    }

    get hasRemovalNotice() {
        return this.removedPages.length > 0;
    }

    get warnings() {
        const warnings = [];
        if (this.mismatchedSelected.length > 0) {
            warnings.push(
                'No ' + this.zoneLabel + ' zone on: ' + this.mismatchedSelected.map((name) => this.pageLabel(name)).join(', ') + '.'
            );
        }
        if (this.unregisteredSelected.length > 0) {
            warnings.push(
                'Not registered yet: ' + this.unregisteredSelected.join(', ') +
                    '. The widget only appears once that page has a ' + this.zoneLabel +
                    ' zone with a matching page name (open the page in Experience Builder to register it).'
            );
        }
        return warnings.map((text, index) => ({ key: 'warning-' + index, text }));
    }

    get hasWarnings() {
        return this.warnings.length > 0;
    }

    get coverageText() {
        if (this._selectedPages.length === 0) {
            return '';
        }
        const labels = [];
        if (this._selectedPages.includes(ALL_PAGES_VALUE)) {
            this.availablePageNames.forEach((pageName) => labels.push(this.pageLabel(pageName)));
        } else {
            this._selectedPages.forEach((pageName) => {
                if (this.knownPageNames.has(pageName) && this.pageHasZone(pageName)) {
                    labels.push(this.pageLabel(pageName));
                }
            });
        }
        if (labels.length === 0) {
            return '';
        }
        return labels.join(', ');
    }

    get hasCoverage() {
        return this.coverageText !== '';
    }

    get showsNowhere() {
        return this.isLoaded && this._selectedPages.length > 0 && !this.loadFailed && this.coverageText === '' && this._zone !== '';
    }

    get hasNoSelection() {
        return this._selectedPages.length === 0;
    }

    // ---- Events ----

    handleSelectionChange(event) {
        event.stopPropagation();
        this._selectedPages = event.detail.value || [];
        this.clearRemovalNotice();
        this.notifyChange();
    }

    handleTypedPageInput(event) {
        this.typedPageName = event.target.value || '';
        this.typedPageError = '';
    }

    handleAddTypedPage() {
        const pageName = this.typedPageName.trim().toLowerCase();
        if (!PAGE_NAME_PATTERN.test(pageName)) {
            this.typedPageError = 'Use the page API name: lowercase letters, numbers, underscores, or hyphens.';
            return;
        }
        if (!this._selectedPages.includes(pageName)) {
            this._selectedPages = [...this._selectedPages, pageName];
            this.notifyChange();
        }
        this.typedPageName = '';
        this.typedPageError = '';
    }

    handleUndoRemoval() {
        const restored = this.removedPages.filter((pageName) => !this._selectedPages.includes(pageName));
        this._selectedPages = [...this._selectedPages, ...restored];
        this.clearRemovalNotice();
        this.notifyChange();
    }

    // ---- Zone change ----

    /** Removes known pages that do not have the newly chosen zone and explains what happened. */
    removePagesWithoutZone() {
        const removed = this.mismatchedSelected;
        if (removed.length === 0) {
            this.clearRemovalNotice();
            return;
        }
        this._selectedPages = this._selectedPages.filter((pageName) => !removed.includes(pageName));
        this.removedPages = removed;
        this.removalNotice =
            'Removed ' + removed.map((name) => this.pageLabel(name)).join(', ') +
            ': no ' + this.zoneLabel + ' zone on ' + (removed.length === 1 ? 'that page.' : 'those pages.');
        this.notifyChange();
    }

    clearRemovalNotice() {
        this.removedPages = [];
        this.removalNotice = '';
    }

    notifyChange() {
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value } }));
    }

    parseValue(rawValue) {
        if (!rawValue) {
            return [];
        }
        return rawValue
            .split(';')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
}
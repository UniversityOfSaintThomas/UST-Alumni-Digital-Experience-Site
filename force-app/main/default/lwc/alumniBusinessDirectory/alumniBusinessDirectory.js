/**
 * Created by nguy0092 on 3/19/2026.
 *  - server-side OFFSET pagination via imperative Apex.
 *  - fetchRecords(reset) handles both initial/filter loads (reset=true) and Load More (reset=false)
 *  - fetchCount() runs in parallel on every filter change to get the exact DB total
 *  - totalMatchingCount drives the footer "Showing X of Y" and hides Load More when X >= Y
 */

import { LightningElement, wire } from "lwc";
import { loadStyle } from 'lightning/platformResourceLoader';
import getCompanyIndustryPicklist from "@salesforce/apex/AlumniBusinessDirectoryController.getCompanyIndustryPicklist";
import getCompanySpecialInterestPicklist from "@salesforce/apex/AlumniBusinessDirectoryController.getCompanySpecialInterestPicklist";
import alumniBusinessDirectory from "@salesforce/apex/AlumniBusinessDirectoryController.alumniBusinessDirectory";
import alumniBusinessDirectoryCount from "@salesforce/apex/AlumniBusinessDirectoryController.alumniBusinessDirectoryCount";

// Static Resources — Placeholder Images
import alumni_picture_placeholder from "@salesforce/resourceUrl/alumni_picture_placeholder";
import ust_shield_logo from "@salesforce/resourceUrl/ust_shield_logo_bw";
import facebook_icon from "@salesforce/resourceUrl/facebook_color_icon_24px";
import instagram_icon from "@salesforce/resourceUrl/instagram_color_icon_24px";
import linkedin_icon from "@salesforce/resourceUrl/linkedin_color_icon_24px";
import tiktok_icon from "@salesforce/resourceUrl/tiktok_color_icon_24px";
import xtwitter_icon from "@salesforce/resourceUrl/x_twitter_color_icon_24px";

// Module-level regex constants
const AT_HANDLE_REGEX = /^@/;
const WWW_URL_REGEX   = /^www/i;

export default class AlumniBusinessDirectory extends LightningElement {
  // ─── Record state ─────────────────────────────────────────────────────────
  totalRecords       = [];
  totalMatchingCount = 0;    // exact DB total — drives footer text + Load More visibility
  customRecordsSize  = 9;   //Limit for records per page
  currentOffset      = 0;    // next OFFSET to send to Apex
  hasMore            = true; // false when last page returned fewer than customRecordsSize records
  _fetchGeneration   = 0;   // incremented on every reset — stale async responses are discarded
  _searchDebounceTimer;     // holds the setTimeout ID for debouncing the text search input

  // ─── Modal state ──────────────────────────────────────────────────────────
  selectedDirectoryRecord      = {};
  selectedDirectoryRecordIndex = 0;
  selectedDirectoryRecordSeq   = 0;
  modalAriaHidden = "true";

  // ─── Static assets ────────────────────────────────────────────────────────
  alumniPicturePlaceholder = alumni_picture_placeholder;
  companyLogoPlaceholder   = ust_shield_logo;
  facebookIcon  = facebook_icon;
  instagramIcon = instagram_icon;
  linkedinIcon  = linkedin_icon;
  tiktokIcon    = tiktok_icon;
  xtwitterIcon  = xtwitter_icon;

  // ─── Picklist data ────────────────────────────────────────────────────────
  companyIndustryPickList;
  companySpecialInterestPicklist;

  // ─── Filter state ─────────────────────────────────────────────────────────
  searchWordsFilter     = "";
  stateFilter           = "";
  industryFilter        = "";
  interestFilter        = "";
  discountFilter        = false;
  isLoadingSearchFilter = false;

  // ─── Modal button state ───────────────────────────────────────────────────
  previousRecordDisable = false;
  nextRecordDisable     = false;

  // ─── Computed getters ─────────────────────────────────────────────────────

  get selectedEmailMailto() {
    const email = this.selectedDirectoryRecord?.Company_Email_Address__c;
    return email ? `mailto:${email}` : '#';
  }

  // visibleRecords always mirrors totalRecords in a load-more pattern
  get visibleRecords()     { return this.totalRecords; }
  get visibleRecordsSize() { return this.totalRecords.length; }

  // Load More hides once every matching record has been loaded
  get showLoadMore() {
    return this.totalRecords.length < this.totalMatchingCount;
  }

  // True once any records have been loaded — used to toggle the empty state in the template
  get hasRecords() { return this.totalRecords.length > 0; }

  // Only show the empty state once loading is fully done — prevents a flash of "No results found during the initial load
  get showEmptyState() { return !this.isLoadingSearchFilter && this.totalRecords.length === 0; }

  // Total number of active filters across all 5 fields — shared by hasActiveFilters and moreThanOneFilter
  get activeFilterCount() {
    return [this.searchWordsFilter, this.stateFilter, this.industryFilter, this.interestFilter, this.discountFilter].filter(Boolean).length;
  }

  // True when at least one chip-generating filter is active — shows/hides the filter chips section.
  // Also shows when search + discount are both active so the Clear All button is still accessible.
  get hasActiveFilters() { return this.activeFilterButtons.length > 0 || (!!this.searchWordsFilter && this.discountFilter); }

  // True when 2+ total filters are active — shows/hides the Clear All button
  get moreThanOneFilter() { return this.activeFilterCount > 1; }

  // Builds the array of active filter chip. Discount filter intentionally excluded — the checkbox is always visible
  get activeFilterButtons() {
    const buttons = [];

    if (this.clearIndustry) buttons.push({ key: 'industry', label: this.companyIndustryFilterClearLabel, buttontype: 'filterIndustry' });
    if (this.clearInterest) buttons.push({ key: 'interest', label: this.companyInterestFilterClearLabel, buttontype: 'filterInterest' });
    if (this.clearState)    buttons.push({ key: 'state',    label: this.stateFilterClearLabel, buttontype: 'filterState' });
    return buttons;
  }

  // Template literal replaces string concatenation
  get companyIndustryFilterClearLabel() {
    return `Company Industry: ${this.industryFilter}`;
  }

  get companyInterestFilterClearLabel() {
    return `Company Interest: ${this.interestFilter}`;
  }

  get stateFilterClearLabel() {
    return `State/Province: ${this.stateFilter}`;
  }

  // Derived directly from filter values
  get clearState()    { return !!this.stateFilter; }
  get clearIndustry() { return !!this.industryFilter; }
  get clearInterest() { return !!this.interestFilter; }

  // Single source of truth for filter params — shared by fetchRecords and fetchCount
  get filterParams() {
    return {
      searchWordsFilter: this.searchWordsFilter,
      industryFilter:    this.industryFilter,
      interestFilter:    this.interestFilter,
      stateFilter:       this.stateFilter,
      discountFilter:    String(this.discountFilter)
    };
  }

  // ─── Static data ──────────────────────────────────────────────────────────
  UsCanadaStates = [
    { label: "<All States/Provinces/International>", value: "" },
    // ── United States ──────────────────────────────
    { label: "--All United States--", value: "All United States" },
    { label: "AA - Armed Forces Americas", value: "AA" },
    { label: "AE - Armed Forces AFR/CA/EUR/ME", value: "AE" },
    { label: "AK - Alaska", value: "AK" },
    { label: "AL - Alabama", value: "AL" },
    { label: "AP - Armed Forces Pacific", value: "AP" },
    { label: "AR - Arkansas", value: "AR" },
    { label: "AS - American Samoa", value: "AS" },
    { label: "AZ - Arizona", value: "AZ" },
    { label: "CA - California", value: "CA" },
    { label: "CO - Colorado", value: "CO" },
    { label: "CT - Connecticut", value: "CT" },
    { label: "DC - District of Columbia", value: "DC" },
    { label: "DE - Delaware", value: "DE" },
    { label: "FL - Florida", value: "FL" },
    { label: "FM - Federated States of Micronesia", value: "FM" },
    { label: "GA - Georgia", value: "GA" },
    { label: "GU - Guam", value: "GU" },
    { label: "HI - Hawaii", value: "HI" },
    { label: "IA - Iowa", value: "IA" },
    { label: "ID - Idaho", value: "ID" },
    { label: "IL - Illinois", value: "IL" },
    { label: "IN - Indiana", value: "IN" },
    { label: "KS - Kansas", value: "KS" },
    { label: "KY - Kentucky", value: "KY" },
    { label: "LA - Louisiana", value: "LA" },
    { label: "MA - Massachusetts", value: "MA" },
    { label: "MD - Maryland", value: "MD" },
    { label: "ME - Maine", value: "ME" },
    { label: "MH - Marshall Islands", value: "MH" },
    { label: "MI - Michigan", value: "MI" },
    { label: "MN - Minnesota", value: "MN" },
    { label: "MO - Missouri", value: "MO" },
    { label: "MP - Northern Mariana Islands", value: "MP" },
    { label: "MS - Mississippi", value: "MS" },
    { label: "MT - Montana", value: "MT" },
    { label: "NC - North Carolina", value: "NC" },
    { label: "ND - North Dakota", value: "ND" },
    { label: "NE - Nebraska", value: "NE" },
    { label: "NH - New Hampshire", value: "NH" },
    { label: "NJ - New Jersey", value: "NJ" },
    { label: "NM - New Mexico", value: "NM" },
    { label: "NV - Nevada", value: "NV" },
    { label: "NY - New York", value: "NY" },
    { label: "OH - Ohio", value: "OH" },
    { label: "OK - Oklahoma", value: "OK" },
    { label: "OR - Oregon", value: "OR" },
    { label: "PA - Pennsylvania", value: "PA" },
    { label: "PR - Puerto Rico", value: "PR" },
    { label: "PW - Palau", value: "PW" },
    { label: "RI - Rhode Island", value: "RI" },
    { label: "SC - South Carolina", value: "SC" },
    { label: "SD - South Dakota", value: "SD" },
    { label: "TN - Tennessee", value: "TN" },
    { label: "TX - Texas", value: "TX" },
    { label: "UM - US Minor Outlying Islands", value: "UM" },
    { label: "UT - Utah", value: "UT" },
    { label: "VA - Virginia", value: "VA" },
    { label: "VI - Virgin Islands", value: "VI" },
    { label: "VT - Vermont", value: "VT" },
    { label: "WA - Washington", value: "WA" },
    { label: "WI - Wisconsin", value: "WI" },
    { label: "WV - West Virginia", value: "WV" },
    { label: "WY - Wyoming", value: "WY" },
    // ── Canada ─────────────────────────────────────
    { label: "--All Canadian Provinces--",value: "All Canadian Provinces" },
    { label: "AB - Alberta (CA)", value: "AB" },
    { label: "BC - British Columbia (CA)", value: "BC" },
    { label: "MB - Manitoba (CA)", value: "MB" },
    { label: "NB - New Brunswick (CA)", value: "NB" },
    { label: "NL - Newfoundland and Labrador (CA)", value: "NL" },
    { label: "NS - Nova Scotia (CA)", value: "NS" },
    { label: "NT - Northwest Territories (CA)", value: "NT" },
    { label: "NU - Nunavut (CA)", value: "NU" },
    { label: "ON - Ontario (CA)", value: "ON" },
    { label: "PE - Prince Edward Island (CA)", value: "PE" },
    { label: "QC - Quebec (CA)", value: "QC" },
    { label: "SK - Saskatchewan (CA)", value: "SK" },
    { label: "YT - Yukon (CA)", value: "YT" },
    // ── International - Exclude US and Canada ─────────────────────────────────────
    { label: "--International Only (Outside US & Canada)-->",  value: "International Only" },
  ];

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  hasAncestorWithId(startNode, id) {
    let node = startNode;
    while (node) {
      node = node.parentNode;

      if (typeof ShadowRoot !== "undefined" && node instanceof ShadowRoot) {
        node = node.host;
      }

      if (node && node.nodeType === 1 && node.id === id) {
        return true;
      }
    }

    return false;
  }

  connectedCallback() {
    loadStyle(this, 'https://static.aws.stthomas.edu/alumni-business-styles/styles.css')
      .then(() => {
        console.log('Remote/External styles loaded successfully.');
      })
      .catch(error => {
        console.error('Error loading the styles', error);
      });

    const idInUse = document.getElementById('alumniBusinessDirectory') || this.hasAncestorWithId(this, 'alumniBusinessDirectory');

    if (!idInUse) {
      this.id = 'alumniBusinessDirectory';
    }

    this.resetAndFetch();
    this.loadPicklists();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.closeModalEscKey);
    document.removeEventListener("click", this.closeModalClickOutside);
    clearTimeout(this._searchDebounceTimer);
  }

  loadPicklists() {
    getCompanyIndustryPicklist()
      .then(data => {
        this.companyIndustryPickList = [...data].sort((a, b) => a.label.localeCompare(b.label));
        this.companyIndustryPickList.unshift({ label: "<All Industries>", value: "" });
      })
      .catch(error => console.error("getCompanyIndustryPicklist Error:", error));

    getCompanySpecialInterestPicklist()
      .then(data => {
        this.companySpecialInterestPicklist = [...data].sort((a, b) => a.label.localeCompare(b.label));
        this.companySpecialInterestPicklist.unshift({ label: "<All Interests>", value: "" });
      })
      .catch(error => console.error("getCompanySpecialInterestPicklist Error:", error));
  }

  // ─── Data fetching ────────────────────────────────────────────────────────
  // Resets pagination and fires both fetches in parallel. Called on initial load and every filter change
  resetAndFetch() {
    this.fetchRecords(true);
    this.fetchCount();
  }

  /**
   * Fetches one page of records from Apex.
   * @param {boolean} reset - true  → clear list, reset offset (filter change / initial load)
   *                          false → append next server page (Load More)
   */
  fetchRecords(reset) {
    if (!reset && !this.hasMore) return;

    this.isLoadingSearchFilter = true;

    if (reset) {
      this.currentOffset = 0;
      this.totalRecords  = [];
      this.hasMore       = true;
      this._fetchGeneration++; // invalidate any in-flight requests from the previous filter state
    }

    // Capture the generation at the moment this call is made.
    // If _fetchGeneration has changed by the time .then() runs, this response is stale and discarded.
    const generation = this._fetchGeneration;

    alumniBusinessDirectory({
      ...this.filterParams,
      pageSize: this.customRecordsSize,
      offset:   this.currentOffset
    })
    .then(data => {
      if (generation !== this._fetchGeneration) return; // stale response — a newer search has started
      const processed    = this.processRecords(JSON.parse(JSON.stringify(data)));
      this.totalRecords  = [...this.totalRecords, ...processed];
      this.hasMore       = data.length === this.customRecordsSize;
      this.currentOffset += data.length;
    })
    .catch(error => {
      console.error("alumniBusinessDirectory Error:", error);
    })
    .finally(() => {
      if (generation === this._fetchGeneration) {
        this.isLoadingSearchFilter = false; // only clear the spinner for the latest request
      }
    });
  }

  // Fetches only the total match count — runs in parallel with fetchRecords(true)
  fetchCount() {
    const generation = this._fetchGeneration; // snapshot the current generation

    alumniBusinessDirectoryCount(this.filterParams)
    .then(count => {
      if (generation !== this._fetchGeneration) return; // stale response — discard it
      this.totalMatchingCount = count;
    })
    .catch(error => {
      console.error("alumniBusinessDirectoryCount Error:", error);
    });
  }

  /**
   * Decorates a deep-copied page of Apex records with computed display fields.
   * Uses map() to return new objects — avoids in-place mutation of the for loop.
   */
  processRecords(records) {
    return records.map(r => ({
      ...r,
      Company_Phone__c:             r.Company_Phone__c?.replace(/[-.()\s]/g, ""),
      degreesFormatted:             r.Alumni__c ? (r.Alumni__r?.Degree_s_Formatted__c ?? "") : "",
      Picture_URL__c:               r.Picture_URL__c      || this.alumniPicturePlaceholder,
      Company_Logo_URL__c:          r.Company_Logo_URL__c || this.companyLogoPlaceholder,
      StThomasDiscount:             r.Discounts_for_St_Thomas_Community__c === "Yes" ? "St. Thomas Discount" : "",
      Company_Industry__c:          r.Company_Industry__c?.replace(/;/g, ", "),
      Company_Special_Interests__c: r.Company_Special_Interests__c?.replace(/;/g, ", "),
      FacebookLink:  this.socialMediaLinkValidation("facebook",  r.Company_Facebook__c),
      InstagramLink: this.socialMediaLinkValidation("instagram",  r.Company_Instagram__c),
      LinkedinLink:  this.socialMediaLinkValidation("linkedin",   r.Company_LinkedIn__c),
      TiktokLink:    this.socialMediaLinkValidation("tiktok",     r.Company_TikTok__c),
      XtwitterLink:  this.socialMediaLinkValidation("x",          r.Company_X_formerly_Twitter__c)
    }));
  }

  // ─── Filter handlers ──────────────────────────────────────────────────────
  searchFilter(event) {
    const filterType = event.currentTarget.dataset.filtertype;

    switch (filterType) {
      case "filterSearchWords": this.searchWordsFilter = event.detail.value;            break;
      case "filterState":       this.stateFilter       = event.detail.value;            break;
      case "filterIndustry":    this.industryFilter    = event.detail.value;            break;
      case "filterInterest":    this.interestFilter    = event.detail.value;            break;
      case "filterDiscount":    this.discountFilter    = Boolean(event.target.checked); break;
    }

    if (filterType === "filterSearchWords") {
      // Debounce: wait 300ms after the user stops typing before firing Apex calls.
      // Prevents rapid-fire calls on every keystroke and eliminates the race condition
      // where out-of-order responses would append stale results to the grid.
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = setTimeout(() => this.resetAndFetch(), 300);
    } else {
      // Dropdowns and checkbox respond immediately — no debounce needed
      this.resetAndFetch();
    }
  }

  clearSearchFilter(event) {
    switch (event.currentTarget.dataset.buttontype) {
      case "clearAll":
        this.searchWordsFilter = "";
        this.stateFilter       = "";
        this.industryFilter    = "";
        this.interestFilter    = "";
        this.discountFilter    = false;
        break;
      case "filterState":    this.stateFilter    = ""; break;
      case "filterIndustry": this.industryFilter  = ""; break;
      case "filterInterest": this.interestFilter  = ""; break;
    }
    this.resetAndFetch();
    event.currentTarget.blur();
  }

  loadMoreRecords() {
    this.fetchRecords(false);
  }

  // ─── Modal handlers ───────────────────────────────────────────────────────
  openRecordModal(event) {
    event.stopPropagation(); // allows closeModalClickOutside to be added/removed without worrying about the order of listeners

    const index = this.totalRecords.findIndex(r => r.Id === event.currentTarget.dataset.id);

    if (index === -1) return;
    this.selectedDirectoryRecordIndex = index;
    this.selectedDirectoryRecord      = this.totalRecords[index];

    this.querySelectorHelper(".selected-record-modal").classList.add("slds-fade-in-open");
    this.querySelectorHelper(".selected-record-modal-backdrop").classList.add("slds-backdrop_open");
    // this.querySelectorHelper("[data-buttontype='closeRecord']").focus();
    this.modalAriaHidden = "false";
    document.addEventListener("keydown", this.closeModalEscKey);
    document.removeEventListener("click", this.closeModalClickOutside); //Clean up any previous listener first
    document.addEventListener("click", (this.closeModalClickOutside = () => this.closeRecordModal()));
    this.disablePreviousNext();
    this.selectedDirectoryRecordSeq = this.selectedDirectoryRecordIndex + 1;
  }

  closeRecordModal() {
    this.selectedDirectoryRecordIndex = 0;
    this.querySelectorHelper(".selected-record-modal").classList.remove("slds-fade-in-open");
    this.querySelectorHelper(".selected-record-modal-backdrop").classList.remove("slds-backdrop_open");
    this.modalAriaHidden = "true";
    document.removeEventListener("keydown", this.closeModalEscKey);
    document.removeEventListener("click", this.closeModalClickOutside);
  }

  previousNextRecord(event) {
    const btn = event.currentTarget.dataset.buttontype;
    const max = this.totalRecords.length - 1;

    // else if ensures only one branch executes per click
    if (btn === "previousRecord" && this.selectedDirectoryRecordIndex > 0) {
      this.selectedDirectoryRecordIndex--;
    } else if (btn === "nextRecord" && this.selectedDirectoryRecordIndex < max) {
      this.selectedDirectoryRecordIndex++;
    }

    this.selectedDirectoryRecord    = this.totalRecords[this.selectedDirectoryRecordIndex];
    this.selectedDirectoryRecordSeq = this.selectedDirectoryRecordIndex + 1;
    this.disablePreviousNext();
    event.currentTarget.blur();
  }

  disablePreviousNext() {
    this.previousRecordDisable = this.selectedDirectoryRecordIndex === 0;
    this.nextRecordDisable     = this.selectedDirectoryRecordIndex === this.totalRecords.length - 1;
  }

  closeModalEscKey = (event) => {
    if (event.key === "Escape") this.closeRecordModal();
  };

  ignoreModalClickInside(event) {
    event.stopPropagation();
  }

  // Allows keyboard users to open a record card with Enter or Space.
  handleCardKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openRecordModal(event);
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────
  socialMediaLinkValidation(socialName, originalLink) {
    if (!originalLink) return "";

    try {
      new URL(originalLink);
      return originalLink;
    } catch {
      if (AT_HANDLE_REGEX.test(originalLink)) {
        return `https://www.${socialName}.com/${originalLink.slice(1)}`;
      }
      if (WWW_URL_REGEX.test(originalLink)) {
        return `https://${originalLink}`;
      }
      // Handles "facebook.com/x", "linkedin.com/in/x", bare domains, etc.
      if (originalLink.includes(".")) {
        return `https://${originalLink}`;  // treat as a domain missing the protocol
      }
      // Bare username with no domain hint — build a profile URL
      return `https://www.${socialName}.com/${originalLink}`;
    }
  }

  querySelectorHelper(element) {
    return this.template.querySelector(element);
  }
}
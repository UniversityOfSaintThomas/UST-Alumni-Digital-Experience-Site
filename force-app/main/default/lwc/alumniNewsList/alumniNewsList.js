/**
 * Created by dahl3702 on 6/20/2019.
 */

import {api, LightningElement, track} from 'lwc';
import {NavigationMixin} from 'lightning/navigation';
import getNews from '@salesforce/apex/AlumniNewsListController.getNews';

// The existing My Account route (apiName from
// unpackaged/config/experiences/.../sfdc_cms__route/my_account__c/_meta.json)
// already hosts c-alumni-profile for "my own profile"; reused here with an
// ?id= state param so it also serves the read-only "view another alum" case.
const ALUMNI_PROFILE_PAGE_NAME = 'my_account__c';

// Exported (not just inlined in the click handler) so the old-vs-new routing
// choice can be unit tested directly, without needing to intercept the
// NavigationMixin.Navigate call itself.
export function resolveProfileNavigation(useNewProfileLink, recordId) {
    if (useNewProfileLink) {
        return {
            type: 'comm__namedPage',
            attributes: {
                name: ALUMNI_PROFILE_PAGE_NAME,
            },
            state: {
                id: recordId,
            },
        };
    }

    return {
        type: 'standard__recordPage',
        attributes: {
            actionName: 'view',
            recordId,
        },
    };
}

export default class AlumniNewsList extends NavigationMixin(LightningElement) {

    // When false (default), clicking a news item opens the legacy standard
    // record detail page - required for the old Aura-template site. Set to
    // true on the new LWR site's placement to route to the new Alumni Profile page instead.
    @api useNewProfileLink = false;

    @api pagesize;

    @api
    get currentpage() {
        return this._currentpage;
    }

    set currentpage(value) {
        this.setAttribute('currentpage', value);
        this._currentpage = value;
        this.getTheNews();
    }

    @track totalpages;
    @track error;
    @track _currentpage;
    @track loading = false;

    searchKey;
    classYear;
    totalrecords;
    alumniNews;


    handleKeyChange(event) {
        if (this.searchKey !== event.target.value) {
            this.searchKey = event.target.value;
            if (this.searchKey.length > 3 || this.searchKey.length === 0) {
                this.currentpage = 1;
            }
        }
    }

    handleClassChange(event) {
        if (this.classYear !== event.target.value) {
            let classYearValue = event.target.value;
            event.target.value = classYearValue.replace(/[^0-9.]/g, "");
            if (event.target.value.length > 4) {
                event.target.value = event.target.value.substr(0, 4);
            }
            this.classYear = classYearValue;
            if (classYearValue.length === 4 || !classYearValue) {
                this.currentpage = 1;
            }
        }
    }

    handleNewsItemClick(event) {
        this[NavigationMixin.Navigate](
            resolveProfileNavigation(this.useNewProfileLink, event.target.dataset.aid)
        );
    }

    getTheNews(pageOne) {
        this.loading = true;
        getNews({
            pagenumber: this.currentpage,
            pageSize: 10,
            searchString: this.searchKey,
            classYearString: this.classYear
        }).then(news => {
            if (news.length > 0) {
                this.totalrecords = news[0].queryCount;
                this.totalpages = Math.ceil(this.totalrecords / this.pagesize);
                this.alumniNews = news;
                this.error = undefined;
                const event = new CustomEvent('recordsload', {
                    detail: {recCount: this.totalrecords}
                });
                this.dispatchEvent(event);
            } else {
                this.alumniNews = [];
                this.totalrecords = 0;
                this.totalpages = 0;
            }
            this.loading = false;
        }).catch(error => {
            this.error = error;
            this.alumniNews = undefined;
            this.loading = false;
        });
    }
}
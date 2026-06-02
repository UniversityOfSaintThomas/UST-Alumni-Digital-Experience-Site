/**
 * Created by dahl3702 on 6/20/2019.
 */

import {api, LightningElement, track} from 'lwc';
import {NavigationMixin} from 'lightning/navigation';
import getNews from '@salesforce/apex/AlumniNewsListController.getNews';

export default class AlumniNewsList extends NavigationMixin(LightningElement) {

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
        // Navigate to a URLd
        console.log('clicked : ' + event.target.dataset.aid);
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                actionName: 'view',
                recordId: event.target.dataset.aid
            },
        });
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
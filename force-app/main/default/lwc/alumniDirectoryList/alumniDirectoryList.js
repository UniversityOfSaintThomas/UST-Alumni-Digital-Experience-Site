/**
 * Created by dahl3702 on 6/11/2019.
 */

import {api, LightningElement, track} from 'lwc';
import {NavigationMixin} from 'lightning/navigation';
import getAlumniDirectory from '@salesforce/apex/AlumniDirectoryListController.getAlumniDirectory';

export default class alumniDirectoryList extends NavigationMixin(LightningElement) {

    @api pagesize;

    @api
    get currentpage() {
        return this._currentpage;
    }

    set currentpage(value) {
        this.setAttribute('currentpage', value);
        this._currentpage = value;
        this.getDirectory();
    }

    @track totalpages;
    @track error;
    @track _currentpage;
    @track loading = false;
    searchKey;
    classYear;
    alumni;
    totalrecords;


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

    handleAlumniClick(event) {
        // Navigate to a URL
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                actionName: 'view',
                recordId: event.target.dataset.aid,
            },
        });
    }

    getDirectory() {
        this.loading = true;
        let searchString = this.searchKey;
        if (searchString) {
            searchString = searchString;
            getAlumniDirectory({
                pagenumber: this.currentpage,
                pageSize: 10,
                searchString: searchString,
                classYearString: this.classYear
            }).then(alumniIn => {
                if (alumniIn.length > 0) {
                    this.totalrecords = alumniIn[0].queryCount;
                    this.totalpages = Math.ceil(this.totalrecords / this.pagesize);
                    this.alumni = alumniIn;
                    this.error = undefined;
                    const event = new CustomEvent('recordsload', {
                        detail: {recCount: this.totalrecords}
                    });
                    this.dispatchEvent(event);
                } else {
                    this.alumni = [];
                    this.totalrecords = 0;
                    this.totalpages = 0;
                }
                this.loading = false;
            }).catch(error => {
                this.error = error;
                this.alumni = undefined;
                this.loading = false;
            });
        } else {
            this.loading = false;
        }
    }
}
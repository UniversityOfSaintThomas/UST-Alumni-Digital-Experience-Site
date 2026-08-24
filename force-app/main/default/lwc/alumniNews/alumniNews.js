/**
 * Created by dahl3702 on 6/20/2019.
 */

import {api, LightningElement, track} from 'lwc';
const PAGE_SIZE = 10;
export default class AlumniNews extends LightningElement {
    @api page = 1;
    @api totalrecords;
    @api _pagesize = PAGE_SIZE;
    @api useNewProfileLink = false;


    get pagesize() {
        return this._pagesize;
    }

    set pagesize(value) {
        this._pagesize = value;
    }
    handlePrevious() {
        if (this.page > 1) {
            this.page = this.page - 1;
        }
    }

    handleNext() {
        if (this.page < this.totalPages) {
            this.page = this.page + 1;
        }
    }

    handleFirst() {
        this.page = 1;
    }

    handleLast() {
        this.page = this.totalPages;
    }

    handleRecordsLoad(event) {
        this.totalrecords = event.detail.recCount;
        this.totalPages = Math.ceil(this.totalrecords / this.pagesize);
    }

}
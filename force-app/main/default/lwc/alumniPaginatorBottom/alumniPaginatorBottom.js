/**
 * Created by dahl3702 on 6/11/2019.
 */

import {api, LightningElement} from 'lwc';

export default class alumniPaginatorBottom extends LightningElement {
    // Api considered as a reactive public property.
    @api totalrecords;
    @api currentpage;
    @api pagesize;

    // getter
    get showFirstButton() {
        if (this.currentpage === 1) {
            return true;
        }
        return false;
    }

    // getter
    get showLastButton() {
        if (Math.ceil(this.totalrecords / this.pagesize) === this.currentpage) {
            return true;
        }
        return false;
    }

    get showPagination() {
        if(this.totalrecords <= this.pagesize || typeof this.totalrecords === "undefined") {
            return false;
        }
        return true
    }

    //Fire events based on the button actions
    handlePrevious() {
        this.dispatchEvent(new CustomEvent('previous'));
    }

    handleNext() {
        this.dispatchEvent(new CustomEvent('next'));
    }

    handleFirst() {
        this.dispatchEvent(new CustomEvent('first'));
    }

    handleLast() {
        this.dispatchEvent(new CustomEvent('last'));
    }
}
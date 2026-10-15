import { LightningElement, api } from 'lwc';

/**
 * Jest stand-in for the awsS3DirectoryImage component from the Salesforce-LWC-S3-Integration dependency
 * (installed through cumulusci.yml, so its source is not in this repo). It exposes the same public
 * properties so tests can check how the editor configures it. Lives outside force-app: never deployed.
 */
export default class AwsS3DirectoryImage extends LightningElement {
    @api recordId;
    @api imageField;
    @api fileNameSuffix;
    @api imageMaxWidth;
    @api imageMaxHeight;
    @api imageMode;
}

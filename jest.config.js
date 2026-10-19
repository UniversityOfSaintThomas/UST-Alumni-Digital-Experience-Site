const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        // The S3 uploader comes from a CumulusCI dependency and is not in this repo.
        '^c/awsS3DirectoryImage$': '<rootDir>/jest-stubs/awsS3DirectoryImage/awsS3DirectoryImage',
        // CSS-only module (no JS file), imported from component CSS with @import 'c/ustSharedStyles'.
        '^c/ustSharedStyles$': '<rootDir>/jest-stubs/ustSharedStyles/ustSharedStyles'
    }
};

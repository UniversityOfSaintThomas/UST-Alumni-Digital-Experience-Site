/**
 * Created by nguy0092 on 4/14/2026.
 */

/**
 * Test class for AlumniBusinessDirectoryController.
 * Covers all four public methods and every filter branch in buildWhereClause.
 */
@IsTest
private class AlumniBusinessDirectoryController_TEST {

    // ─── Test Data Setup ─────────────────────────────────────────────────────

    @TestSetup
    static void makeData() {
        Contact alumni = new Contact(FirstName = 'Test', LastName = 'Alumni');
        insert alumni;

        Id rtId = Schema.SObjectType.Professional_Directory__c
                .getRecordTypeInfosByDeveloperName()
                .get('Alumni_Business')
                .getRecordTypeId();

        List<Professional_Directory__c> recs = new List<Professional_Directory__c>();

        // Record 1 — US/MN · Healthcare · Women Owned · Discount Yes
        recs.add(new Professional_Directory__c(
                RecordTypeId                         = rtId,
                Alumni__c                            = alumni.Id,
                Company_Status__c                    = 'Approved',
                First_Name__c                        = 'Jane',
                Last_Name__c                         = 'Smith',
                Company_Name__c                      = 'HealthCo LLC',
                Company_Description__c               = 'A healthcare company',
                Company_State__c                     = 'MN',
                Company_Country__c                   = 'United States of America',
                Company_Industry__c                  = 'Healthcare',
                Company_Special_Interests__c         = 'Women Owned',
                Discounts_for_St_Thomas_Community__c = 'Yes'
        ));

        // Record 2 — US/CA · Information Technology · Veteran Owned · No discount
        recs.add(new Professional_Directory__c(
                RecordTypeId                         = rtId,
                Alumni__c                            = alumni.Id,
                Company_Status__c                    = 'Approved',
                First_Name__c                        = 'John',
                Last_Name__c                         = 'Doe',
                Company_Name__c                      = 'TechCorp',
                Company_Description__c               = 'A tech company',
                Company_State__c                     = 'CA',
                Company_Country__c                   = 'United States of America',
                Company_Industry__c                  = 'Information Technology',
                Company_Special_Interests__c         = 'Veteran Owned',
                Discounts_for_St_Thomas_Community__c = 'No'
        ));

        // Record 3 — Canadian province (ON) · Education
        recs.add(new Professional_Directory__c(
                RecordTypeId                         = rtId,
                Alumni__c                            = alumni.Id,
                Company_Status__c                    = 'Approved',
                First_Name__c                        = 'Marie',
                Last_Name__c                         = 'Curie',
                Company_Name__c                      = 'CanadaCo',
                Company_Description__c               = 'A Canadian company',
                Company_State__c                     = 'ON',
                Company_Country__c                   = 'Canada',
                Company_Industry__c                  = 'Education',
                Discounts_for_St_Thomas_Community__c = 'No'
        ));

        // Record 4 — International (NULL state) · Manufacturing
        //           "International Only" filter matches via (state NOT IN ... OR state = NULL)
        recs.add(new Professional_Directory__c(
                RecordTypeId                         = rtId,
                Alumni__c                            = alumni.Id,
                Company_Status__c                    = 'Approved',
                First_Name__c                        = 'Hiroshi',
                Last_Name__c                         = 'Tanaka',
                Company_Name__c                      = 'Global Ventures',
                Company_Description__c               = 'An international company',
                Company_Country__c                   = 'Japan',
                Company_Industry__c                  = 'Manufacturing',
                Discounts_for_St_Thomas_Community__c = 'No'
        ));

        // Record 5 — Not Approved: must NEVER appear in results
        recs.add(new Professional_Directory__c(
                RecordTypeId      = rtId,
                Alumni__c         = alumni.Id,
                Company_Status__c = 'Submitted',
                First_Name__c     = 'Hidden',
                Last_Name__c      = 'Record',
                Company_Name__c   = 'HiddenCo'
        ));

        // Record 6 — No Alumni link: must NEVER appear in results
        recs.add(new Professional_Directory__c(
                RecordTypeId      = rtId,
                Company_Status__c = 'Approved',
                First_Name__c     = 'No',
                Last_Name__c      = 'Alumni',
                Company_Name__c   = 'NoAlumniCo'
        ));

        insert recs;
    }

    // ─── Picklist Methods ────────────────────────────────────────────────────

    @IsTest
    static void testGetCompanyIndustryPicklist_returnsActiveEntries() {
        Test.startTest();
        List<Map<String, String>> options =
                AlumniBusinessDirectoryController.getCompanyIndustryPicklist();
        Test.stopTest();

        System.assertNotEquals(null, options, 'Result should not be null');
        System.assert(options.size() > 0, 'Should return at least one industry');

        for (Map<String, String> opt : options) {
            System.assert(opt.containsKey('label'), 'Every entry must have a label key');
            System.assert(opt.containsKey('value'), 'Every entry must have a value key');
            System.assert(String.isNotBlank(opt.get('value')), 'Value must not be blank');
        }
    }

    @IsTest
    static void testGetCompanySpecialInterestPicklist_returnsActiveEntriesOnly() {
        Test.startTest();
        List<Map<String, String>> options =
                AlumniBusinessDirectoryController.getCompanySpecialInterestPicklist();
        Test.stopTest();

        System.assertNotEquals(null, options, 'Result should not be null');
        System.assert(options.size() > 0, 'Should return at least one interest');

        // 'Interest 1' is marked inactive in the metadata — it must be excluded
        for (Map<String, String> opt : options) {
            System.assertNotEquals(
                    'Interest 1', opt.get('value'),
                    'Inactive picklist value "Interest 1" must be excluded'
            );
        }
    }

    // ─── Baseline (no filters) ───────────────────────────────────────────────

    @IsTest
    static void testNoFilters_returnsOnlyApprovedRecordsWithAlumni() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, null, null, null, null);
        Test.stopTest();

        // 4 eligible records (approved + has Alumni); records 5 & 6 excluded
        System.assertEquals(4, count, 'Count should be 4: approved + has-Alumni records only');
        System.assertEquals(4, results.size(), 'Result list size should match count');
    }

    // ─── State Filter Branches ───────────────────────────────────────────────

    @IsTest
    static void testStateFilter_specificState() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, 'MN', null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, 'MN', null, null, null);
        Test.stopTest();

        System.assertEquals(1, count, 'Exactly one record should be in MN');
        System.assertEquals(1, results.size());
        System.assertEquals('MN', results[0].Company_State__c);
    }

    @IsTest
    static void testStateFilter_allUnitedStates() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, 'All United States', null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, 'All United States', null, null, null);
        Test.stopTest();

        // MN and CA are US states
        System.assertEquals(2, count, 'Two records (MN + CA) should fall under All United States');
        System.assertEquals(2, results.size());
    }

    @IsTest
    static void testStateFilter_allCanadianProvinces() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, 'All Canadian Provinces', null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, 'All Canadian Provinces', null, null, null);
        Test.stopTest();

        System.assertEquals(1, count, 'One record (ON) should fall under All Canadian Provinces');
        System.assertEquals(1, results.size());
        System.assertEquals('ON', results[0].Company_State__c);
    }

    @IsTest
    static void testStateFilter_internationalOnly() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, 'International Only', null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, 'International Only', null, null, null);
        Test.stopTest();

        // Record 4 has a NULL state — matches the (NOT IN ... OR state = NULL) branch
        System.assertEquals(1, count, 'One record (NULL state) should qualify as International Only');
        System.assertEquals(1, results.size());
        System.assertEquals('Global Ventures', results[0].Company_Name__c);
    }

    // ─── Industry Filter ─────────────────────────────────────────────────────

    @IsTest
    static void testIndustryFilter() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, null, 'Healthcare', null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, null, null, 'Healthcare', null);
        Test.stopTest();

        System.assertEquals(1, count, 'One record should have Healthcare industry');
        System.assertEquals(1, results.size());
        System.assertEquals('HealthCo LLC', results[0].Company_Name__c);
    }

    // ─── Special Interest Filter ─────────────────────────────────────────────

    @IsTest
    static void testInterestFilter() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, 'Women Owned', null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, null, 'Women Owned', null, null);
        Test.stopTest();

        System.assertEquals(1, count, 'One record should have Women Owned special interest');
        System.assertEquals(1, results.size());
        System.assertEquals('HealthCo LLC', results[0].Company_Name__c);
    }

    // ─── Discount Filter ─────────────────────────────────────────────────────

    @IsTest
    static void testDiscountFilter_trueAddsCondition() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, null, null, 'true', 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, null, null, null, 'true');
        Test.stopTest();

        System.assertEquals(1, count, 'One record offers a St. Thomas discount');
        System.assertEquals(1, results.size());
        System.assertEquals('Yes', results[0].Discounts_for_St_Thomas_Community__c);
    }

    @IsTest
    static void testDiscountFilter_nonTrueValueIsIgnored() {
        // Only the literal string 'true' activates the discount filter
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, null, null, 'false', 9, 0);
        Test.stopTest();

        System.assertEquals(4, results.size(),
                'A discountFilter value other than "true" must not restrict results');
    }

    // ─── Search Words Filter ──────────────────────────────────────────────────

    @IsTest
    static void testSearchFilter_byCompanyName() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        'HealthCo', null, null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        'HealthCo', null, null, null, null);
        Test.stopTest();

        System.assertEquals(1, count);
        System.assertEquals('HealthCo LLC', results[0].Company_Name__c);
    }

    @IsTest
    static void testSearchFilter_byFirstName() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        'Jane', null, null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        'Jane', null, null, null, null);
        Test.stopTest();

        System.assertEquals(1, count);
        System.assertEquals('Jane', results[0].First_Name__c);
    }

    @IsTest
    static void testSearchFilter_byLastName() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        'Tanaka', null, null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        'Tanaka', null, null, null, null);
        Test.stopTest();

        System.assertEquals(1, count);
        System.assertEquals('Tanaka', results[0].Last_Name__c);
    }

    @IsTest
    static void testSearchFilter_byCompanyDescription() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        'international company', null, null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        'international company', null, null, null, null);
        Test.stopTest();

        System.assertEquals(1, count);
        System.assertEquals('Global Ventures', results[0].Company_Name__c);
    }

    @IsTest
    static void testSearchFilter_noMatch() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        'xyzNoMatchTerm99999', null, null, null, null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        'xyzNoMatchTerm99999', null, null, null, null);
        Test.stopTest();

        System.assertEquals(0, count, 'No records should match a nonsense search term');
        System.assertEquals(0, results.size());
    }

    // ─── Pagination ───────────────────────────────────────────────────────────

    @IsTest
    static void testPagination_pageSizeAndOffset() {
        // Sort order: CanadaCo → Global Ventures → HealthCo LLC → TechCorp
        Test.startTest();
        List<Professional_Directory__c> page1 =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, null, null, null, 2, 0);
        List<Professional_Directory__c> page2 =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, null, null, null, 2, 2);
        Test.stopTest();

        System.assertEquals(2, page1.size(), 'Page 1 should contain 2 records');
        System.assertEquals(2, page2.size(), 'Page 2 should contain 2 records');
        System.assertNotEquals(page1[0].Id, page2[0].Id,
                'Pages must not return the same records');
        // Together they cover all 4 eligible records
        Set<Id> allIds = new Set<Id>{
                page1[0].Id, page1[1].Id, page2[0].Id, page2[1].Id
        };
        System.assertEquals(4, allIds.size(), 'Pages together should cover all 4 records');
    }

    @IsTest
    static void testPagination_nullPageSizeAndOffsetUseDefaults() {
        // null pageSize → default 9; null offset → default 0
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, null, null, null, null, null, null);
        Test.stopTest();

        System.assertEquals(4, results.size(),
                'Null pageSize/offset should fall back to defaults (9/0) and return all 4 records');
    }

    // ─── Combined Filters ────────────────────────────────────────────────────

    @IsTest
    static void testCombinedFilters_allFiltersActive() {
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        'Jane', 'MN', 'Women Owned', 'Healthcare', 'true', 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        'Jane', 'MN', 'Women Owned', 'Healthcare', 'true');
        Test.stopTest();

        System.assertEquals(1, count, 'All combined filters should narrow results to exactly 1');
        System.assertEquals(1, results.size());
        System.assertEquals('HealthCo LLC', results[0].Company_Name__c);
    }

    @IsTest
    static void testCombinedFilters_conflictingFiltersReturnZero() {
        // MN + Canadian Provinces → no overlap → 0 results
        Test.startTest();
        List<Professional_Directory__c> results =
                AlumniBusinessDirectoryController.alumniBusinessDirectory(
                        null, 'All Canadian Provinces', null, 'Healthcare', null, 9, 0);
        Integer count =
                AlumniBusinessDirectoryController.alumniBusinessDirectoryCount(
                        null, 'All Canadian Provinces', null, 'Healthcare', null);
        Test.stopTest();

        System.assertEquals(0, count,
                'Canadian Provinces + Healthcare industry should yield no matches');
        System.assertEquals(0, results.size());
    }
}
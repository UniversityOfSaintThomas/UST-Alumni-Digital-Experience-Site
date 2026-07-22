public without sharing class AlumniBusinessDirectoryController {

    private static final String ALUMNI_BUSINESS_RT = 'Alumni_Business';

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getCompanyIndustryPicklist() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Schema.PicklistEntry entry : Professional_Directory__c.Company_Industry__c.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                options.add(new Map<String, String>{ 'label' => entry.getLabel(), 'value' => entry.getValue() });
            }
        }
        return options;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getCompanySpecialInterestPicklist() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Schema.PicklistEntry entry : Professional_Directory__c.Company_Special_Interests__c.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                options.add(new Map<String, String>{ 'label' => entry.getLabel(), 'value' => entry.getValue() });
            }
        }
        return options;
    }

    // Returns one page of records for the grid.
    @AuraEnabled(Cacheable=true)
    public static List<Professional_Directory__c> alumniBusinessDirectory(
            String searchWordsFilter,
            String stateFilter,
            String interestFilter,
            String industryFilter,
            String discountFilter,
            Integer pageSize,
            Integer offset) {

        Id recTypeId = getRecordTypeId();
        if (recTypeId == null) {
            return new List<Professional_Directory__c>();
        }

        Integer safeSize   = (pageSize != null && pageSize > 0)  ? pageSize : 9;
        Integer safeOffset = (offset   != null && offset   >= 0) ? offset   : 0;

        String soql = 'SELECT Id, First_Name__c, Last_Name__c, Alumni__c,'
                + ' Alumni_Contact_Graduation_Year__c, Alumni__r.Degree_s_Formatted__c,'
                + ' Picture_URL__c, Graduation_Year__c, Record_Type_Name__c,'
                + ' Business_Description__c, Title__c, Company_Name__c, Company_Description__c,'
                + ' Company_Year_Founded__c, Company_Industry__c, Company_Special_Interests__c,'
                + ' Discounts_for_St_Thomas_Community__c, Discount_Description__c, Discount_Code__c,'
                + ' Company_Number_of_Employees__c, Company_Website__c, Company_Email_Address__c,'
                + ' Company_Phone__c, Company_Address_Line_1__c, Company_Address_Line_2__c,'
                + ' Company_City__c, Company_State__c, Company_Zipcode__c, Company_Country__c,'
                + ' Company_Logo_URL__c, Company_Facebook__c, Company_Instagram__c,'
                + ' Company_LinkedIn__c, Company_TikTok__c, Company_X_formerly_Twitter__c'
                + ' FROM Professional_Directory__c'
                + ' WHERE ' + buildWhereClause(recTypeId, searchWordsFilter, stateFilter, interestFilter, industryFilter, discountFilter)
                + ' WITH SECURITY_ENFORCED'
                + ' ORDER BY Company_Name__c NULLS LAST, Last_Name__c, First_Name__c, Id'
                + ' LIMIT '  + safeSize
                + ' OFFSET ' + safeOffset;

        return Database.query(soql);
    }

    // Returns the exact total number of records matching the current filters.
    // Called by the LWC on every load and filter change so the footer can show
    // "Showing X of Y Records" and the Load More button hides when X >= Y.
    @AuraEnabled(Cacheable=true)
    public static Integer alumniBusinessDirectoryCount(
            String searchWordsFilter,
            String stateFilter,
            String interestFilter,
            String industryFilter,
            String discountFilter) {

        Id recTypeId = getRecordTypeId();
        if (recTypeId == null) {
            return 0;
        }

        String soql = 'SELECT COUNT() FROM Professional_Directory__c'
                + ' WHERE ' + buildWhereClause(recTypeId, searchWordsFilter, stateFilter, interestFilter, industryFilter, discountFilter)
                + ' WITH SECURITY_ENFORCED';

        return Database.countQuery(soql);
    }

    private static Id getRecordTypeId() {
        return Schema.SObjectType.Professional_Directory__c
                .getRecordTypeInfosByDeveloperName()
                .get(ALUMNI_BUSINESS_RT)?.getRecordTypeId();
    }

    // Single source of truth for all WHERE conditions.
    // Shared by alumniBusinessDirectory() and alumniBusinessDirectoryCount()
    // so filter logic is never duplicated between the two methods.
    private static String buildWhereClause(
            Id recTypeId,
            String searchWordsFilter,
            String stateFilter,
            String interestFilter,
            String industryFilter,
            String discountFilter) {

        List<String> conditions = new List<String>();
        conditions.add('RecordTypeId = \'' + recTypeId + '\'');
        conditions.add('Alumni__c != NULL');
        conditions.add('Company_Status__c = \'Approved\'');
        conditions.add('UST_Test_Contact__c = FALSE');

        if (String.isNotBlank(stateFilter)) {
            if (stateFilter == 'All United States') {
                conditions.add('Company_State__c IN ('
                        + '\'AA\',\'AE\',\'AK\',\'AL\',\'AP\',\'AR\',\'AS\',\'AZ\','
                        + '\'CA\',\'CO\',\'CT\',\'DC\',\'DE\',\'FL\',\'FM\',\'GA\','
                        + '\'GU\',\'HI\',\'IA\',\'ID\',\'IL\',\'IN\',\'KS\',\'KY\','
                        + '\'LA\',\'MA\',\'MD\',\'ME\',\'MH\',\'MI\',\'MN\',\'MO\','
                        + '\'MP\',\'MS\',\'MT\',\'NC\',\'ND\',\'NE\',\'NH\',\'NJ\','
                        + '\'NM\',\'NV\',\'NY\',\'OH\',\'OK\',\'OR\',\'PA\',\'PR\','
                        + '\'PW\',\'RI\',\'SC\',\'SD\',\'TN\',\'TX\',\'UM\',\'UT\','
                        + '\'VA\',\'VI\',\'VT\',\'WA\',\'WI\',\'WV\',\'WY\')');
            } else if (stateFilter == 'All Canadian Provinces') {
                conditions.add('Company_State__c IN ('
                        + '\'AB\',\'BC\',\'MB\',\'NB\',\'NL\',\'NS\','
                        + '\'NT\',\'NU\',\'ON\',\'PE\',\'QC\',\'SK\',\'YT\')');
            } else if (stateFilter == 'International Only') {
                conditions.add('(Company_State__c NOT IN ('
                        + '\'AA\',\'AE\',\'AK\',\'AL\',\'AP\',\'AR\',\'AS\',\'AZ\','
                        + '\'CA\',\'CO\',\'CT\',\'DC\',\'DE\',\'FL\',\'FM\',\'GA\','
                        + '\'GU\',\'HI\',\'IA\',\'ID\',\'IL\',\'IN\',\'KS\',\'KY\','
                        + '\'LA\',\'MA\',\'MD\',\'ME\',\'MH\',\'MI\',\'MN\',\'MO\','
                        + '\'MP\',\'MS\',\'MT\',\'NC\',\'ND\',\'NE\',\'NH\',\'NJ\','
                        + '\'NM\',\'NV\',\'NY\',\'OH\',\'OK\',\'OR\',\'PA\',\'PR\','
                        + '\'PW\',\'RI\',\'SC\',\'SD\',\'TN\',\'TX\',\'UM\',\'UT\','
                        + '\'VA\',\'VI\',\'VT\',\'WA\',\'WI\',\'WV\',\'WY\','
                        + '\'AB\',\'BC\',\'MB\',\'NB\',\'NL\',\'NS\','
                        + '\'NT\',\'NU\',\'ON\',\'PE\',\'QC\',\'SK\',\'YT\')'
                        + ' OR Company_State__c = NULL)');
            } else {
                conditions.add('Company_State__c = \'' + String.escapeSingleQuotes(stateFilter.trim()) + '\'');
            }
        }
        if (String.isNotBlank(industryFilter)) {
            conditions.add('Company_Industry__c INCLUDES (\'' + String.escapeSingleQuotes(industryFilter.trim()) + '\')');
        }
        if (String.isNotBlank(interestFilter)) {
            conditions.add('Company_Special_Interests__c INCLUDES (\'' + String.escapeSingleQuotes(interestFilter.trim()) + '\')');
        }
        if (discountFilter == 'true') {
            conditions.add('Discounts_for_St_Thomas_Community__c = \'Yes\'');
        }

        if (String.isNotBlank(searchWordsFilter)) {
            String rawTerm = searchWordsFilter.trim();
            String likeSafeTerm = rawTerm.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_');
            String term = '%' + String.escapeSingleQuotes(likeSafeTerm) + '%';
            conditions.add('(First_Name__c LIKE \'' + term + '\''
                    + ' OR Last_Name__c LIKE \'' + term + '\''
                    + ' OR Company_Name__c LIKE \'' + term + '\''
                    + ' OR Company_Description__c LIKE \'' + term + '\')');
        }

        return String.join(conditions, ' AND ');
    }
}
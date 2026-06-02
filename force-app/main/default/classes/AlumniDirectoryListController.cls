/**
 * Created by dahl3702 on 6/11/2019.
 */

public with sharing class AlumniDirectoryListController {


    @TestVisible public class alumniDirectory {
        @AuraEnabled @TestVisible
        public String key { get; set; }
        @AuraEnabled
        public String Name { get; set; }
        @AuraEnabled
        public String classYear { get; set; }
        @AuraEnabled
        public String previousLastName { get; set; }
        @AuraEnabled
        public String employer { get; set; }
        @AuraEnabled
        public String cityState { get; set; }
        @AuraEnabled
        public Integer queryCount { get; set; }
    }

    @AuraEnabled (cacheable = true)
    public static List<alumniDirectory> getAlumniDirectory(Integer pagenumber, Integer numberOfRecords, Integer pageSize, String searchString, String classYearString) {
        List<alumniDirectory> directoryOut = new List<alumniDirectory>();
        List<Alumni_Directory__c> directoryIn = new List<Alumni_Directory__c>();
        Integer queryCountIn = getAlumniCount(searchString, classYearString);
        if (queryCountIn > 0) {
            directoryIn = getAlumniList(pagenumber, numberOfRecords, pageSize, searchString, classYearString);
            for (Alumni_Directory__c ad : directoryIn) {
                alumniDirectory dirItem = new alumniDirectory();
                dirItem.key = ad.Id;
                dirItem.queryCount = queryCountIn;
                dirItem.Name = '';
                dirItem.classYear = '';
                dirItem.previousLastName = '';
                dirItem.employer = '';
                dirItem.cityState = '';
                if (String.isNotBlank(ad.Name)) {
                    dirItem.Name = ad.Name;
                }

                If (string.isNotBlank(ad.Class_Year_Text__c)) {
                    dirItem.classYear = ad.Class_Year_Text__c;
                }

                If (string.isNotBlank(ad.Student_Last_Name_Text__c)) {
                    dirItem.previousLastName = ad.Student_Last_Name_Text__c;
                }

                If (String.isNotBlank(ad.Employer_Text__c)) {
                    dirItem.employer = ad.Employer_Text__c;
                }

                If (String.isNotBlank(ad.City_State__c)) {
                    dirItem.cityState = ad.City_State__c;
                }

                directoryOut.add(dirItem);
            }
        }
        return directoryOut;
    }

    private static List<Alumni_Directory__c> getAlumniList(Integer pagenumber, Integer numberOfRecords, Integer pageSize, String searchString, String classYearString) {
        List<Alumni_Directory__c> alumniList = new List<Alumni_Directory__c>();
        if (String.isNotBlank(searchString) || String.isNotBlank(classYearString) && numberOfRecords > 0) {
            String whereString = generateWhere(searchString, classYearString);
            String query = ' SELECT Id, Name, First_Name_Text__c, Last_Name_Text__c, Class_Year_Text__c, Student_Last_Name_Text__c, City_State__c, Employer_Text__c ';
            query += ' FROM Alumni_Directory__c ';
            query += ' WHERE ' + whereString;
            query += ' ORDER BY Last_Name_Text__c, First_Name_Text__c';
            query += ' LIMIT ' + pageSize;

            if (pagenumber < 0) {
                pagenumber = 1;
            }
            if ((pageSize * (pagenumber - 1)) > 0) {
                query += ' OFFSET ' + (pageSize * (pagenumber - 1));
            }

            System.debug(query);
            if (String.isNotBlank(whereString)) {
                alumniList = database.query(query);
            }

        }
        return alumniList;
    }

    private static Integer getAlumniCount(String searchString, String classYearString) {
        Integer alumniCount = 0;
        if (String.isNotBlank(searchString) || String.isNotBlank(classYearString)) {
            String whereString = generateWhere(searchString, classYearString);
            String query = ' SELECT Count() ';
            query += ' FROM Alumni_Directory__c ';
            query += ' WHERE ' + whereString;
            if (String.isNotBlank(whereString)) {
                alumniCount = database.countQuery(query);
            }
            return alumniCount;
        }
        return 0;
    }

    private static String generateWhere(String search, String classYearString) {
        String whereOut = '';

        if (String.isNotBlank(search)) {
            search = search.escapeEcmaScript();
            String[] searchFrag = new List<String>();
            //Check for Mr. Mrs. Dr. at the beginning of string and record it.
            String prefix = '';
            Pattern MyPattern = Pattern.compile('^Mr\\.|^Mrs\\.|^Ms\\.|^Dr\\.');
            Matcher MyMatcher = MyPattern.matcher(search);
            Boolean suffixFound = MyMatcher.find();
            if (suffixFound) {
                prefix = search.substring(0, search.indexOf('.') + 2).trim() + ' ';
                search = search.substring(search.indexOf('.') + 2, search.length());
            }

            //Remove all punctuation
            //search = search.replaceAll('[^a-zA-Z0-9 ]', '');
            //remove all double spaces
            search = search.replaceAll('\\s+ ', ' ');
            search = search.trim();
            //split search terms into words
            for (String frag : search.split(' ')) {
                searchFrag.add(frag);
            }
            //Get size of word array
            Integer fragSize = searchFrag.size();
            //Start WHERE query
            whereOut += ' (';
            if (fragSize == 1) {
                whereOut += ' First_Name_Text__c LIKE \'' + search + '%\' ';
                whereOut += ' OR Last_Name_Text__c LIKE \'' + search + '%\' ';
                whereOut += ' OR Student_Last_Name_Text__c LIKE \'' + search + '%\' ';
                whereOut += ' OR Name LIKE \'' + prefix + search + '%\' ';
            } else if (fragSize == 2) {
                whereOut += ' (First_Name_Text__c LIKE \'' + searchFrag[0] + '%\' AND ( Last_Name_Text__c LIKE \'' + searchFrag[1] + '%\' OR Student_Last_Name_Text__c LIKE \'' + searchFrag[1] + '%\')) ';
                whereOut += ' OR (First_Name_Text__c LIKE \'' + searchFrag[1] + '%\' AND ( Last_Name_Text__c LIKE \'' + searchFrag[0] + '%\' OR Student_Last_Name_Text__c LIKE \'' + searchFrag[0] + '%\')) ';
                whereOut += ' OR Name LIKE \'' + prefix + searchFrag[0] + ' ' + searchFrag[1] + '%\' ';
                whereOut += ' OR Name LIKE \'' + prefix + searchFrag[1] + ' ' + searchFrag[0] + '%\' ';
            } else if (fragSize >= 3) {
                fragSize--;
                whereOut += ' (First_Name_Text__c LIKE \'' + searchFrag[0] + '%\' AND (Last_Name_Text__c LIKE \'' + searchFrag[fragSize] + '%\' OR Student_Last_Name_Text__c LIKE \'' + searchFrag[fragSize] + '%\')) ';
                whereOut += ' OR (First_Name_Text__c LIKE \'' + searchFrag[fragSize] + '%\' AND ( Last_Name_Text__c LIKE \'' + searchFrag[0] + '%\' OR Student_Last_Name_Text__c LIKE \'' + searchFrag[0] + '%\')) ';
                whereOut += ' OR Name LIKE \'' + prefix + searchFrag[0] + ' ' + searchFrag[fragSize] + '%\' ';
                whereOut += ' OR Name LIKE \'' + prefix + searchFrag[fragSize] + ' ' + searchFrag[0] + '%\' ';
            }
            whereOut += ' OR Employer_Text__c LIKE \'%' + search + '%\' ';
            whereOut += ' OR City_State__c LIKE \'%' + search + '%\' ';
            whereOut += ' ) ';

            if (String.isNotBlank(classYearString)) {
                whereOut += ' AND Class_Year_Text__c = \'' + classYearString + '\' ';
            }
        }
        if (String.isNotBlank(classYearString) && String.isBlank(search)) {
            whereOut = ' Class_Year_Text__c = \'' + classYearString + '\' ';
        }
        System.debug(whereOut);
        return whereOut;
    }
}
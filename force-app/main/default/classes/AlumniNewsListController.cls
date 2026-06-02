/**
 * Created by dahl3702 on 6/20/2019.
 */

public without sharing class AlumniNewsListController {

    @TestVisible public class alumniNews {
        @AuraEnabled @TestVisible
        public String key { get; set; }
        @AuraEnabled
        public String Name { get; set; }
        @AuraEnabled
        public String classYear { get; set; }
        @AuraEnabled
        public String detailLink { get; set; }
        @AuraEnabled
        public String newsItem { get; set; }
        @AuraEnabled
        public Date newsDate { get; set; }
        @AuraEnabled
        public String category { get; set; }
        @AuraEnabled
        public Integer queryCount { get; set; }
        @AuraEnabled
        public Id adId { get; set; }
    }


    @AuraEnabled (cacheable = true)
    public static List<alumniNews> getNews(Integer pagenumber, Integer pageSize, String searchString, String classYearString) {
        List<alumniNews> newsOut = new List<alumniNews>();
        List<Alumni_News__c> newsIn = new List<Alumni_News__c>();
        Integer queryCountIn = getAlumniNewsCount(searchString, classYearString);
        if (queryCountIn > 0) {
            newsIn = getAlumniNewsList(pagenumber, pageSize, searchString, classYearString);
            for (Alumni_News__c an : newsIn) {
                AlumniNews newsItem = new AlumniNews();
                newsItem.queryCount = queryCountIn;
                newsItem.key = an.Id;
                newsItem.adId = null;
                if (String.isNotBlank(an.Contact__r.Name)) {
                    newsItem.Name = an.Contact__r.Name;
                } else if (String.isNotBlank(an.Contact__r.firstName)) {
                    if (String.isNotBlank(an.Contact__r.lastName)) {
                        newsItem.Name = an.Contact__r.firstName + ' ' + an.Contact__r.lastName;
                    }
                } else {
                    newsItem.Name = '';
                }

                if (String.isNotBlank(an.Details_Link__c)) {
                    newsItem.detailLink = an.Details_Link__c;
                } else {
                    newsItem.detailLink = '';
                }

                if (String.isNotBlank(an.Alumni_News__c)) {
                    newsItem.newsItem = an.Alumni_News__c;
                } else {
                    newsItem.newsItem = '';
                }

                if (an.News_Date__c != null) {
                    newsItem.newsDate = an.News_Date__c;
                } else {
                    newsItem.newsDate = Date.today();
                }

                if (String.isNotBlank(an.Category__c)) {
                    newsItem.category = an.Category__c;
                } else {
                    newsItem.category = 'Unknown';
                }

                if (String.isNotBlank(an.Contact__r.Preferred_Class_Year__c)) {
                    newsItem.classYear = an.Contact__r.Preferred_Class_Year__c;
                } else {
                    newsItem.classYear = '----';
                }

                if (String.isNotBlank(an.Alumni_Directory__c)) {
                    newsItem.adId = an.Alumni_Directory__c;
                }

                newsOut.add(newsItem);
            }
        }
        return newsOut;
    }

    private static List<Alumni_News__c> getAlumniNewsList(Integer pagenumber, Integer pageSize, String searchString, String classYearString) {
        List<Alumni_News__c> alumniNewsList = new List<Alumni_News__c>();


        if (pagenumber == null || pagenumber == 0) {
            pagenumber = 1;
        }
        String query = ' SELECT Id, Contact__r.Id, Contact__r.FirstName, Contact__r.LastName, Contact__r.Preferred_Class_Year__c, Contact__r.Previous_Last_Name__c, Contact__r.MailingCity, ';
        query += ' Contact__r.Preferred_First_Name__c, Contact__r.MailingState, Contact__r.Name, Contact__r.Employer__c, Contact__r.Job_Title__c, ';
        query += ' Alumni_Directory__c, Category__c, Alumni_News__c, Details_Link__c, News_Source__c, Image__c, External_Link__c, Reviewed_for_Community_Display__c, News_Date__c, Class_Year__c ';
        query += ' FROM Alumni_News__c ';


        query += ' WHERE ' + generateWhere(searchString, classYearString);


        query += ' ORDER BY News_Date__c DESC ';
        query += ' LIMIT ' + pageSize;

        if (pagenumber < 0) {
            pagenumber = 1;
        }
        if ((pageSize * (pagenumber - 1)) > 0) {
            query += ' OFFSET ' + (pageSize * (pagenumber - 1));
        }


        System.debug(query);
        alumniNewsList = database.query(query);
        if (alumniNewsList.size() > 0) {
            return alumniNewsList;
        }
        return null;

    }

    private static Integer getAlumniNewsCount(String searchString, String classYearString) {
        Integer alumniCount = 0;
        String query = ' SELECT count(Name) FROM Alumni_News__c ';
        if (String.isNotBlank(searchString) || String.isNotBlank(classYearString)) {
            query += ' WHERE ' + generateWhere(searchString, classYearString);
        }
        AggregateResult[] AgCount = database.query(query);
        for (AggregateResult ar : agCount) {
            alumniCount = Integer.valueOf(ar.get('expr0'));
        }
        return alumniCount;
    }

    private static String generateWhere(String search, String classYearString) {
        String whereOut = ' Reviewed_for_Community_Display__c = true AND Public_Display__c = True ';

        if (String.isNotBlank(search)) {
            whereOut += ' AND ';
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
            search = search.replaceAll('[^a-zA-Z0-9 ]', '');
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
                whereOut += ' Contact__r.FirstName LIKE \'' + searchFrag[0] + '%\' ';
                whereOut += ' OR Contact__r.LastName LIKE \'%' + searchFrag[0] + '%\' ';
                whereOut += ' OR Contact__r.Name LIKE \'' + prefix + searchFrag[0] + '%\' ';
            } else if (fragSize == 2) {
                whereOut += ' (Contact__r.FirstName LIKE \'' + searchFrag[0] + '%\' AND ( Contact__r.LastName LIKE \'' + searchFrag[1] + '%\' OR Contact__r.Previous_Last_Name__c LIKE \'' + searchFrag[1] + '%\')) ';
                whereOut += ' OR (Contact__r.FirstName LIKE \'' + searchFrag[1] + '%\' AND ( Contact__r.LastName LIKE \'' + searchFrag[0] + '%\' OR Contact__r.Previous_Last_Name__c LIKE \'' + searchFrag[0] + '%\')) ';
                whereOut += ' OR Contact__r.Name LIKE \'' + prefix + searchFrag[0] + ' ' + searchFrag[1] + '%\' ';
                whereOut += ' OR Contact__r.Name LIKE \'' + prefix + searchFrag[1] + ' ' + searchFrag[0] + '%\' ';
            } else if (fragSize >= 3) {
                fragSize--;
                whereOut += ' (Contact__r.FirstName LIKE \'' + searchFrag[0] + '%\' AND (Contact__r.LastName LIKE \'' + searchFrag[fragSize] + '%\' OR Contact__r.Previous_Last_Name__c LIKE \'' + searchFrag[fragSize] + '%\')) ';
                whereOut += ' OR (Contact__r.FirstName LIKE \'' + searchFrag[fragSize] + '%\' AND ( Contact__r.LastName LIKE \'' + searchFrag[0] + '%\' OR Contact__r.Previous_Last_Name__c LIKE \'' + searchFrag[0] + '%\')) ';
                whereOut += ' OR Contact__r.Name LIKE \'' + prefix + searchFrag[0] + ' ' + searchFrag[fragSize] + '%\' ';
                whereOut += ' OR Contact__r.Name LIKE \'' + prefix + searchFrag[fragSize] + ' ' + searchFrag[0] + '%\' ';
            }
            whereOut += ' OR Contact__r.Employer__c LIKE \'%' + search + '%\' ';
            whereOut += ' OR Contact__r.Community_Address_Range__c LIKE \'%' + search + '%\' ';
            whereOut += ' OR Category__c LIKE \'%' + search + '%\' ';
            whereOut += ' ) ';

            if (String.isNotBlank(classYearString)) {
                whereOut += ' AND Contact__r.Preferred_Class_Year__c = \'' + classYearString + '\' ';
            }
        }
        if (String.isNotBlank(classYearString) && String.isBlank(search)) {
            whereOut += ' AND Contact__r.Preferred_Class_Year__c = \'' + classYearString + '\' ';
        }
        System.debug(whereOut);
        return whereOut;
    }
}
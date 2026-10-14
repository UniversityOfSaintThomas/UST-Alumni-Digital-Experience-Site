/**
 * Created by dahl3702 on 7/10/2019.
 */

@IsTest
private class TestAlumniNewsListController {

    @IsTest static void testNewsListing() {
        //Generate some Data
        List<TestAlumniCommunityDataFactory.testDataIds> testIds = TestAlumniCommunityDataFactory.createTestDATA(1);

        Test.startTest();
        //Test list with no parameters other than start page and record count
        AlumniNewsListController.getNews(1, 10, '', '');
        //Pass in null for start page to set itself to 1
        AlumniNewsListController.getNews(null, 10, '', '');
        //Test with one word query and no year
        AlumniNewsListController.getNews(1, 10, 'Hello', '');
        //Test with two word query and no year
        AlumniNewsListController.getNews(1, 10, 'Hello Kitty', '');
        //Test with three word query with period in the mix and no year
        AlumniNewsListController.getNews(1, 10, 'Mr. Hello Kitty', '');
        //Test with straight up 3 word query
        AlumniNewsListController.getNews(1, 10, 'Hello Kitty Dog', '');
        //Test with two word query and date
        AlumniNewsListController.getNews(1, 10, 'Hello Kitty', '2001');
        //Test with only date
        AlumniNewsListController.getNews(1, 10, '', '2001');
        //Test with no result query - not in test data
        AlumniNewsListController.getNews(1, 10, 'Not InData', '');
        //Test with no result query no date in test data
        AlumniNewsListController.getNews(1, 10, '', '2100');
        Test.stopTest();
    }
}
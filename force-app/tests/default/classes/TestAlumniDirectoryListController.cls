/**
 * Created by dahl3702 on 7/10/2019.
 */

@IsTest
private class  TestAlumniDirectoryListController {

    @IsTest static void testDirectoryListing() {
        //Generate some Data
        List<TestAlumniCommunityDataFactory.testDataIds> testIds = TestAlumniCommunityDataFactory.createTestDATA(1);

        Test.startTest();
        //getAlumniDirectory(Integer pagenumber, Integer numberOfRecords, Integer pageSize, String searchString, String classYearString)
        //Test with no query but page number and size
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'','');
        //Test with one work query
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'Hello','');
        //Test with two word query
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'Hello Kitty','');
        //Test with three word query with a period in the mix
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'Mr. Hello Kitty','');
        //Test with three word query
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'Hello Kitty Dog','');
        //Test with two word query and year
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'Hello Kitty','2001');
        //Test with no word query but year
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'','2001');
        //Test with query that isn't in the test data
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'Not inData','');
        AlumniDirectoryListController.getAlumniDirectory(1,10,10,'Not inData','2100');
        Test.stopTest();
    }
}
import { createElement } from 'lwc';
import AlumniBusinessDirectory from 'c/alumniBusinessDirectory';
import getCompanyIndustryPicklist from '@salesforce/apex/AlumniBusinessDirectoryController.getCompanyIndustryPicklist';
import getCompanySpecialInterestPicklist from '@salesforce/apex/AlumniBusinessDirectoryController.getCompanySpecialInterestPicklist';
import alumniBusinessDirectory from '@salesforce/apex/AlumniBusinessDirectoryController.alumniBusinessDirectory';
import alumniBusinessDirectoryCount from '@salesforce/apex/AlumniBusinessDirectoryController.alumniBusinessDirectoryCount';

jest.mock(
  '@salesforce/apex/AlumniBusinessDirectoryController.getCompanyIndustryPicklist',
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  '@salesforce/apex/AlumniBusinessDirectoryController.getCompanySpecialInterestPicklist',
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  '@salesforce/apex/AlumniBusinessDirectoryController.alumniBusinessDirectory',
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  '@salesforce/apex/AlumniBusinessDirectoryController.alumniBusinessDirectoryCount',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

// The component loads an external stylesheet from static.aws.stthomas.edu via
// lightning/platformResourceLoader on connectedCallback - not relevant to this test and not
// available in the jest environment, so it's mocked out.
jest.mock(
  'lightning/platformResourceLoader',
  () => ({ loadStyle: jest.fn(() => Promise.resolve()) }),
  { virtual: true }
);

function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

const SAMPLE_RECORD = {
  Id: 'a0C000000000001',
  First_Name__c: 'Robert',
  Last_Name__c: 'Smith',
  Alumni__c: 'a0C000000000099',
  Alumni_Contact_Graduation_Year__c: '2010',
  Graduation_Year__c: '2010',
  Company_Name__c: 'Acme Co',
  Company_City__c: 'St. Paul',
  Company_State__c: 'MN',
  Company_Description__c: 'A widget company',
  Company_Industry__c: 'Manufacturing',
  Company_Special_Interests__c: '',
  Discounts_for_St_Thomas_Community__c: 'No',
  Company_Logo_URL__c: '',
  Picture_URL__c: ''
};

describe('c-alumni-business-directory favorite toggle', () => {
  beforeEach(() => {
    getCompanyIndustryPicklist.mockResolvedValue([]);
    getCompanySpecialInterestPicklist.mockResolvedValue([]);
    alumniBusinessDirectoryCount.mockResolvedValue(1);
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it('renders one c-ust-favorite-toggle per business card, targeting Professional_Directory with that card\'s Id', async () => {
    alumniBusinessDirectory.mockResolvedValue([SAMPLE_RECORD]);

    const element = createElement('c-alumni-business-directory', { is: AlumniBusinessDirectory });
    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    const toggles = element.shadowRoot.querySelectorAll('c-ust-favorite-toggle');
    expect(toggles.length).toBe(1);
    expect(toggles[0].targetType).toBe('Professional_Directory');
    expect(toggles[0].targetRecordId).toBe('a0C000000000001');
  });

  it('does not open the record modal when the favorite toggle wrapper is clicked', async () => {
    alumniBusinessDirectory.mockResolvedValue([SAMPLE_RECORD]);

    const element = createElement('c-alumni-business-directory', { is: AlumniBusinessDirectory });
    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    const toggleWrapper = element.shadowRoot.querySelector('.favorite-toggle-container');
    toggleWrapper.dispatchEvent(new CustomEvent('click', { bubbles: true }));
    await flushPromises();

    const modal = element.shadowRoot.querySelector('.selected-record-modal');
    expect(modal.classList.contains('slds-fade-in-open')).toBe(false);
  });
});

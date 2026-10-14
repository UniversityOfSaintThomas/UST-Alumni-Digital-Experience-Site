import { createElement } from 'lwc';
import { resolveProfileNavigation } from 'c/alumniDirectoryList';
import AlumniDirectoryList from 'c/alumniDirectoryList';
import getAlumniDirectory from '@salesforce/apex/AlumniDirectoryListController.getAlumniDirectory';

jest.mock(
  '@salesforce/apex/AlumniDirectoryListController.getAlumniDirectory',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

// Verifies the old-vs-new routing decision directly against the exported
// pure function. Testing this via a simulated click and asserting on
// NavigationMixin.Navigate isn't possible in this jest environment: LWC
// freezes the NavigationMixin prototype, so the [Navigate] method can't be
// spied on or overridden from a test.
describe('c-alumni-directory-list resolveProfileNavigation', () => {
  it('resolves to the legacy standard record page when useNewProfileLink is false', () => {
    expect(resolveProfileNavigation(false, 'a0B000000000001')).toEqual({
      type: 'standard__recordPage',
      attributes: {
        actionName: 'view',
        recordId: 'a0B000000000001'
      }
    });
  });

  it('resolves to the new Alumni Profile page when useNewProfileLink is true', () => {
    expect(resolveProfileNavigation(true, 'a0B000000000001')).toEqual({
      type: 'comm__namedPage',
      attributes: {
        name: 'my_account__c'
      },
      state: {
        id: 'a0B000000000001'
      }
    });
  });
});

describe('c-alumni-directory-list favorite toggle', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it('renders one c-ust-favorite-toggle per row, targeting Alumni_Directory with that row\'s Id', async () => {
    getAlumniDirectory.mockResolvedValue([
      {
        key: 'a0B000000000001',
        Name: 'Robert Smith',
        classYear: '2010',
        previousLastName: '',
        employer: 'Acme Co',
        cityState: 'St. Paul, MN',
        queryCount: 2
      },
      {
        key: 'a0B000000000002',
        Name: 'Jane Doe',
        classYear: '2012',
        previousLastName: '',
        employer: 'Widgets Inc',
        cityState: 'Minneapolis, MN',
        queryCount: 2
      }
    ]);

    const element = createElement('c-alumni-directory-list', { is: AlumniDirectoryList });
    element.pagesize = 10;
    document.body.appendChild(element);
    element.currentpage = 1;
    await flushPromises();

    // Drives the real search input change event (rather than setting the private
    // searchKey field directly) so this exercises the same path a user's keystroke does.
    const searchInput = element.shadowRoot.querySelectorAll('lightning-input')[0];
    searchInput.value = 'Smith';
    searchInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Smith' } }));
    await flushPromises();
    await flushPromises();

    expect(getAlumniDirectory).toHaveBeenCalled();

    const toggles = element.shadowRoot.querySelectorAll('c-ust-favorite-toggle');
    expect(toggles.length).toBe(2);
    expect(toggles[0].targetType).toBe('Alumni_Directory');
    expect(toggles[0].targetRecordId).toBe('a0B000000000001');
    expect(toggles[1].targetType).toBe('Alumni_Directory');
    expect(toggles[1].targetRecordId).toBe('a0B000000000002');
  });
});

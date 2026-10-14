import { createElement } from 'lwc';
import { resolveProfileNavigation } from 'c/alumniNewsList';
import AlumniNewsList from 'c/alumniNewsList';
import getNews from '@salesforce/apex/AlumniNewsListController.getNews';

jest.mock(
  '@salesforce/apex/AlumniNewsListController.getNews',
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
describe('c-alumni-news-list resolveProfileNavigation', () => {
  it('resolves to the legacy standard record page when useNewProfileLink is false', () => {
    expect(resolveProfileNavigation(false, 'a0B000000000002')).toEqual({
      type: 'standard__recordPage',
      attributes: {
        actionName: 'view',
        recordId: 'a0B000000000002'
      }
    });
  });

  it('resolves to the new Alumni Profile page when useNewProfileLink is true', () => {
    expect(resolveProfileNavigation(true, 'a0B000000000002')).toEqual({
      type: 'comm__namedPage',
      attributes: {
        name: 'my_account__c'
      },
      state: {
        id: 'a0B000000000002'
      }
    });
  });
});

describe('c-alumni-news-list favorite toggle', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it('renders a c-ust-favorite-toggle targeting Alumni_Directory for news items that have a linked directory record', async () => {
    getNews.mockResolvedValue([
      {
        key: 'n1',
        adId: 'a0B000000000002',
        Name: 'Jane Doe',
        classYear: '2012',
        detailLink: '',
        newsItem: 'Some news',
        newsDate: '2020-01-01',
        category: 'Career News',
        queryCount: 1
      }
    ]);

    const element = createElement('c-alumni-news-list', { is: AlumniNewsList });
    element.pagesize = 10;
    document.body.appendChild(element);
    element.currentpage = 1;
    await flushPromises();

    const toggles = element.shadowRoot.querySelectorAll('c-ust-favorite-toggle');
    expect(toggles.length).toBe(1);
    expect(toggles[0].targetType).toBe('Alumni_Directory');
    expect(toggles[0].targetRecordId).toBe('a0B000000000002');
  });

  it('does not render a favorite toggle for a news item with no linked directory record', async () => {
    getNews.mockResolvedValue([
      {
        key: 'n2',
        adId: null,
        Name: 'No Directory Link',
        classYear: '----',
        detailLink: '',
        newsItem: 'Some other news',
        newsDate: '2020-01-01',
        category: 'Misc.',
        queryCount: 1
      }
    ]);

    const element = createElement('c-alumni-news-list', { is: AlumniNewsList });
    element.pagesize = 10;
    document.body.appendChild(element);
    element.currentpage = 1;
    await flushPromises();

    const toggles = element.shadowRoot.querySelectorAll('c-ust-favorite-toggle');
    expect(toggles.length).toBe(0);
  });
});

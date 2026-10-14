import { createElement } from 'lwc';
import UstMyFavorites from 'c/ustMyFavorites';
import getMyFavorites from '@salesforce/apex/AlumniFavoriteController.getMyFavorites';

jest.mock(
  '@salesforce/apex/AlumniFavoriteController.getMyFavorites',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

function createFavorites() {
  const element = createElement('c-ust-my-favorites', { is: UstMyFavorites });
  document.body.appendChild(element);
  return element;
}

describe('c-ust-my-favorites', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it('shows the empty state when there are no favorites', async () => {
    getMyFavorites.mockResolvedValue([]);

    const element = createFavorites();
    await flushPromises();

    expect(element.shadowRoot.textContent).toContain("haven't favorited");
    expect(element.shadowRoot.querySelector('h2')).toBeNull();
  });

  it('groups favorites into an Alumni section and a Businesses section', async () => {
    getMyFavorites.mockResolvedValue([
      {
        favoriteId: 'f1',
        targetType: 'Alumni_Directory',
        targetRecordId: 'a0B000000000001',
        title: 'Jane Doe',
        subtitle: '2012',
        isOrphaned: false
      },
      {
        favoriteId: 'f2',
        targetType: 'Professional_Directory',
        targetRecordId: 'a0C000000000001',
        title: 'Acme Co',
        subtitle: 'St. Paul, MN',
        isOrphaned: false
      }
    ]);

    const element = createFavorites();
    await flushPromises();

    const headings = Array.from(element.shadowRoot.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual(["Alumni I'm Following", "Businesses I'm Following"]);

    expect(element.shadowRoot.textContent).toContain('Jane Doe');
    expect(element.shadowRoot.textContent).toContain('Class of 2012');
    expect(element.shadowRoot.textContent).toContain('Acme Co');
    expect(element.shadowRoot.textContent).toContain('St. Paul, MN');
  });

  it('only shows the Alumni section when there are no business favorites', async () => {
    getMyFavorites.mockResolvedValue([
      {
        favoriteId: 'f1',
        targetType: 'Alumni_Directory',
        targetRecordId: 'a0B000000000001',
        title: 'Jane Doe',
        subtitle: '2012',
        isOrphaned: false
      }
    ]);

    const element = createFavorites();
    await flushPromises();

    const headings = Array.from(element.shadowRoot.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual(["Alumni I'm Following"]);
  });

  it('renders a de-emphasized placeholder instead of a title for an orphaned favorite', async () => {
    getMyFavorites.mockResolvedValue([
      {
        favoriteId: 'f1',
        targetType: 'Alumni_Directory',
        targetRecordId: 'a0B000000000099',
        title: null,
        subtitle: null,
        isOrphaned: true
      }
    ]);

    const element = createFavorites();
    await flushPromises();

    expect(element.shadowRoot.textContent).toContain('no longer available');
    expect(element.shadowRoot.querySelector('.orphaned-favorite')).not.toBeNull();
  });

  it('shows an error message and no sections when getMyFavorites fails', async () => {
    getMyFavorites.mockRejectedValue({ body: { message: 'Boom' } });

    const element = createFavorites();
    await flushPromises();

    const errorEl = element.shadowRoot.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('Boom');
    expect(element.shadowRoot.querySelector('h2')).toBeNull();
  });
});

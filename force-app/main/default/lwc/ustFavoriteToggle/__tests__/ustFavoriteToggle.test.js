import { createElement } from 'lwc';
import UstFavoriteToggle from 'c/ustFavoriteToggle';
import isFavorited from '@salesforce/apex/AlumniFavoriteController.isFavorited';
import addFavorite from '@salesforce/apex/AlumniFavoriteController.addFavorite';
import removeFavorite from '@salesforce/apex/AlumniFavoriteController.removeFavorite';

jest.mock(
  '@salesforce/apex/AlumniFavoriteController.isFavorited',
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  '@salesforce/apex/AlumniFavoriteController.addFavorite',
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  '@salesforce/apex/AlumniFavoriteController.removeFavorite',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

function createToggle(targetType = 'Alumni_Directory', targetRecordId = 'a0B000000000001') {
  const element = createElement('c-ust-favorite-toggle', { is: UstFavoriteToggle });
  element.targetType = targetType;
  element.targetRecordId = targetRecordId;
  document.body.appendChild(element);
  return element;
}

function getButton(element) {
  return element.shadowRoot.querySelector('lightning-button-icon');
}

describe('c-ust-favorite-toggle', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it('renders the unfavorited state when isFavorited resolves false', async () => {
    isFavorited.mockResolvedValue(false);

    const element = createToggle();
    await flushPromises();

    expect(isFavorited).toHaveBeenCalledWith({
      targetType: 'Alumni_Directory',
      targetRecordId: 'a0B000000000001'
    });
    expect(getButton(element).iconName).toBe('utility:add');
    expect(getButton(element).title).toBe('Add to favorites');
  });

  it('renders the favorited state when isFavorited resolves true', async () => {
    isFavorited.mockResolvedValue(true);

    const element = createToggle();
    await flushPromises();

    expect(getButton(element).iconName).toBe('utility:favorite');
    expect(getButton(element).title).toBe('Remove from favorites');
  });

  it('calls addFavorite and flips to favorited when toggled from the unfavorited state', async () => {
    isFavorited.mockResolvedValue(false);
    addFavorite.mockResolvedValue();

    const element = createToggle();
    await flushPromises();

    getButton(element).click();
    await flushPromises();

    expect(addFavorite).toHaveBeenCalledWith({
      targetType: 'Alumni_Directory',
      targetRecordId: 'a0B000000000001'
    });
    expect(removeFavorite).not.toHaveBeenCalled();
    expect(getButton(element).iconName).toBe('utility:favorite');
  });

  it('calls removeFavorite and flips to unfavorited when toggled from the favorited state', async () => {
    isFavorited.mockResolvedValue(true);
    removeFavorite.mockResolvedValue();

    const element = createToggle();
    await flushPromises();

    getButton(element).click();
    await flushPromises();

    expect(removeFavorite).toHaveBeenCalledWith({
      targetType: 'Alumni_Directory',
      targetRecordId: 'a0B000000000001'
    });
    expect(addFavorite).not.toHaveBeenCalled();
    expect(getButton(element).iconName).toBe('utility:add');
  });

  it('dispatches a favoritechange event with the new state after a successful toggle', async () => {
    isFavorited.mockResolvedValue(false);
    addFavorite.mockResolvedValue();

    const element = createToggle();
    await flushPromises();

    const handler = jest.fn();
    element.addEventListener('favoritechange', handler);

    getButton(element).click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      targetType: 'Alumni_Directory',
      targetRecordId: 'a0B000000000001',
      isFavorited: true
    });
  });

  it('rolls back to the previous state and shows an error when addFavorite fails', async () => {
    isFavorited.mockResolvedValue(false);
    addFavorite.mockRejectedValue({ body: { message: 'Boom' } });

    const element = createToggle();
    await flushPromises();

    getButton(element).click();
    await flushPromises();

    expect(getButton(element).iconName).toBe('utility:add');
    const errorEl = element.shadowRoot.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('Boom');
  });

  it('rolls back to the previous state and shows an error when removeFavorite fails', async () => {
    isFavorited.mockResolvedValue(true);
    removeFavorite.mockRejectedValue({ body: { message: 'Nope' } });

    const element = createToggle();
    await flushPromises();

    getButton(element).click();
    await flushPromises();

    expect(getButton(element).iconName).toBe('utility:favorite');
    const errorEl = element.shadowRoot.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('Nope');
  });

  it('shows an error and stays unfavorited when the initial isFavorited call fails', async () => {
    isFavorited.mockRejectedValue({ body: { message: 'Load failed' } });

    const element = createToggle();
    await flushPromises();

    expect(getButton(element).iconName).toBe('utility:add');
    const errorEl = element.shadowRoot.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('Load failed');
  });

  it('does not call the Apex service and disables the button when required props are missing', async () => {
    const element = createElement('c-ust-favorite-toggle', { is: UstFavoriteToggle });
    document.body.appendChild(element);
    await flushPromises();

    expect(isFavorited).not.toHaveBeenCalled();
    expect(getButton(element).disabled).toBe(true);
  });
});

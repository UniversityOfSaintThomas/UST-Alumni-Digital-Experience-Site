import { createElement } from 'lwc';
import UstAlumniConnectionProfile from 'c/ustAlumniConnectionProfile';
import getConnectedProfile from '@salesforce/apex/AlumniConnectionsController.getConnectedProfile';

jest.mock(
  '@salesforce/apex/AlumniConnectionsController.getConnectedProfile',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  '@salesforce/messageChannel/AlumniSelection__c',
  () => ({ default: 'AlumniSelection__c' }),
  { virtual: true }
);

// lightning/messageService's subscribe/unsubscribe are mocked manually here (rather than
// via @salesforce/sfdx-lwc-jest's own message-service mock) so the test can directly invoke
// the same listener callback the component registered, simulating a publish from another
// widget on the page without needing a second real component instance.
let capturedListener;

jest.mock('lightning/messageService', () => {
  const { createTestWireAdapter: createAdapter } = jest.requireActual('@salesforce/sfdx-lwc-jest');
  return {
    MessageContext: createAdapter(),
    subscribe: jest.fn((context, channel, listener) => {
      capturedListener = listener;
      return { channel };
    }),
    unsubscribe: jest.fn()
  };
});

function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

function publishSelection(payload) {
  capturedListener(payload);
  return flushPromises();
}

const BASE_PROFILE = {
  hasProfile: true,
  alumniDirectoryId: 'a0B000000000001',
  firstNameText: 'Robert',
  nickname: '',
  lastNameText: 'Smith',
  studentLastNameText: 'Smith',
  classYearText: '2010',
  stThomasDegreeText: 'B.A.',
  cityState: 'St. Paul, MN',
  occupationText: 'Engineer',
  employerText: 'Acme Co',
  newsItems: [],
  businessListings: []
};

describe('c-ust-alumni-connection-profile', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    capturedListener = undefined;
  });

  it('shows the prompt state before any alumnus is selected', async () => {
    const element = createElement('c-ust-alumni-connection-profile', { is: UstAlumniConnectionProfile });
    document.body.appendChild(element);
    await flushPromises();

    expect(element.shadowRoot.textContent).toContain('Select an alum');
    expect(getConnectedProfile).not.toHaveBeenCalled();
  });

  it('loads and renders the connected profile after a selection message arrives', async () => {
    getConnectedProfile.mockResolvedValue({
      ...BASE_PROFILE,
      newsItems: [{ Id: 'n1', Category__c: 'Career News', Alumni_News__c: 'Got a new job' }],
      businessListings: [
        { Id: 'p1', Company_Name__c: 'Acme Co', Title__c: 'CEO', Company_City__c: 'St. Paul', Company_State__c: 'MN', Company_Website__c: '' }
      ]
    });

    const element = createElement('c-ust-alumni-connection-profile', { is: UstAlumniConnectionProfile });
    document.body.appendChild(element);
    await flushPromises();

    await publishSelection({ contactId: '003000000000001' });

    expect(getConnectedProfile).toHaveBeenCalledWith({ contactId: '003000000000001' });
    expect(element.shadowRoot.textContent).toContain('Robert');
    expect(element.shadowRoot.textContent).toContain('Smith');

    // lightning-formatted-rich-text is a stubbed base component in the jest environment -
    // its value prop is not reflected into textContent, so assert on the property directly
    // (same pattern as the lightning-button label gotcha documented in AGENTS.md).
    const newsRichText = element.shadowRoot.querySelector('lightning-formatted-rich-text');
    expect(newsRichText.value).toBe('Got a new job');
    expect(element.shadowRoot.textContent).toContain('Acme Co');

    const toggles = element.shadowRoot.querySelectorAll('c-ust-favorite-toggle');
    expect(toggles.length).toBe(2);
    expect(toggles[0].targetType).toBe('Alumni_Directory');
    expect(toggles[0].targetRecordId).toBe('a0B000000000001');
    expect(toggles[1].targetType).toBe('Professional_Directory');
    expect(toggles[1].targetRecordId).toBe('p1');
  });

  it('shows the empty state when the selected contact has no public profile', async () => {
    getConnectedProfile.mockResolvedValue({ hasProfile: false, newsItems: [], businessListings: [] });

    const element = createElement('c-ust-alumni-connection-profile', { is: UstAlumniConnectionProfile });
    document.body.appendChild(element);
    await flushPromises();

    await publishSelection({ contactId: '003000000000099' });

    expect(element.shadowRoot.textContent).toContain('No public alumni profile is available');
  });

  it('shows an error message when getConnectedProfile fails', async () => {
    getConnectedProfile.mockRejectedValue({ body: { message: 'Boom' } });

    const element = createElement('c-ust-alumni-connection-profile', { is: UstAlumniConnectionProfile });
    document.body.appendChild(element);
    await flushPromises();

    await publishSelection({ contactId: '003000000000001' });

    const errorEl = element.shadowRoot.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('Boom');
  });

  it('re-queries when a second selection message arrives for a different contact', async () => {
    getConnectedProfile.mockResolvedValueOnce({ ...BASE_PROFILE, firstNameText: 'Robert' });
    getConnectedProfile.mockResolvedValueOnce({ ...BASE_PROFILE, firstNameText: 'Jane' });

    const element = createElement('c-ust-alumni-connection-profile', { is: UstAlumniConnectionProfile });
    document.body.appendChild(element);
    await flushPromises();

    await publishSelection({ contactId: '003000000000001' });
    expect(element.shadowRoot.textContent).toContain('Robert');

    await publishSelection({ contactId: '003000000000002' });
    expect(element.shadowRoot.textContent).toContain('Jane');
    expect(getConnectedProfile).toHaveBeenCalledTimes(2);
  });
});

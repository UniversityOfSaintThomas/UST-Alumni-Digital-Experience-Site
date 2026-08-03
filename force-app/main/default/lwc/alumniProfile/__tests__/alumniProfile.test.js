import { createElement } from 'lwc';
import AlumniProfile from 'c/alumniProfile';
import getMyProfile from '@salesforce/apex/AlumniProfileController.getMyProfile';
import saveMyProfile from '@salesforce/apex/AlumniProfileController.saveMyProfile';

jest.mock(
  '@salesforce/apex/AlumniProfileController.getMyProfile',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  '@salesforce/apex/AlumniProfileController.saveMyProfile',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

function findButtonByLabel(element, label) {
  return (
    Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find(
      (button) => button.label === label
    ) || null
  );
}

const BASE_PROFILE = {
  hasRecord: true,
  canEdit: false,
  recordId: 'a0B000000000001',
  firstNameText: 'Robert',
  nickname: '',
  lastNameText: 'Smith',
  studentLastNameText: 'Smith',
  classYearText: '2010',
  stThomasDegreeText: 'B.A.',
  cityState: 'St. Paul, MN',
  occupationText: 'Engineer',
  employerText: 'Acme Co',
  businessDirectoryRecords: []
};

describe('c-alumni-profile', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it('shows the nickname in place of the first name when a nickname is set', async () => {
    getMyProfile.mockResolvedValue({ ...BASE_PROFILE, nickname: 'Bob' });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    const heading = element.shadowRoot.querySelector('h1');
    expect(heading.textContent).toContain('Bob');
    expect(heading.textContent).not.toContain('Robert');
  });

  it('falls back to the first name when no nickname is set', async () => {
    getMyProfile.mockResolvedValue({ ...BASE_PROFILE, nickname: '' });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    const heading = element.shadowRoot.querySelector('h1');
    expect(heading.textContent).toContain('Robert');
  });

  it('shows the student last name in parentheses when it differs from the last name', async () => {
    getMyProfile.mockResolvedValue({
      ...BASE_PROFILE,
      lastNameText: 'Smith',
      studentLastNameText: 'Jones'
    });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    const heading = element.shadowRoot.querySelector('h1');
    expect(heading.textContent).toContain('Smith (Jones)');
  });

  it('omits the parenthetical when the student last name matches the last name', async () => {
    getMyProfile.mockResolvedValue({
      ...BASE_PROFILE,
      lastNameText: 'Smith',
      studentLastNameText: 'Smith'
    });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    const heading = element.shadowRoot.querySelector('h1');
    expect(heading.textContent).not.toContain('(');
  });

  it('shows the Edit button only when canEdit is true', async () => {
    getMyProfile.mockResolvedValue({ ...BASE_PROFILE, canEdit: true });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    const editButton = findButtonByLabel(element, 'Edit');
    expect(editButton).not.toBeNull();
  });

  it('hides the Edit button and any editable inputs when canEdit is false', async () => {
    getMyProfile.mockResolvedValue({ ...BASE_PROFILE, canEdit: false });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    const editButton = findButtonByLabel(element, 'Edit');
    const inputs = element.shadowRoot.querySelectorAll('lightning-input');
    expect(editButton).toBeNull();
    expect(inputs.length).toBe(0);
  });

  it('saves the edited values and returns to display mode on Save', async () => {
    getMyProfile.mockResolvedValue({ ...BASE_PROFILE, canEdit: true });
    saveMyProfile.mockResolvedValue({ ...BASE_PROFILE, canEdit: true, nickname: 'Bobby' });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    findButtonByLabel(element, 'Edit').click();
    await flushPromises();

    const nicknameInput = element.shadowRoot.querySelector('lightning-input[data-field="draftNickname"]');
    nicknameInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Bobby' } }));

    findButtonByLabel(element, 'Save').click();
    await flushPromises();

    expect(saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ recordId: BASE_PROFILE.recordId, nickname: 'Bobby' }) })
    );
    expect(findButtonByLabel(element, 'Save')).toBeNull();
    expect(element.shadowRoot.querySelector('h1').textContent).toContain('Bobby');
  });

  it('discards changes and does not call saveMyProfile on Cancel', async () => {
    getMyProfile.mockResolvedValue({ ...BASE_PROFILE, canEdit: true });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    findButtonByLabel(element, 'Edit').click();
    await flushPromises();

    const nicknameInput = element.shadowRoot.querySelector('lightning-input[data-field="draftNickname"]');
    nicknameInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Bobby' } }));

    findButtonByLabel(element, 'Cancel').click();
    await flushPromises();

    expect(saveMyProfile).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('h1').textContent).toContain('Robert');
  });

  it('renders only active business directory records passed from Apex', async () => {
    getMyProfile.mockResolvedValue({
      ...BASE_PROFILE,
      businessDirectoryRecords: [{ Id: 'p1', Company_Name__c: 'Active Co', Title__c: 'CEO' }]
    });

    const element = createElement('c-alumni-profile', { is: AlumniProfile });
    document.body.appendChild(element);
    await flushPromises();

    const items = element.shadowRoot.querySelectorAll('.business-directory-list li');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('Active Co');
  });
});

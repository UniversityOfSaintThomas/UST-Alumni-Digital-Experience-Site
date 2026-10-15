import { createElement } from 'lwc';
import UstPageContextPicker from 'c/ustPageContextPicker';
import getPlacements from '@salesforce/apex/PortalPageRegistry.getPlacements';

jest.mock(
    '@salesforce/apex/PortalPageRegistry.getPlacements',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

const PLACEMENTS = [
    { pageName: '*', pageLabel: 'All pages', zone: 'banner', scope: 'Layout' },
    { pageName: '*', pageLabel: 'All pages', zone: 'above_footer', scope: 'Layout' },
    { pageName: 'home', pageLabel: 'Home', zone: 'body', scope: 'Page' },
    { pageName: 'home', pageLabel: 'Home', zone: 'sidebar', scope: 'Page' },
    { pageName: 'alumni_directory__c', pageLabel: 'Alumni Directory', zone: 'sidebar', scope: 'Page' },
    { pageName: 'my_account__c', pageLabel: 'My Account', zone: 'body', scope: 'Page' }
];

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function createPicker(properties = {}) {
    const element = createElement('c-ust-page-context-picker', { is: UstPageContextPicker });
    Object.assign(element, properties);
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

function listbox(element) {
    return element.shadowRoot.querySelector('lightning-dual-listbox');
}

function optionValues(element) {
    return listbox(element).options.map((option) => option.value);
}

function text(element) {
    return element.shadowRoot.textContent;
}

describe('c-ust-page-context-picker', () => {
    beforeEach(() => {
        getPlacements.mockResolvedValue(PLACEMENTS);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('offers only All Pages and the pages that have the chosen zone', async () => {
        const element = await createPicker({ zone: 'sidebar' });
        expect(optionValues(element)).toEqual(['all', 'alumni_directory__c', 'home']);
    });

    it('treats a layout zone as present on every known page', async () => {
        const element = await createPicker({ zone: 'banner' });
        expect(optionValues(element)).toEqual(['all', 'alumni_directory__c', 'home', 'my_account__c']);
    });

    it('prompts for a zone when none is chosen', async () => {
        const element = await createPicker();
        expect(text(element)).toContain('Choose a zone first');
    });

    it('keeps unregistered and legacy values visible and flags them', async () => {
        const element = await createPicker({ zone: 'body', value: 'home;giving' });
        const labels = listbox(element).options.map((option) => option.label);
        expect(labels).toContain('giving (not registered)');
        expect(text(element)).toContain('Not registered yet: giving');
    });

    it('does not remove anything when the zone is first set', async () => {
        const element = await createPicker({ value: 'alumni_directory__c;home' });
        element.zone = 'body';
        await flushPromises();
        expect(element.value).toBe('alumni_directory__c;home');
        expect(text(element)).toContain('No Body zone on: Alumni Directory');
    });

    it('removes known pages that lack a newly chosen zone, tells the admin, and notifies the parent', async () => {
        const element = await createPicker({ zone: 'sidebar', value: 'alumni_directory__c;home' });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        element.zone = 'body';
        await flushPromises();

        expect(element.value).toBe('home');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.value).toBe('home');
        expect(text(element)).toContain('Removed Alumni Directory: no Body zone on that page.');
    });

    it('restores removed pages with Undo', async () => {
        const element = await createPicker({ zone: 'sidebar', value: 'alumni_directory__c;home' });
        element.zone = 'body';
        await flushPromises();

        const undo = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find(
            (button) => button.label === 'Undo'
        );
        undo.click();
        await flushPromises();

        expect(element.value).toBe('home;alumni_directory__c');
        expect(text(element)).not.toContain('Removed Alumni Directory');
    });

    it('keeps unregistered pages when the zone changes', async () => {
        const element = await createPicker({ zone: 'sidebar', value: 'giving;home' });
        element.zone = 'body';
        await flushPromises();
        expect(element.value).toBe('giving;home');
    });

    it('does not remove All Pages when the zone changes', async () => {
        const element = await createPicker({ zone: 'sidebar', value: 'all' });
        element.zone = 'body';
        await flushPromises();
        expect(element.value).toBe('all');
    });

    it('shows where the widget will appear', async () => {
        const element = await createPicker({ zone: 'sidebar', value: 'home' });
        expect(text(element)).toContain('Appears on:');
        expect(text(element)).toContain('Home');

        element.value = 'all';
        await flushPromises();
        expect(text(element)).toContain('Alumni Directory, Home');
    });

    it('warns when the widget would appear nowhere', async () => {
        const element = await createPicker({ zone: 'body', value: 'alumni_directory__c' });
        expect(text(element)).toContain('will not appear anywhere yet');
    });

    it('updates the value and notifies the parent when the selection changes', async () => {
        const element = await createPicker({ zone: 'sidebar' });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        listbox(element).dispatchEvent(new CustomEvent('change', { detail: { value: ['home', 'alumni_directory__c'] } }));
        await flushPromises();

        expect(element.value).toBe('home;alumni_directory__c');
        expect(handler.mock.calls[0][0].detail.value).toBe('home;alumni_directory__c');
    });

    it('adds a typed page name, lowercased, and rejects bad names', async () => {
        const element = await createPicker({ zone: 'sidebar' });
        const input = element.shadowRoot.querySelector('lightning-input');
        const addButton = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find(
            (button) => button.label === 'Add'
        );

        input.value = 'Bad Name!';
        input.dispatchEvent(new CustomEvent('change'));
        addButton.click();
        await flushPromises();
        expect(element.value).toBe('');
        expect(text(element)).toContain('Use the page API name');

        input.value = 'My_Page__c';
        input.dispatchEvent(new CustomEvent('change'));
        addButton.click();
        await flushPromises();
        expect(element.value).toBe('my_page__c');
    });

    it('is valid only when a page is selected', async () => {
        const empty = await createPicker({ zone: 'sidebar' });
        expect(empty.checkValidity()).toBe(false);
        const chosen = await createPicker({ zone: 'sidebar', value: 'home' });
        expect(chosen.checkValidity()).toBe(true);
    });

    it('lets the admin type page names when the registry cannot be loaded', async () => {
        getPlacements.mockRejectedValue(new Error('no access'));
        const element = await createPicker({ zone: 'sidebar' });
        expect(text(element)).toContain('page registry could not be loaded');
        expect(element.shadowRoot.querySelector('lightning-input')).not.toBeNull();
    });
});

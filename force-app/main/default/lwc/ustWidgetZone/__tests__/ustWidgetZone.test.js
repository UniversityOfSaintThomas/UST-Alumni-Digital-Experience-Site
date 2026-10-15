import { createElement } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import UstWidgetZone from 'c/ustWidgetZone';
import registerPlacement from '@salesforce/apex/PortalPageRegistry.registerPlacement';
import getWidgetsForZone from '@salesforce/apex/PortalWidgetController.getWidgetsForZone';

jest.mock(
    '@salesforce/apex/PortalWidgetController.getWidgetsForZone',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortalPageRegistry.registerPlacement',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

function createZone(properties = {}) {
    const element = createElement('c-ust-widget-zone', { is: UstWidgetZone });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

function flushPromises() {
    return Promise.resolve();
}

const BUILDER_PAGE = { type: 'comm__namedPage', attributes: { name: 'Alumni_Directory__c' }, state: { app: 'commeditor' } };
const LIVE_PAGE = { type: 'comm__namedPage', attributes: { name: 'Alumni_Directory__c' }, state: {} };

describe('c-ust-widget-zone placement registration', () => {
    beforeEach(() => {
        registerPlacement.mockResolvedValue('created');
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('registers the zone on the current page in Experience Builder', async () => {
        createZone({ zoneName: 'sidebar' });
        CurrentPageReference.emit(BUILDER_PAGE);
        await flushPromises();

        expect(registerPlacement).toHaveBeenCalledTimes(1);
        expect(registerPlacement).toHaveBeenCalledWith({
            pageName: 'alumni_directory__c',
            zoneName: 'sidebar',
            scope: 'Page'
        });
    });

    it('never registers for live site visitors', async () => {
        createZone({ zoneName: 'sidebar' });
        CurrentPageReference.emit(LIVE_PAGE);
        await flushPromises();

        expect(registerPlacement).not.toHaveBeenCalled();
    });

    it('registers a layout zone once for every page', async () => {
        createZone({ zoneName: 'banner', zoneScope: 'Layout' });
        CurrentPageReference.emit(BUILDER_PAGE);
        await flushPromises();

        expect(registerPlacement).toHaveBeenCalledWith({
            pageName: 'alumni_directory__c',
            zoneName: 'banner',
            scope: 'Layout'
        });
    });

    it('does not register again for the same page and zone', async () => {
        createZone({ zoneName: 'sidebar' });
        CurrentPageReference.emit(BUILDER_PAGE);
        CurrentPageReference.emit(BUILDER_PAGE);
        await flushPromises();

        expect(registerPlacement).toHaveBeenCalledTimes(1);
    });

    it('registers again when the admin moves to another page', async () => {
        createZone({ zoneName: 'sidebar' });
        CurrentPageReference.emit(BUILDER_PAGE);
        CurrentPageReference.emit({ ...BUILDER_PAGE, attributes: { name: 'Home' } });
        await flushPromises();

        expect(registerPlacement).toHaveBeenCalledTimes(2);
        expect(registerPlacement).toHaveBeenLastCalledWith({ pageName: 'home', zoneName: 'sidebar', scope: 'Page' });
    });

    it('ignores a registration failure', async () => {
        registerPlacement.mockRejectedValue(new Error('no access'));
        createZone({ zoneName: 'sidebar' });

        CurrentPageReference.emit(BUILDER_PAGE);
        await flushPromises();

        expect(registerPlacement).toHaveBeenCalledTimes(1);
    });

    it('does nothing without a zone name', async () => {
        createZone();
        CurrentPageReference.emit(BUILDER_PAGE);
        await flushPromises();

        expect(registerPlacement).not.toHaveBeenCalled();
    });
});

describe('c-ust-widget-zone rendering', () => {
    const HERO = { imageUrl: 'https://x.edu/h.png?v=1', altText: 'Alt', height: 'tall', textPosition: 'center', overlay: 'strong' };
    const BUTTONS = [{ id: 'a', label: 'Go', type: 'portal', url: '/x', newTab: false, style: 'brand', align: 'left', icon: null }];

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    async function renderWidgets(widgets) {
        const element = createZone({ zoneName: 'body' });
        CurrentPageReference.emit(LIVE_PAGE);
        getWidgetsForZone.emit(widgets);
        await flushPromises();
        await flushPromises();
        return element;
    }

    it('renders a hero banner widget with the hero settings, text, and buttons', async () => {
        const element = await renderWidgets([
            {
                id: 'h1', widgetLabel: 'Hero', componentName: 'ust_hero_banner', sortOrder: 1,
                staticContent: '<p>Hi</p>', staticContentHeader: 'Welcome', buttons: BUTTONS,
                buttonPlacement: 'Above', buttonSize: 'ust-buttons-wide', hero: HERO
            }
        ]);

        const hero = element.shadowRoot.querySelector('c-ust-hero-banner');
        expect(hero).not.toBeNull();
        expect(hero.hero).toEqual(HERO);
        expect(hero.richTextContent).toBe('<p>Hi</p>');
        expect(hero.textHeader).toBe('Welcome');
        expect(hero.buttons).toEqual(BUTTONS);
        expect(hero.buttonPlacement).toBe('Above');
        expect(hero.buttonSize).toBe('ust-buttons-wide');
        expect(element.shadowRoot.querySelector('c-ust-static-content')).toBeNull();
        expect(element.shadowRoot.querySelector('c-ust-portal-widget-stub')).toBeNull();
    });

    it('still renders static content widgets, and a mix of both in order', async () => {
        const element = await renderWidgets([
            { id: 'h1', widgetLabel: 'Hero', componentName: 'ust_hero_banner', sortOrder: 1, hero: HERO, buttons: [] },
            { id: 's1', widgetLabel: 'Text', componentName: 'ust_static_content', sortOrder: 2, staticContent: '<p>Body</p>', buttons: [] }
        ]);

        const slots = Array.from(element.shadowRoot.querySelectorAll('.ust-widget-slot')).map((slot) => slot.firstElementChild.tagName.toLowerCase());
        expect(slots).toEqual(['c-ust-hero-banner', 'c-ust-static-content']);
    });

    it('falls back to the placeholder for a widget type that is not built yet', async () => {
        const element = await renderWidgets([{ id: 'x', widgetLabel: 'Later', componentName: 'ust_links_hub', sortOrder: 1 }]);
        expect(element.shadowRoot.querySelector('c-ust-portal-widget-stub')).not.toBeNull();
    });
});

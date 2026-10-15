import { createElement } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import UstWidgetZone from 'c/ustWidgetZone';
import registerPlacement from '@salesforce/apex/PortalPageRegistry.registerPlacement';

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

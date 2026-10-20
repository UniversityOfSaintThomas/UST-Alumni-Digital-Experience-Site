import { createElement } from 'lwc';
import UstCardGrid from 'c/ustCardGrid';
import { __navigateMock, __generateUrlMock } from 'lightning/navigation';

jest.mock(
    'lightning/navigation',
    () => {
        const Navigate = Symbol('Navigate');
        const GenerateUrl = Symbol('GenerateUrl');
        const navigateMock = jest.fn();
        const generateUrlMock = jest.fn((reference) => Promise.resolve('/alumni' + reference.attributes.url));
        const NavigationMixin = (Base) =>
            class extends Base {
                [Navigate](reference) {
                    navigateMock(reference);
                }
                [GenerateUrl](reference) {
                    return generateUrlMock(reference);
                }
            };
        NavigationMixin.Navigate = Navigate;
        NavigationMixin.GenerateUrl = GenerateUrl;
        return { NavigationMixin, __navigateMock: navigateMock, __generateUrlMock: generateUrlMock };
    }
);

function card(overrides = {}) {
    return {
        id: 'c1', title: 'Become a Mentor', text: 'Share what you know.', imageUrl: 'https://bucket.example.edu/a.jpg',
        altText: 'Students', linkType: 'external', linkUrl: 'https://www.stthomas.edu/alumni', newTab: false, ...overrides
    };
}

function grid(cards, overrides = {}) {
    return { columns: '3', bottomBar: 'green', cards, ...overrides };
}

async function createGrid(properties = {}) {
    const element = createElement('c-ust-card-grid', { is: UstCardGrid });
    Object.assign(element, properties);
    document.body.appendChild(element);
    await Promise.resolve();
    await Promise.resolve();
    return element;
}

const list = (element) => element.shadowRoot.querySelector('ul');
const items = (element) => Array.from(element.shadowRoot.querySelectorAll('li'));
const link = (element, index = 0) => items(element)[index].querySelector('a');

describe('c-ust-card-grid', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    describe('what it draws', () => {
        it('draws one list item per card, with the title as a heading, the text, and the picture', async () => {
            const element = await createGrid({ grid: grid([card(), card({ id: 'c2', title: 'Hire a Tommie', text: 'Post a job.' })]) });
            expect(items(element)).toHaveLength(2);
            const first = items(element)[0];
            expect(first.querySelector('h3').textContent).toBe('Become a Mentor');
            expect(first.querySelector('.ust-card__text').textContent).toBe('Share what you know.');
            const image = first.querySelector('img');
            expect(image.getAttribute('src')).toBe('https://bucket.example.edu/a.jpg');
            expect(image.getAttribute('alt')).toBe('Students');
            expect(image.getAttribute('loading')).toBe('lazy');
        });

        it('draws no list, and asks Static Content for no panel, when there are no cards', async () => {
            const empty = await createGrid({ grid: grid([]) });
            expect(list(empty)).toBeNull();
            const none = await createGrid({});
            expect(list(none)).toBeNull();
            const host = none.shadowRoot.querySelector('c-ust-static-content');
            expect(host.hasSlotContent).toBe(false);
        });

        it('passes the heading, text, buttons and section settings to Static Content', async () => {
            const buttons = [{ id: 'b', label: 'Go', type: 'external', url: 'https://x.edu', newTab: false, style: 'brand', align: 'left', icon: null }];
            const element = await createGrid({
                grid: grid([card()]), textHeader: 'How You Can Make an Impact', richTextContent: '<p>Intro</p>', buttons,
                buttonPlacement: 'Above', buttonSize: 'ust-buttons-wide', contentClass: 'ust-content-centered',
                sectionBackground: 'gray', sectionAccent: 'green_circles'
            });
            const host = element.shadowRoot.querySelector('c-ust-static-content');
            expect(host.textHeader).toBe('How You Can Make an Impact');
            expect(host.richTextContent).toBe('<p>Intro</p>');
            expect(host.buttons).toEqual(buttons);
            expect(host.buttonPlacement).toBe('Above');
            expect(host.buttonSize).toBe('ust-buttons-wide');
            expect(host.contentClass).toBe('ust-content-centered');
            expect(host.sectionBackground).toBe('gray');
            expect(host.sectionAccent).toBe('green_circles');
            expect(host.hasSlotContent).toBe(true);
        });

        it('skips a card with no id or no title', async () => {
            const element = await createGrid({ grid: grid([card({ id: undefined }), card({ id: 'c2', title: '' }), card({ id: 'c3', title: 'Kept' })]) });
            expect(items(element)).toHaveLength(1);
            expect(items(element)[0].querySelector('h3').textContent).toBe('Kept');
        });

        it('draws a card with no text or picture as just its title', async () => {
            const element = await createGrid({ grid: grid([card({ text: null, imageUrl: null, altText: null, linkType: null, linkUrl: null })]) });
            const only = items(element)[0];
            expect(only.querySelector('.ust-card__text')).toBeNull();
            expect(only.querySelector('img')).toBeNull();
            expect(only.querySelector('a')).toBeNull();
            expect(only.querySelector('h3').textContent).toBe('Become a Mentor');
        });
    });

    describe('columns and bottom bar', () => {
        it.each([['2'], ['3'], ['4']])('uses %s columns when asked', async (columns) => {
            const element = await createGrid({ grid: grid([card()], { columns }) });
            expect(list(element).className).toContain('ust-card-grid_cols-' + columns);
        });

        it('falls back to 3 columns for a blank or unknown value', async () => {
            for (const columns of [undefined, '', '9', 'five']) {
                const element = await createGrid({ grid: grid([card()], { columns }) });
                expect(list(element).className).toContain('ust-card-grid_cols-3');
            }
        });

        it('draws the bottom bar unless the widget says none, for any other value too', async () => {
            const green = await createGrid({ grid: grid([card()], { bottomBar: 'green' }) });
            expect(list(green).className).toContain('ust-card-grid_bar');
            const blank = await createGrid({ grid: grid([card()], { bottomBar: undefined }) });
            expect(list(blank).className).toContain('ust-card-grid_bar');
            const odd = await createGrid({ grid: grid([card()], { bottomBar: 'pink' }) });
            expect(list(odd).className).toContain('ust-card-grid_bar');
            const none = await createGrid({ grid: grid([card()], { bottomBar: 'none' }) });
            expect(list(none).className).not.toContain('ust-card-grid_bar');
        });

        it('leaves a gap above the grid only when something is drawn above it', async () => {
            const bare = await createGrid({ grid: grid([card()]) });
            expect(list(bare).className).not.toContain('ust-card-grid_after-intro');
            const withHeading = await createGrid({ grid: grid([card()]), textHeader: 'Heading' });
            expect(list(withHeading).className).toContain('ust-card-grid_after-intro');
            const withText = await createGrid({ grid: grid([card()]), richTextContent: '<p>x</p>' });
            expect(list(withText).className).toContain('ust-card-grid_after-intro');
        });
    });

    describe('pictures', () => {
        it('marks a picture with no alt text as decorative (empty alt)', async () => {
            const element = await createGrid({ grid: grid([card({ altText: '' })]) });
            expect(items(element)[0].querySelector('img').getAttribute('alt')).toBe('');
        });

        it('does not draw a picture that is not https, even if the server sent it', async () => {
            for (const imageUrl of ['http://x.edu/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//x.edu/a.jpg']) {
                const element = await createGrid({ grid: grid([card({ imageUrl })]) });
                expect(items(element)[0].querySelector('img')).toBeNull();
            }
        });
    });

    describe('links', () => {
        it('links the title of a card with an external address, opening in a new tab only when asked', async () => {
            const same = await createGrid({ grid: grid([card({ newTab: false })]) });
            expect(link(same).getAttribute('href')).toBe('https://www.stthomas.edu/alumni');
            expect(link(same).getAttribute('target')).toBeNull();
            expect(link(same).textContent).toBe('Become a Mentor');

            const tab = await createGrid({ grid: grid([card({ newTab: true })]) });
            expect(link(tab).getAttribute('target')).toBe('_blank');
            expect(link(tab).getAttribute('rel')).toBe('noopener noreferrer');
            expect(link(tab).textContent).toContain('(opens in a new tab)');
        });

        it('never opens mail or phone links in a new tab', async () => {
            const element = await createGrid({ grid: grid([card({ linkUrl: 'mailto:alumni@stthomas.edu', newTab: true })]) });
            expect(link(element).getAttribute('href')).toBe('mailto:alumni@stthomas.edu');
            expect(link(element).getAttribute('target')).toBeNull();
        });

        it('does not link a card whose address is unsafe, even if the server sent it', async () => {
            for (const linkUrl of ['javascript:alert(1)', 'http://x.edu', '//evil.example', 'data:text/html,hi']) {
                const type = linkUrl.startsWith('//') ? 'portal' : 'external';
                const element = await createGrid({ grid: grid([card({ linkType: type, linkUrl })]) });
                expect(link(element)).toBeNull();
                expect(items(element)[0].querySelector('h3').textContent).toBe('Become a Mentor');
            }
        });

        it('turns a portal path into the real site address, and links the card once that is known', async () => {
            const element = await createGrid({ grid: grid([card({ linkType: 'portal', linkUrl: '/alumni-directory' })]) });
            await Promise.resolve();
            await Promise.resolve();
            expect(__generateUrlMock).toHaveBeenCalledWith({ type: 'standard__webPage', attributes: { url: '/alumni-directory' } });
            expect(link(element).getAttribute('href')).toBe('/alumni/alumni-directory');
        });

        it('navigates in the page on a plain click of a portal card, but leaves a modified click to the browser', async () => {
            const element = await createGrid({ grid: grid([card({ linkType: 'portal', linkUrl: '/alumni-directory' })]) });
            await Promise.resolve();
            await Promise.resolve();
            const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
            link(element).dispatchEvent(plain);
            expect(plain.defaultPrevented).toBe(true);
            expect(__navigateMock).toHaveBeenCalledWith({ type: 'standard__webPage', attributes: { url: '/alumni-directory' } });

            __navigateMock.mockClear();
            const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
            link(element).dispatchEvent(modified);
            expect(modified.defaultPrevented).toBe(false);
            expect(__navigateMock).not.toHaveBeenCalled();
        });

        it('does not navigate on a click of an external card', async () => {
            const element = await createGrid({ grid: grid([card()]) });
            const click = new MouseEvent('click', { bubbles: true, cancelable: true });
            link(element).dispatchEvent(click);
            expect(click.defaultPrevented).toBe(false);
            expect(__navigateMock).not.toHaveBeenCalled();
        });

        it('marks linked cards so they can show the hover bar, and unlinked cards not', async () => {
            const element = await createGrid({ grid: grid([card(), card({ id: 'c2', linkType: null, linkUrl: null })]) });
            expect(items(element)[0].className).toContain('ust-card_linked');
            expect(items(element)[1].className).not.toContain('ust-card_linked');
        });
    });

    describe('preview mode (admin editor)', () => {
        it('points every link at # and never opens a tab, asks for addresses, or navigates', async () => {
            const element = await createGrid({
                previewMode: true,
                grid: grid([card({ newTab: true }), card({ id: 'c2', linkType: 'portal', linkUrl: '/alumni-directory' })])
            });
            expect(link(element, 0).getAttribute('href')).toBe('#');
            expect(link(element, 0).getAttribute('target')).toBeNull();
            expect(link(element, 1).getAttribute('href')).toBe('#');
            expect(__generateUrlMock).not.toHaveBeenCalled();
            const click = new MouseEvent('click', { bubbles: true, cancelable: true });
            link(element, 1).dispatchEvent(click);
            expect(click.defaultPrevented).toBe(true);
            expect(__navigateMock).not.toHaveBeenCalled();
        });
    });
});

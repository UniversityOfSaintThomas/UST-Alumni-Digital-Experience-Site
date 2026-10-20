import { createElement } from 'lwc';
import UstHeroBanner from 'c/ustHeroBanner';

const HERO = {
    imageUrl: 'https://x.edu/desktop.png?v=1',
    mobileImageUrl: 'https://x.edu/mobile.png?v=1',
    altText: 'The quad in autumn',
    height: 'medium',
    textPosition: 'left',
    overlay: 'medium'
};

const BUTTONS = [
    { id: 'a', label: 'Visit', type: 'portal', url: '/alumni-directory', newTab: false, style: 'brand', align: 'left', icon: null },
    { id: 'b', label: 'Give', type: 'external', url: 'https://x.edu/give', newTab: true, style: 'outline-brand', align: 'left', icon: null }
];

function createHero(properties = {}) {
    const element = createElement('c-ust-hero-banner', { is: UstHeroBanner });
    Object.assign(element, { hero: HERO, richTextContent: '<p>Hello</p>', textHeader: 'Welcome' }, properties);
    document.body.appendChild(element);
    return element;
}

const flush = () => Promise.resolve();

function banner(element) {
    return element.shadowRoot.querySelector('.ust-hero');
}

function image(element) {
    return element.shadowRoot.querySelector('img');
}

describe('c-ust-hero-banner', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows the picture with its alt text, and passes headline, text, and buttons to the content component', () => {
        const element = createHero({ buttons: BUTTONS, buttonPlacement: 'Above', buttonSize: 'ust-buttons-wide' });
        expect(image(element).getAttribute('src')).toBe(HERO.imageUrl);
        expect(image(element).getAttribute('alt')).toBe('The quad in autumn');

        const content = element.shadowRoot.querySelector('c-ust-static-content');
        expect(content.richTextContent).toBe('<p>Hello</p>');
        expect(content.textHeader).toBe('Welcome');
        expect(content.buttonPlacement).toBe('Above');
        expect(content.buttonSize).toBe('ust-buttons-wide');
        expect(content.overImage).toBe(true);
    });

    it('lines its text up with the page grid only when it spans the page', () => {
        expect(banner(createHero()).className).not.toContain('ust-hero_full');
        expect(banner(createHero({ fullWidth: true })).className).toContain('ust-hero_full');
    });

    describe('split layout', () => {
        const SPLIT = { ...HERO, layout: 'split', textPosition: 'right', overlay: 'strong' };

        it('puts the text on a dark band with the picture beside it, and no dark layer over the picture', () => {
            const element = createHero({ hero: SPLIT, buttons: BUTTONS });
            expect(banner(element).className).toContain('ust-hero_split');
            expect(banner(element).className).not.toContain('ust-hero_right');
            expect(element.shadowRoot.querySelector('.ust-hero-split-text c-ust-static-content')).not.toBeNull();
            expect(element.shadowRoot.querySelector('.ust-hero-scrim')).toBeNull();
            expect(element.shadowRoot.querySelector('.ust-hero-picture')).toBeNull();
            const img = element.shadowRoot.querySelector('.ust-hero-split-picture img');
            expect(img.getAttribute('src')).toBe(HERO.imageUrl);
            expect(img.getAttribute('alt')).toBe('The quad in autumn');
        });

        it('tells the text it is on a dark band with a large headline, and keeps buttons on the left', () => {
            const element = createHero({ hero: SPLIT, buttons: BUTTONS });
            const content = element.shadowRoot.querySelector('c-ust-static-content');
            expect(content.darkBackground).toBe(true);
            expect(content.largeHeading).toBe(true);
            expect(content.overImage).toBeFalsy();
            content.buttons.forEach((button) => expect(button.align).toBe('left'));
        });

        it('hides the decorative rings from assistive technology', () => {
            const rings = createHero({ hero: SPLIT }).shadowRoot.querySelector('.ust-hero-rings');
            expect(rings.getAttribute('aria-hidden')).toBe('true');
        });

        it('keeps the mobile picture source and drops the picture when there is none', () => {
            const withMobile = createHero({ hero: SPLIT });
            expect(withMobile.shadowRoot.querySelector('.ust-hero-split-picture source').getAttribute('media')).toBe('(max-width: 767px)');
            const noImage = createHero({ hero: { ...SPLIT, imageUrl: null, mobileImageUrl: null } });
            expect(noImage.shadowRoot.querySelector('.ust-hero-split-picture')).toBeNull();
            expect(banner(noImage).className).toContain('ust-hero_split');
        });

        it('falls back to the picture on a failed load, like the full layout', async () => {
            const element = createHero({ hero: SPLIT });
            element.shadowRoot.querySelector('.ust-hero-split-image').dispatchEvent(new CustomEvent('error'));
            await flush();
            expect(element.shadowRoot.querySelector('.ust-hero-split-picture')).toBeNull();
        });

        it('treats a blank or unknown layout as the full picture', () => {
            [undefined, '', 'full', 'diagonal'].forEach((layout) => {
                const element = createHero({ hero: { ...HERO, layout } });
                expect(banner(element).className).not.toContain('ust-hero_split');
                expect(element.shadowRoot.querySelector('.ust-hero-picture')).not.toBeNull();
                expect(element.shadowRoot.querySelector('.ust-hero-split')).toBeNull();
            });
        });

        it('lines up with the page grid when it spans the page', () => {
            expect(banner(createHero({ hero: SPLIT, fullWidth: true })).className).toContain('ust-hero_full');
        });
    });

    it('marks a picture without alt text as decorative', () => {
        const element = createHero({ hero: { ...HERO, altText: null } });
        expect(image(element).getAttribute('alt')).toBe('');
    });

    it('uses the optional mobile picture for narrow screens', () => {
        const element = createHero();
        const source = element.shadowRoot.querySelector('picture source');
        expect(source.getAttribute('srcset')).toBe(HERO.mobileImageUrl);
        expect(source.getAttribute('media')).toBe('(max-width: 767px)');
    });

    it('omits the mobile source when there is no mobile picture', () => {
        const element = createHero({ hero: { ...HERO, mobileImageUrl: null } });
        expect(element.shadowRoot.querySelector('picture source')).toBeNull();
        expect(image(element)).not.toBeNull();
    });

    it('falls back to the brand-colour background when there is no picture', () => {
        const element = createHero({ hero: { ...HERO, imageUrl: null, mobileImageUrl: null } });
        expect(image(element)).toBeNull();
        expect(banner(element)).not.toBeNull();
        expect(element.shadowRoot.querySelector('c-ust-static-content')).not.toBeNull();
    });

    it('falls back to the background if the picture fails to load', async () => {
        const element = createHero();
        image(element).dispatchEvent(new CustomEvent('error'));
        await flush();
        expect(image(element)).toBeNull();
        expect(element.shadowRoot.querySelector('c-ust-static-content')).not.toBeNull();
    });

    it('renders nothing when there is no picture and nothing to say', () => {
        const element = createHero({ hero: { ...HERO, imageUrl: null }, richTextContent: '', textHeader: '', buttons: [] });
        expect(banner(element)).toBeNull();
    });

    it('renders a picture-only hero', () => {
        const element = createHero({ richTextContent: '', textHeader: '', buttons: [] });
        expect(banner(element)).not.toBeNull();
    });

    it.each([
        ['short', 'ust-hero_short'], ['medium', 'ust-hero_medium'], ['tall', 'ust-hero_tall'], ['gigantic', 'ust-hero_medium'], [undefined, 'ust-hero_medium']
    ])('height %s uses %s', (height, expected) => {
        expect(banner(createHero({ hero: { ...HERO, height } })).className).toContain(expected);
    });

    it.each([
        ['left', 'ust-hero_left'], ['center', 'ust-hero_center'], ['right', 'ust-hero_right'], ['sideways', 'ust-hero_left']
    ])('text position %s uses %s', (textPosition, expected) => {
        expect(banner(createHero({ hero: { ...HERO, textPosition } })).className).toContain(expected);
    });

    it.each([
        ['light', 'ust-hero-scrim_light'], ['medium', 'ust-hero-scrim_medium'], ['strong', 'ust-hero-scrim_strong'],
        ['bogus', 'ust-hero-scrim_medium']
    ])('overlay %s uses %s (an unknown value still protects the white text)', (overlay, expected) => {
        const element = createHero({ hero: { ...HERO, overlay } });
        expect(element.shadowRoot.querySelector('.ust-hero-scrim').className).toContain(expected);
    });

    it('draws no dark layer at all when the overlay is none, so the picture shows as it is', () => {
        const element = createHero({ hero: { ...HERO, overlay: 'none' } });
        expect(element.shadowRoot.querySelector('.ust-hero-scrim')).toBeNull();
        expect(element.shadowRoot.querySelector('img.ust-hero-image')).not.toBeNull();
    });

    it('lines the buttons up with the text position, ignoring per-button alignment', () => {
        const mixed = BUTTONS.map((button, index) => ({ ...button, align: index === 0 ? 'center' : 'end' }));
        const centered = createHero({ buttons: mixed, hero: { ...HERO, textPosition: 'center' } });
        expect(centered.shadowRoot.querySelector('c-ust-static-content').buttons.map((button) => button.align)).toEqual(['center', 'center']);

        const right = createHero({ buttons: BUTTONS, hero: { ...HERO, textPosition: 'right' } });
        expect(right.shadowRoot.querySelectorAll('c-ust-static-content')[0].buttons.map((button) => button.align)).toEqual(['end', 'end']);
    });

    it('passes preview mode to the content component', () => {
        const element = createHero({ previewMode: true, buttons: BUTTONS });
        expect(element.shadowRoot.querySelector('c-ust-static-content').previewMode).toBe(true);
    });

    it('copes with a missing hero object', () => {
        const element = createHero({ hero: undefined });
        expect(image(element)).toBeNull();
        expect(banner(element)).not.toBeNull();
    });
});

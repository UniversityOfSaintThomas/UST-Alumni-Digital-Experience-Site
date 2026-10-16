/**
 * PortalHero
 *
 * Prepares the picture settings of a Hero Banner widget for the portal. The headline, overlay text,
 * and buttons come from the same fields as Static Content (already resolved by PortalWidgetController);
 * this class only deals with the image and its look.
 *
 * Everything is re-checked on every read, because the fields can also change through a data load:
 *   - Image addresses must be https, with no whitespace, quotes, angle brackets, commas, or backslashes,
 *     and a modest length. Anything else is dropped (the hero then shows the brand-colour background).
 *     The browser's content security policy (img-src trusted sites) is a second wall behind this.
 *   - A cache-busting version (the widget's last-modified time) is added to each address. The S3 tool
 *     reuses the same file name when an image is replaced, so without it visitors could keep seeing
 *     the old picture.
 *   - Height and text position fall back to defaults when blank or unknown.
 *   - Overlay: blank (the picklist's --None--) means NO overlay and is sent as "none"; an unknown value falls
 *     back to Medium so a bad value never leaves the white text unprotected by accident.
 *   - Alt text is only used together with an image; without alt text the image is decorative.
 */
public with sharing class PortalHero {

    public static final String DEFAULT_HEIGHT = 'medium';
    public static final String DEFAULT_TEXT_POSITION = 'left';
    public static final String DEFAULT_OVERLAY = 'medium';
    public static final String OVERLAY_NONE = 'none';

    private static final Integer MAX_URL_LENGTH = 2048;
    private static final Integer MAX_ALT_LENGTH = 255;

    private static final Set<String> HEIGHTS = new Set<String>{ 'short', 'medium', 'tall' };
    private static final Set<String> TEXT_POSITIONS = new Set<String>{ 'left', 'center', 'right' };
    private static final Set<String> OVERLAYS = new Set<String>{ 'light', 'medium', 'strong' };

    // https, a host, then anything except whitespace, control characters, quotes, angle brackets,
    // commas (they would break a srcset), and backslashes.
    private static final String BAD_CHARACTERS = '\\s\\x00-\\x1F\\x7F"\'<>,\\\\';
    private static final Pattern IMAGE_URL_PATTERN = Pattern.compile(
            '(?i)^https://[^' + BAD_CHARACTERS + '/?#]+[^' + BAD_CHARACTERS + ']*$');

    /** Picture settings for one hero, ready to render. */
    public class HeroDto {
        @AuraEnabled public String imageUrl;
        @AuraEnabled public String mobileImageUrl;
        @AuraEnabled public String altText;
        @AuraEnabled public String height;
        @AuraEnabled public String textPosition;
        @AuraEnabled public String overlay;
    }

    /** The stored picture addresses, for the admin editor's preview. */
    public class HeroImages {
        @AuraEnabled public String imageUrl;
        @AuraEnabled public String mobileImageUrl;
    }

    /**
     * Reads the current picture addresses of one widget for the admin editor. The S3 uploader writes
     * them straight to the record (outside the edit form), so the editor asks again after an upload.
     * Not cacheable, so a fresh upload is always seen. Only people who can edit widgets get a result,
     * and only safe addresses are returned.
     *
     * @param widgetId The Portal Widget record Id
     * @return The addresses; both null when unavailable
     */
    @AuraEnabled
    public static HeroImages getHeroImages(Id widgetId) {
        HeroImages images = new HeroImages();
        if (widgetId == null || !Schema.SObjectType.UST_Portal_Widget__c.isUpdateable()) {
            return images;
        }
        List<UST_Portal_Widget__c> rows = [
                SELECT Hero_Image_URL__c, Hero_Mobile_Image_URL__c
                FROM UST_Portal_Widget__c
                WHERE Id = :widgetId
                WITH USER_MODE
                LIMIT 1
        ];
        if (!rows.isEmpty()) {
            images.imageUrl = isAllowedImageUrl(rows[0].Hero_Image_URL__c) ? rows[0].Hero_Image_URL__c.trim() : null;
            images.mobileImageUrl = isAllowedImageUrl(rows[0].Hero_Mobile_Image_URL__c) ? rows[0].Hero_Mobile_Image_URL__c.trim() : null;
        }
        return images;
    }

    /**
     * Builds the hero settings for a widget.
     *
     * @param widget The widget record (needs the Hero_* fields and SystemModstamp)
     * @return The cleaned settings; images are null when missing or unsafe
     */
    public static HeroDto prepare(UST_Portal_Widget__c widget) {
        HeroDto hero = new HeroDto();
        String version = widget.SystemModstamp == null ? null : String.valueOf(widget.SystemModstamp.getTime());
        hero.imageUrl = versionedImageUrl(widget.Hero_Image_URL__c, version);
        hero.mobileImageUrl = versionedImageUrl(widget.Hero_Mobile_Image_URL__c, version);
        hero.altText = hero.imageUrl == null ? null : cleanAltText(widget.Hero_Alt_Text__c);
        hero.height = pick(widget.Hero_Height__c, HEIGHTS, DEFAULT_HEIGHT);
        hero.textPosition = pick(widget.Hero_Text_Position__c, TEXT_POSITIONS, DEFAULT_TEXT_POSITION);
        hero.overlay = String.isBlank(widget.Hero_Overlay__c)
                ? OVERLAY_NONE
                : pick(widget.Hero_Overlay__c, OVERLAYS, DEFAULT_OVERLAY);
        return hero;
    }

    /**
     * Checks an image address against the allowlist.
     *
     * @param url The address as stored
     * @return true if it is a safe https address
     */
    public static Boolean isAllowedImageUrl(String url) {
        return String.isNotBlank(url) && url.length() <= MAX_URL_LENGTH && IMAGE_URL_PATTERN.matcher(url.trim()).matches();
    }

    /**
     * Returns the address with a cache-busting version, or null when the address is not allowed.
     *
     * @param url     The address as stored
     * @param version The version to append (blank means none)
     * @return The versioned, safe address or null
     */
    @TestVisible
    private static String versionedImageUrl(String url, String version) {
        if (!isAllowedImageUrl(url)) {
            return null;
        }
        String cleaned = url.trim();
        if (String.isBlank(version)) {
            return cleaned;
        }
        // Keep any #fragment last.
        String fragment = '';
        Integer hashIndex = cleaned.indexOf('#');
        if (hashIndex >= 0) {
            fragment = cleaned.substring(hashIndex);
            cleaned = cleaned.substring(0, hashIndex);
        }
        return cleaned + (cleaned.contains('?') ? '&' : '?') + 'v=' + version + fragment;
    }

    private static String cleanAltText(String altText) {
        if (String.isBlank(altText)) {
            return null;
        }
        String trimmed = altText.trim();
        return trimmed.length() > MAX_ALT_LENGTH ? trimmed.substring(0, MAX_ALT_LENGTH) : trimmed;
    }

    private static String pick(String value, Set<String> allowed, String fallback) {
        return value != null && allowed.contains(value) ? value : fallback;
    }
}
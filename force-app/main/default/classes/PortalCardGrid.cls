/**
 * PortalCardGrid
 *
 * Prepares the Card Grid widget (Component_Name__c = ust_card_grid) for the portal: the grid-wide settings from
 * the widget (columns, bottom bar) and one clean card per UST_Portal_Widget_Item__c record.
 *
 * Everything an admin typed is treated as untrusted. Pictures must pass PortalHero.isAllowedImageUrl (https
 * only) and links must pass PortalButtons.isAllowedUrl, the same rules the hero and the buttons use. A picture
 * or link that fails is dropped and the card is still shown without it. Text is plain text (the LWC escapes it).
 * Unknown picklist values fall back to the defaults. Data tags are not supported in cards.
 *
 * prepare() is pure so it can be tested without data. The portal query for guests lives in
 * PortalWidgetController (without sharing, system mode); getGridPreview() is for the admin editor and runs as
 * the signed-in admin.
 */
public with sharing class PortalCardGrid {

    /** Component_Name__c value of the Card Grid widget. */
    public static final String COMPONENT_NAME = 'ust_card_grid';
    public static final String DEFAULT_COLUMNS = '3';
    public static final String DEFAULT_BOTTOM_BAR = 'green';
    /** Most cards a grid shows; the rest are ignored so one widget cannot produce a huge page. */
    public static final Integer MAX_CARDS = 24;

    private static final Integer MAX_ALT_LENGTH = 255;
    private static final Integer MAX_TITLE_LENGTH = 80;
    private static final Integer MAX_TEXT_LENGTH = 500;
    private static final Integer MAX_LINK_LENGTH = 255;
    /** Gap between sort orders, so a card can be slotted between two others by hand. */
    private static final Integer SORT_STEP = 10;
    private static final Set<String> COLUMNS = new Set<String>{ '2', '3', '4' };
    private static final Set<String> BOTTOM_BARS = new Set<String>{ 'green', 'none' };

    public class CardDto {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String text;
        /** Safe https picture address with a cache-busting version, or null */
        @AuraEnabled public String imageUrl;
        /** Alt text; empty string marks a decorative picture. Null when there is no picture. */
        @AuraEnabled public String altText;
        /** 'portal' or 'external' when the card has a valid link, otherwise null */
        @AuraEnabled public String linkType;
        @AuraEnabled public String linkUrl;
        @AuraEnabled public Boolean newTab;
    }

    /** One card as the admin editor shows and edits it (the raw values, not the cleaned ones). */
    public class ItemRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String title;
        @AuraEnabled public String text;
        @AuraEnabled public String imageUrl;
        @AuraEnabled public String altText;
        @AuraEnabled public String linkUrl;
        @AuraEnabled public Boolean newTab;
        @AuraEnabled public Decimal sortOrder;
    }

    public class GridDto {
        /** '2', '3' or '4' */
        @AuraEnabled public String columns;
        /** 'green' or 'none' */
        @AuraEnabled public String bottomBar;
        @AuraEnabled public List<CardDto> cards = new List<CardDto>();
    }

    /**
     * Builds the grid for a widget.
     *
     * @param columns   Grid_Columns__c value (blank or unknown means 3)
     * @param bottomBar Card_Bottom_Bar__c value (blank or unknown means green)
     * @param items     The widget's items, already in display order
     * @return The cleaned grid; at most MAX_CARDS cards
     */
    public static GridDto prepare(String columns, String bottomBar, List<UST_Portal_Widget_Item__c> items) {
        GridDto grid = new GridDto();
        grid.columns = normalizeColumns(columns);
        grid.bottomBar = normalizeBottomBar(bottomBar);
        if (items == null) {
            return grid;
        }
        for (UST_Portal_Widget_Item__c item : items) {
            if (grid.cards.size() >= MAX_CARDS) {
                break;
            }
            CardDto card = cleanCard(item);
            if (card != null) {
                grid.cards.add(card);
            }
        }
        return grid;
    }

    /**
     * @param value Raw Grid_Columns__c value
     * @return '2', '3' or '4'; '3' when blank or unknown
     */
    public static String normalizeColumns(String value) {
        return value != null && COLUMNS.contains(value) ? value : DEFAULT_COLUMNS;
    }

    /**
     * @param value Raw Card_Bottom_Bar__c value
     * @return 'green' or 'none'; 'green' when blank or unknown
     */
    public static String normalizeBottomBar(String value) {
        return value != null && BOTTOM_BARS.contains(value) ? value : DEFAULT_BOTTOM_BAR;
    }

    /**
     * What the admin editor shows for the grid as it stands. The editor passes the widget-level choices as they
     * are on screen (they may not be saved yet); the cards come from the saved items. Runs as the signed-in
     * admin, so object and field access is enforced.
     *
     * @param widgetId  The Card Grid widget
     * @param columns   Grid_Columns__c as currently chosen
     * @param bottomBar Card_Bottom_Bar__c as currently chosen
     * @return The grid exactly as the portal would show it
     */
    @AuraEnabled
    public static GridDto getGridPreview(Id widgetId, String columns, String bottomBar) {
        return prepare(columns, bottomBar, queryItems(widgetId));
    }

    // ----- Admin editor: the cards of one widget -----

    /**
     * The widget's cards in display order, as typed.
     *
     * @param widgetId The Card Grid widget
     * @return One row per card
     */
    @AuraEnabled
    public static List<ItemRow> getEditorItems(Id widgetId) {
        List<ItemRow> rows = new List<ItemRow>();
        for (UST_Portal_Widget_Item__c item : queryItems(widgetId)) {
            rows.add(toRow(item));
        }
        return rows;
    }

    /**
     * Creates a card (itemId blank) or updates one. Everything is checked with the same rules the portal uses to
     * clean cards, but here a problem is reported to the admin instead of being dropped quietly. A new card goes
     * last. Runs as the signed-in admin.
     *
     * @param widgetId The Card Grid widget
     * @param itemId   The card to update, or blank for a new card
     * @param title    Required, at most 80 characters
     * @param text     Optional plain text, at most 500 characters
     * @param imageUrl Optional https address
     * @param altText  Optional description of the picture, at most 255 characters
     * @param linkUrl  Optional site page (starts with /) or https, mailto or tel address
     * @param newTab   Open an https link in a new tab
     * @return The saved card
     */
    @AuraEnabled
    public static ItemRow saveItem(Id widgetId, Id itemId, String title, String text, String imageUrl,
            String altText, String linkUrl, Boolean newTab) {
        String cleanTitle = trimOrNull(title);
        if (cleanTitle == null) {
            throw fail('Give the card a title.');
        }
        if (cleanTitle.length() > MAX_TITLE_LENGTH) {
            throw fail('The title can be at most ' + MAX_TITLE_LENGTH + ' characters.');
        }
        String cleanText = trimOrNull(text);
        if (cleanText != null && cleanText.length() > MAX_TEXT_LENGTH) {
            throw fail('The text can be at most ' + MAX_TEXT_LENGTH + ' characters.');
        }
        String cleanImage = trimOrNull(imageUrl);
        if (cleanImage != null && !PortalHero.isAllowedImageUrl(cleanImage)) {
            throw fail('The picture address must start with https:// and contain no spaces.');
        }
        String cleanAlt = trimOrNull(altText);
        if (cleanAlt != null && cleanAlt.length() > MAX_ALT_LENGTH) {
            throw fail('The picture description can be at most ' + MAX_ALT_LENGTH + ' characters.');
        }
        String cleanLink = trimOrNull(linkUrl);
        if (cleanLink != null) {
            String type = cleanLink.startsWith('/') ? PortalButtons.TYPE_PORTAL : PortalButtons.TYPE_EXTERNAL;
            if (cleanLink.length() > MAX_LINK_LENGTH || !PortalButtons.isAllowedUrl(type, cleanLink)) {
                throw fail('The link must be a site page that starts with / (such as /alumni-directory), '
                        + 'or an address that starts with https://, mailto: or tel:.');
            }
        }

        UST_Portal_Widget_Item__c item;
        if (itemId == null) {
            List<UST_Portal_Widget_Item__c> existing = queryItems(widgetId);
            if (existing.size() >= MAX_CARDS) {
                throw fail('A grid can have at most ' + MAX_CARDS + ' cards.');
            }
            Decimal highest = 0;
            for (UST_Portal_Widget_Item__c other : existing) {
                if (other.Sort_Order__c != null && other.Sort_Order__c > highest) {
                    highest = other.Sort_Order__c;
                }
            }
            item = new UST_Portal_Widget_Item__c(Widget__c = widgetId, Sort_Order__c = highest + SORT_STEP);
        } else {
            item = findItem(widgetId, itemId);
        }
        item.Name = cleanTitle;
        item.Card_Text__c = cleanText;
        item.Image_URL__c = cleanImage;
        item.Image_Alt_Text__c = cleanAlt;
        item.Link_URL__c = cleanLink;
        item.Open_In_New_Tab__c = newTab == true;
        if (itemId == null) {
            insert as user item;
        } else {
            update as user item;
        }
        return toRow(findItem(widgetId, item.Id));
    }

    /**
     * Deletes one card of the widget.
     *
     * @param widgetId The Card Grid widget (the card must belong to it)
     * @param itemId   The card to delete
     */
    @AuraEnabled
    public static void deleteItem(Id widgetId, Id itemId) {
        UST_Portal_Widget_Item__c item = findItem(widgetId, itemId);
        delete as user item;
    }

    /**
     * Puts the cards in the given order (sort orders become 10, 20, 30 ...). Cards not listed follow, in their
     * current order; ids that are not this widget's cards are ignored.
     *
     * @param widgetId   The Card Grid widget
     * @param orderedIds Card ids, first to last
     */
    @AuraEnabled
    public static void reorder(Id widgetId, List<Id> orderedIds) {
        List<UST_Portal_Widget_Item__c> current = queryItems(widgetId);
        Map<Id, UST_Portal_Widget_Item__c> byId = new Map<Id, UST_Portal_Widget_Item__c>(current);
        List<UST_Portal_Widget_Item__c> ordered = new List<UST_Portal_Widget_Item__c>();
        Set<Id> placed = new Set<Id>();
        for (Id itemId : orderedIds == null ? new List<Id>() : orderedIds) {
            if (byId.containsKey(itemId) && placed.add(itemId)) {
                ordered.add(byId.get(itemId));
            }
        }
        for (UST_Portal_Widget_Item__c item : current) {
            if (placed.add(item.Id)) {
                ordered.add(item);
            }
        }
        Integer position = 0;
        for (UST_Portal_Widget_Item__c item : ordered) {
            position += SORT_STEP;
            item.Sort_Order__c = position;
        }
        update as user ordered;
    }

    // ----- Queries and small helpers -----

    private static List<UST_Portal_Widget_Item__c> queryItems(Id widgetId) {
        return [
                SELECT Id, Name, Card_Text__c, Image_URL__c, Image_Alt_Text__c, Link_URL__c,
                        Open_In_New_Tab__c, Sort_Order__c, SystemModstamp
                FROM UST_Portal_Widget_Item__c
                WHERE Widget__c = :widgetId
                WITH USER_MODE
                ORDER BY Sort_Order__c ASC NULLS LAST, Name ASC
                LIMIT :MAX_CARDS
        ];
    }

    private static UST_Portal_Widget_Item__c findItem(Id widgetId, Id itemId) {
        List<UST_Portal_Widget_Item__c> found = [
                SELECT Id, Name, Card_Text__c, Image_URL__c, Image_Alt_Text__c, Link_URL__c,
                        Open_In_New_Tab__c, Sort_Order__c, SystemModstamp
                FROM UST_Portal_Widget_Item__c
                WHERE Id = :itemId AND Widget__c = :widgetId
                WITH USER_MODE
                LIMIT 1
        ];
        if (found.isEmpty()) {
            throw fail('That card no longer exists. Reload the page and try again.');
        }
        return found[0];
    }

    private static ItemRow toRow(UST_Portal_Widget_Item__c item) {
        ItemRow row = new ItemRow();
        row.id = item.Id;
        row.title = item.Name;
        row.text = item.Card_Text__c;
        row.imageUrl = item.Image_URL__c;
        row.altText = item.Image_Alt_Text__c;
        row.linkUrl = item.Link_URL__c;
        row.newTab = item.Open_In_New_Tab__c == true;
        row.sortOrder = item.Sort_Order__c;
        return row;
    }

    private static String trimOrNull(String value) {
        return String.isBlank(value) ? null : value.trim();
    }

    private static AuraHandledException fail(String message) {
        AuraHandledException problem = new AuraHandledException(message);
        problem.setMessage(message);
        return problem;
    }

    // ----- Cleaning -----

    /**
     * @param item One item record
     * @return The clean card, or null when the item has no title
     */
    @TestVisible
    private static CardDto cleanCard(UST_Portal_Widget_Item__c item) {
        if (item == null || String.isBlank(item.Name)) {
            return null;
        }
        CardDto card = new CardDto();
        card.id = item.Id;
        card.title = item.Name.trim();
        card.text = String.isBlank(item.Card_Text__c) ? null : item.Card_Text__c.trim();
        String version = item.SystemModstamp == null ? null : String.valueOf(item.SystemModstamp.getTime());
        card.imageUrl = PortalHero.versionedImageUrl(item.Image_URL__c, version);
        card.altText = card.imageUrl == null ? null : cleanAltText(item.Image_Alt_Text__c);
        String link = String.isBlank(item.Link_URL__c) ? null : item.Link_URL__c.trim();
        if (link != null) {
            String type = link.startsWith('/') ? PortalButtons.TYPE_PORTAL : PortalButtons.TYPE_EXTERNAL;
            if (PortalButtons.isAllowedUrl(type, link)) {
                card.linkType = type;
                card.linkUrl = link;
                // A new tab only makes sense for an https address (not a site page, mail or phone link).
                card.newTab = item.Open_In_New_Tab__c == true && type == PortalButtons.TYPE_EXTERNAL
                        && link.toLowerCase().startsWith('https:');
            }
        }
        if (card.newTab == null) {
            card.newTab = false;
        }
        return card;
    }

    private static String cleanAltText(String altText) {
        if (String.isBlank(altText)) {
            return '';
        }
        String trimmed = altText.trim();
        return trimmed.length() > MAX_ALT_LENGTH ? trimmed.substring(0, MAX_ALT_LENGTH) : trimmed;
    }
}

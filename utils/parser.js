/**
 * Parser Utility
 * Parses HTML content from Adventar calendars
 * 
 * Note: Uses regex-based parsing since DOMParser is not available in Service Workers.
 * While regex parsing HTML is fragile, it works for the known Adventar structure.
 */

// =============================================================================
// Regex Patterns
// =============================================================================

const PATTERNS = {
    // Extract title from: <title>Calendar Title - Adventar</title>
    TITLE: /<title[^>]*>(.*?) - Adventar<\/title>/,
    
    // Extract entry list content: <ul class="EntryList">...</ul>
    ENTRY_LIST: /<ul[^>]*class="EntryList"[^>]*>([\s\S]*?)<\/ul>/,
    
    // Split by list items with class="item"
    LIST_ITEM: /<li[^>]*class="item"[^>]*>/,
    
    // Extract date: <div class="date">12/25</div>
    DATE: /class="date"[^>]*>([^<]+)</,
    
    // Extract user icon: <div class="user"><img src="...">
    USER_ICON: /class="user"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/,
    
    // Extract user name: <div class="user">...<a>Name</a>
    USER_NAME: /class="user"[^>]*>[\s\S]*?<a[^>]*>([^<]+)</,
    
    // Extract article URL: <div class="link"><a href="URL">
    LINK_URL: /class="link"[^>]*><a[^>]*href="([^"]+)"/,
    
    // Extract left content area for title parsing
    LEFT_CONTENT: /class="left"[^>]*>([\s\S]*?)<\/div>\s*<div class="image"/,
    
    // Alternative title extraction after link div
    ALT_TITLE: /class="link"[\s\S]*?<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/,
    
    // Remove HTML tags
    HTML_TAGS: /<[^>]+>/g,
    
    // Remove link div content
    LINK_DIV: /<div[^>]*class="link"[\s\S]*?<\/div>/
};

// =============================================================================
// Parser Export
// =============================================================================

export const parser = {
    /**
     * Parse Adventar calendar HTML
     * @param {string} html - Raw HTML content
     * @returns {{ title: string, articles: Array }} - Parsed calendar data
     */
    parseAdventar(html) {
        const title = extractTitle(html);
        const articles = extractArticles(html);
        return { title, articles };
    }
};

// =============================================================================
// Extraction Helpers
// =============================================================================

/**
 * Extract calendar title from HTML
 * @param {string} html - Raw HTML content
 * @returns {string} - Calendar title
 */
function extractTitle(html) {
    const match = html.match(PATTERNS.TITLE);
    return match ? match[1] : 'Unknown Calendar';
}

/**
 * Extract all articles from HTML
 * @param {string} html - Raw HTML content
 * @returns {Array} - Array of article objects
 */
function extractArticles(html) {
    const articles = [];
    
    const entryListMatch = html.match(PATTERNS.ENTRY_LIST);
    if (!entryListMatch) {
        return articles;
    }
    
    const listContent = entryListMatch[1];
    const items = listContent.split(PATTERNS.LIST_ITEM);
    
    items.forEach(item => {
        if (!item.trim()) return;
        
        const article = parseArticleItem(item);
        if (article) {
            articles.push(article);
        }
    });
    
    return articles;
}

/**
 * Parse a single article item HTML
 * @param {string} itemHtml - HTML content of single item
 * @returns {Object|null} - Article object or null if parsing failed
 */
function parseArticleItem(itemHtml) {
    const dateMatch = itemHtml.match(PATTERNS.DATE);
    const linkMatch = itemHtml.match(PATTERNS.LINK_URL);
    
    // Both date and link are required
    if (!dateMatch || !linkMatch) {
        return null;
    }
    
    const userIconMatch = itemHtml.match(PATTERNS.USER_ICON);
    const userNameMatch = itemHtml.match(PATTERNS.USER_NAME);
    const articleTitle = extractArticleTitle(itemHtml, linkMatch[1]);
    
    return {
        date: dateMatch[1].trim(),
        title: articleTitle,
        url: linkMatch[1],
        author: userNameMatch ? userNameMatch[1].trim() : 'Unknown',
        icon: userIconMatch ? userIconMatch[1] : null
    };
}

/**
 * Extract article title from item HTML
 * Title can be in several locations depending on HTML structure
 * @param {string} itemHtml - HTML content of single item
 * @param {string} fallbackUrl - URL to use as fallback title
 * @returns {string} - Article title
 */
function extractArticleTitle(itemHtml, fallbackUrl) {
    // Try primary location: .left div content after .link div
    const leftMatch = itemHtml.match(PATTERNS.LEFT_CONTENT);
    
    if (leftMatch) {
        let leftContent = leftMatch[1];
        // Remove the link div
        leftContent = leftContent.replace(PATTERNS.LINK_DIV, '');
        // Remove all HTML tags
        const rawText = stripHtmlTags(leftContent);
        
        if (rawText.length > 0) {
            return rawText;
        }
    }
    
    // Try alternative location: div after .link closing tag
    const altMatch = itemHtml.match(PATTERNS.ALT_TITLE);
    if (altMatch) {
        const possibleTitle = stripHtmlTags(altMatch[1]);
        if (possibleTitle) {
            return possibleTitle;
        }
    }
    
    // Fallback to URL
    return fallbackUrl;
}

/**
 * Remove HTML tags from string
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
function stripHtmlTags(html) {
    return html.replace(PATTERNS.HTML_TAGS, '').trim();
}

import { storage } from '../utils/storage.js';
import { parser } from '../utils/parser.js';

// =============================================================================
// Constants
// =============================================================================

const ALARM_NAME = 'PERIODIC_UPDATE';

const MESSAGE_TYPES = {
    ADD_CALENDAR: 'ADD_CALENDAR',
    FORCE_UPDATE: 'FORCE_UPDATE',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    CLEAR_NEW_COUNTS: 'CLEAR_NEW_COUNTS'
};

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize extension on install
 * Sets up periodic update alarm
 */
chrome.runtime.onInstalled.addListener(async () => {
    console.log('AC Manager Installed');
    const settings = await storage.getSettings();
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: settings.refreshInterval });
});

// =============================================================================
// Alarm Handlers
// =============================================================================

/**
 * Handle periodic alarm for calendar updates
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('Periodic update triggered');
        await updateAllCalendars();
    }
});

// =============================================================================
// Message Handlers
// =============================================================================

/**
 * Map of message type handlers
 */
const messageHandlers = {
    /**
     * Handle adding a new calendar
     * @param {Object} message - { url: string }
     */
    [MESSAGE_TYPES.ADD_CALENDAR]: async (message) => {
        await addCalendar(message.url);
        return { success: true };
    },

    /**
     * Handle force update of all calendars
     */
    [MESSAGE_TYPES.FORCE_UPDATE]: async () => {
        await updateAllCalendars();
        return { success: true };
    },

    /**
     * Handle settings update
     * @param {Object} message - { settings: { refreshInterval: number } }
     */
    [MESSAGE_TYPES.UPDATE_SETTINGS]: async (message) => {
        await storage.setSettings(message.settings);
        chrome.alarms.clear(ALARM_NAME);
        chrome.alarms.create(ALARM_NAME, { 
            periodInMinutes: parseInt(message.settings.refreshInterval) 
        });
        return { success: true };
    },

    /**
     * Handle clearing new article counts
     */
    [MESSAGE_TYPES.CLEAR_NEW_COUNTS]: async () => {
        await clearNewArticleCounts();
        return { success: true };
    }
};

/**
 * Main message listener
 * Routes messages to appropriate handlers
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            const handler = messageHandlers[message.type];
            if (handler) {
                const response = await handler(message);
                sendResponse(response);
            } else {
                console.warn(`Unknown message type: ${message.type}`);
                sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (e) {
            console.error('Message handler error:', e);
            sendResponse({ success: false, error: e.message });
        }
    })();
    return true; // Keep channel open for async response
});

// =============================================================================
// Calendar Operations
// =============================================================================

/**
 * Fetch and parse calendar data from URL
 * @param {string} url - Calendar URL
 * @returns {Promise<Object>} - { title, articles, platform }
 */
async function fetchCalendarData(url) {
    const response = await fetch(url);
    const html = await response.text();
    const data = parser.parseAdventar(html);
    data.platform = 'adventar';
    return data;
}

/**
 * Add a new calendar subscription
 * @param {string} url - Calendar URL to add
 */
async function addCalendar(url) {
    const data = await fetchCalendarData(url);
    const calendar = {
        id: crypto.randomUUID(),
        url: url,
        title: data.title,
        platform: data.platform,
        articles: data.articles,
        lastUpdated: new Date().toISOString(),
        newCount: 0
    };
    await storage.addCalendar(calendar);
    updateBadge();
}

/**
 * Update all subscribed calendars
 * Checks for new articles and updates badge
 */
async function updateAllCalendars() {
    const calendars = await storage.getCalendars();
    let totalNewArticles = 0;
    
    for (const calendar of calendars) {
        try {
            const newCount = await updateSingleCalendar(calendar);
            totalNewArticles += newCount;
        } catch (e) {
            console.error(`Failed to update ${calendar.url}`, e);
        }
    }
    
    updateBadge(totalNewArticles);
}

/**
 * Update a single calendar
 * @param {Object} calendar - Calendar object to update
 * @returns {Promise<number>} - Number of new articles found
 */
async function updateSingleCalendar(calendar) {
    const data = await fetchCalendarData(calendar.url);
    
    // Detect new articles
    const currentArticleUrls = new Set(calendar.articles.map(a => a.url));
    const newArticles = data.articles.filter(a => !currentArticleUrls.has(a.url));
    
    // Update calendar in storage
    const updatedCalendar = {
        ...calendar,
        title: data.title,
        articles: data.articles,
        lastUpdated: new Date().toISOString(),
        newCount: (calendar.newCount || 0) + newArticles.length
    };
    
    await storage.updateCalendar(updatedCalendar);
    
    return newArticles.length;
}

/**
 * Clear new article counts for all calendars
 */
async function clearNewArticleCounts() {
    const calendars = await storage.getCalendars();
    
    for (const calendar of calendars) {
        if (calendar.newCount > 0) {
            calendar.newCount = 0;
            await storage.updateCalendar(calendar);
        }
    }
    
    chrome.action.setBadgeText({ text: '' });
}

// =============================================================================
// Badge Operations
// =============================================================================

/**
 * Update extension badge with new article count
 * @param {number} [count=0] - Number of new articles
 */
function updateBadge(count = 0) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#F00' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

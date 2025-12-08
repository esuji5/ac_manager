import { storage } from '../utils/storage.js';
import { parser } from '../utils/parser.js';

const ALARM_NAME = 'PERIODIC_UPDATE';

// Initialize alarm on install
chrome.runtime.onInstalled.addListener(async () => {
    console.log('AC Manager Installed');
    const settings = await storage.getSettings();
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: settings.refreshInterval });
});

// Handle Alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('Periodic update triggered');
        await updateAllCalendars();
    }
});

// Handle Messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            if (message.type === 'ADD_CALENDAR') {
                await addCalendar(message.url);
                sendResponse({ success: true });
            } else if (message.type === 'FORCE_UPDATE') {
                await updateAllCalendars();
                sendResponse({ success: true });
            } else if (message.type === 'UPDATE_SETTINGS') {
                await storage.setSettings(message.settings);
                // Reset alarm
                chrome.alarms.clear(ALARM_NAME);
                chrome.alarms.create(ALARM_NAME, { periodInMinutes: parseInt(message.settings.refreshInterval) });
                sendResponse({ success: true });
            } else if (message.type === 'CLEAR_NEW_COUNTS') {
                // Clear new article counts on all calendars
                const calendars = await storage.getCalendars();
                for (const cal of calendars) {
                    if (cal.newCount > 0) {
                        cal.newCount = 0;
                        await storage.updateCalendar(cal);
                    }
                }
                // Clear badge
                chrome.action.setBadgeText({ text: '' });
                sendResponse({ success: true });
            }
        } catch (e) {
            console.error(e);
            sendResponse({ success: false, error: e.message });
        }
    })();
    return true; // Keep channel open for async response
});

/**
 * Fetch and parse a calendar
 * @param {string} url 
 */
async function fetchCalendarData(url) {
    const response = await fetch(url);
    const html = await response.text();
    
    const data = parser.parseAdventar(html);
    data.platform = 'adventar';
    
    return data;
}

/**
 * Add a new calendar
 * @param {string} url 
 */
async function addCalendar(url) {
    const data = await fetchCalendarData(url);
    const calendar = {
        id: crypto.randomUUID(),
        url: url,
        title: data.title,
        platform: data.platform,
        articles: data.articles,
        lastUpdated: new Date().toISOString()
    };
    await storage.addCalendar(calendar);
    updateBadge();
}


/**
 * Update all calendars
 */
async function updateAllCalendars() {
    const calendars = await storage.getCalendars();
    let totalNewArticles = 0;
    
    for (const calendar of calendars) {
        try {
            const data = await fetchCalendarData(calendar.url);
            
            // Check for new articles
            const currentArticleUrls = new Set(calendar.articles.map(a => a.url));
            const newArticles = data.articles.filter(a => !currentArticleUrls.has(a.url));
            
            if (newArticles.length > 0) {
                 totalNewArticles += newArticles.length;
            }
            
            // Always update to latest state
            const updatedCalendar = {
                ...calendar,
                title: data.title, 
                articles: data.articles,
                lastUpdated: new Date().toISOString(),
                newCount: (calendar.newCount || 0) + newArticles.length
            };
            
            await storage.updateCalendar(updatedCalendar);
        } catch (e) {
            console.error(`Failed to update ${calendar.url}`, e);
        }
    }
    
    // Update badge with total new articles found in this session
    // Ideally we track "unread", but for now showing "New" count is good.
    // If 0, clear badge.
    updateBadge(totalNewArticles);
}

async function updateBadge(count) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#F00' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

import { storage } from '../utils/storage.js';
import { sanitize } from '../utils/sanitize.js';
import { icons } from '../utils/icons.js';

// =============================================================================
// Constants
// =============================================================================

const MESSAGES = {
    ADD_CALENDAR: 'ADD_CALENDAR',
    FORCE_UPDATE: 'FORCE_UPDATE',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    CLEAR_NEW_COUNTS: 'CLEAR_NEW_COUNTS'
};

const UI_TEXT = {
    ADD_BUTTON: 'Add',
    ADDING: 'Adding...',
    UPDATING: 'Updating...',
    FORCE_UPDATE: 'Force Update All',
    NO_FAVORITES: 'No favorites yet.',
    ADD_ERROR: 'Failed to add calendar. Check URL.',
    SETTINGS_SAVED: 'Settings Saved',
    CONFIRM_REMOVE: (title) => `Remove calendar "${title}"?`
};

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    calendarsList: document.getElementById('calendars-list'),
    favoritesList: document.getElementById('favorites-list'),
    addCalendarBtn: document.getElementById('add-calendar-btn'),
    calendarUrlInput: document.getElementById('calendar-url'),
    calendarDetails: document.getElementById('calendar-details'),
    backBtn: document.getElementById('back-btn'),
    detailsTitle: document.getElementById('details-title'),
    articlesList: document.getElementById('articles-list'),
    forceUpdateBtn: document.getElementById('force-update-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    refreshIntervalInput: document.getElementById('refresh-interval')
};

// =============================================================================
// State
// =============================================================================

let currentCalendars = [];
let currentFavorites = [];

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    await chrome.runtime.sendMessage({ type: MESSAGES.CLEAR_NEW_COUNTS });
});

// =============================================================================
// Data Management
// =============================================================================

/**
 * Load calendars, favorites, and settings from storage
 */
async function loadData() {
    currentCalendars = await storage.getCalendars();
    currentFavorites = await storage.getFavorites();
    const settings = await storage.getSettings();
    
    elements.refreshIntervalInput.value = settings.refreshInterval;
    
    renderCalendars();
    renderFavorites();
}

// =============================================================================
// Event Handlers
// =============================================================================

function setupEventListeners() {
    setupTabNavigation();
    setupAddCalendar();
    setupBackButton();
    setupForceUpdate();
    setupSaveSettings();
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

/**
 * Setup add calendar button
 */
function setupAddCalendar() {
    elements.addCalendarBtn.addEventListener('click', async () => {
        const url = elements.calendarUrlInput.value.trim();
        if (!url) return;
        
        setButtonLoading(elements.addCalendarBtn, true, UI_TEXT.ADDING);
        
        try {
            await chrome.runtime.sendMessage({ type: MESSAGES.ADD_CALENDAR, url });
            elements.calendarUrlInput.value = '';
            await loadData();
        } catch (e) {
            alert(UI_TEXT.ADD_ERROR);
            console.error(e);
        } finally {
            setButtonLoading(elements.addCalendarBtn, false, UI_TEXT.ADD_BUTTON);
        }
    });
}

/**
 * Setup back button in details view
 */
function setupBackButton() {
    elements.backBtn.addEventListener('click', () => {
        elements.calendarDetails.classList.add('hidden');
    });
}

/**
 * Setup force update button
 */
function setupForceUpdate() {
    elements.forceUpdateBtn.addEventListener('click', async () => {
        elements.forceUpdateBtn.textContent = UI_TEXT.UPDATING;
        await chrome.runtime.sendMessage({ type: MESSAGES.FORCE_UPDATE });
        await loadData();
        elements.forceUpdateBtn.textContent = UI_TEXT.FORCE_UPDATE;
    });
}

/**
 * Setup save settings button
 */
function setupSaveSettings() {
    elements.saveSettingsBtn.addEventListener('click', async () => {
        const settings = { 
            refreshInterval: parseInt(elements.refreshIntervalInput.value) || 60 
        };
        await chrome.runtime.sendMessage({ type: MESSAGES.UPDATE_SETTINGS, settings });
        alert(UI_TEXT.SETTINGS_SAVED);
    });
}

// =============================================================================
// UI Helpers
// =============================================================================

/**
 * Set button loading state
 * @param {HTMLButtonElement} button 
 * @param {boolean} isLoading 
 * @param {string} text 
 */
function setButtonLoading(button, isLoading, text) {
    button.disabled = isLoading;
    button.textContent = text;
}

/**
 * Create HTML element from template string
 * @param {string} html 
 * @returns {HTMLElement}
 */
function createElementFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

// =============================================================================
// Template Functions
// =============================================================================

/**
 * Create calendar card HTML
 * @param {Object} calendar 
 * @returns {string}
 */
function createCalendarCardHTML(calendar) {
    const newBadge = calendar.newCount > 0 
        ? `<span class="new-badge">${calendar.newCount}</span>` 
        : '';
    
    // Mitigate XSS by escaping title
    const safeTitle = sanitize.escapeHTML(calendar.title);
    
    return `
        <div class="calendar-card">
            <div class="card-header">
                <h3>${safeTitle}${newBadge}</h3>
                <button class="delete-btn" title="Remove Calendar">
                    ${icons.TRASH}
                </button>
            </div>
            <div class="meta">
                <span class="badge ${calendar.platform}">${calendar.platform}</span>
                <span>Last updated: ${new Date(calendar.lastUpdated).toLocaleTimeString()}</span>
            </div>
        </div>
    `;
}

/**
 * Create favorite card HTML
 * @param {Object} favorite 
 * @returns {string}
 */
function createFavoriteCardHTML(favorite) {
    const safeTitle = sanitize.escapeHTML(favorite.title);
    const safeAuthor = sanitize.escapeHTML(favorite.author);
    
    return `
        <div class="article-card">
            <h4><a href="${favorite.url}" target="_blank">${safeTitle}</a></h4>
            <div class="meta">
                <span>${favorite.date} - ${safeAuthor}</span>
                <span class="remove-fav">&times;</span>
            </div>
        </div>
    `;
}

/**
 * Create article row HTML
 * @param {Object} article 
 * @param {boolean} isFavorite 
 * @returns {string}
 */
function createArticleRowHTML(article, isFavorite) {
    const authorIcon = article.icon 
        ? `<img src="${article.icon}" class="author-icon">` 
        : '';
    
    // Escape risky fields (Parser strips tags but extra safety is good)
    const safeTitle = sanitize.escapeHTML(article.title || article.url);
    const safeAuthor = sanitize.escapeHTML(article.author);
    const safeDate = sanitize.escapeHTML(article.date);
    
    return `
        <div class="article-row">
            <div class="article-info">
                <div class="article-date">${safeDate}</div>
                <div class="article-link">
                    <a href="${article.url}" target="_blank">${safeTitle}</a>
                </div>
                <div class="article-author">
                    ${authorIcon}
                    <span>${safeAuthor}</span>
                </div>
            </div>
            <button class="fav-btn ${isFavorite ? 'active' : ''}">
                ${isFavorite ? icons.STAR_FILLED : icons.STAR_OUTLINE}
            </button>
        </div>
    `;
}

// =============================================================================
// Render Functions
// =============================================================================

/**
 * Render calendar list
 */
function renderCalendars() {
    elements.calendarsList.innerHTML = '';
    
    currentCalendars.forEach(calendar => {
        const el = createElementFromHTML(createCalendarCardHTML(calendar));
        
        // Click to show details
        el.addEventListener('click', () => showDetails(calendar));
        
        // Delete button handler
        const deleteBtn = el.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            // sanitize not needed for confirm() but good practice if used in HTML
            // confirm() shows plain text
            if (confirm(UI_TEXT.CONFIRM_REMOVE(calendar.title))) {
                await storage.removeCalendar(calendar.id);
                await loadData();
            }
        });
        
        elements.calendarsList.appendChild(el);
    });
}

/**
 * Render favorites list
 */
function renderFavorites() {
    elements.favoritesList.innerHTML = '';
    
    if (currentFavorites.length === 0) {
        elements.favoritesList.innerHTML = `<p class="empty-message">${UI_TEXT.NO_FAVORITES}</p>`;
        return;
    }

    currentFavorites.forEach(favorite => {
        const el = createElementFromHTML(createFavoriteCardHTML(favorite));
        
        el.querySelector('.remove-fav').addEventListener('click', async (e) => {
            e.stopPropagation();
            await storage.removeFavorite(favorite.url);
            await loadData();
        });
        
        elements.favoritesList.appendChild(el);
    });
}

/**
 * Show calendar details with articles
 * @param {Object} calendar 
 */
function showDetails(calendar) {
    const safeTitle = sanitize.escapeHTML(calendar.title);
    
    elements.detailsTitle.innerHTML = `
        <a href="${calendar.url}" target="_blank" class="details-title-link">
            ${safeTitle} 
            <span class="external-link-icon">${icons.EXTERNAL_LINK}</span>
        </a>
    `;
    
    elements.articlesList.innerHTML = '';
    
    calendar.articles.forEach(article => {
        const isFavorite = currentFavorites.some(f => f.url === article.url);
        const row = createElementFromHTML(createArticleRowHTML(article, isFavorite));
        
        row.querySelector('.fav-btn').addEventListener('click', async function() {
            // Toggle logic
            const willBeActive = !this.classList.contains('active');
            
            if (!willBeActive) {
                await storage.removeFavorite(article.url);
                this.classList.remove('active');
                this.innerHTML = icons.STAR_OUTLINE;
            } else {
                await storage.addFavorite({
                    ...article,
                    calendarTitle: calendar.title
                });
                this.classList.add('active');
                this.innerHTML = icons.STAR_FILLED;
            }
            
            // Refresh local state without full reload
            currentFavorites = await storage.getFavorites();
            renderFavorites();
        });
        
        elements.articlesList.appendChild(row);
    });
    
    elements.calendarDetails.classList.remove('hidden');
}

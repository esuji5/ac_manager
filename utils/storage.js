/**
 * Storage Utility
 * Manages calendars, favorites, and settings using chrome.storage.local
 */

const STORAGE_KEYS = {
  CALENDARS: 'calendars',
  FAVORITES: 'favorites',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  refreshInterval: 60 // minutes
};

export const storage = {
  /**
   * Get all subscribed calendars
   * @returns {Promise<Array>}
   */
  async getCalendars() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CALENDARS);
    return data[STORAGE_KEYS.CALENDARS] || [];
  },

  /**
   * Add a new calendar
   * @param {Object} calendar - { id, url, title, platform, articles: [] }
   */
  async addCalendar(calendar) {
    const calendars = await this.getCalendars();
    if (calendars.some(c => c.url === calendar.url)) {
      return; // Already exists
    }
    calendars.push(calendar);
    await chrome.storage.local.set({ [STORAGE_KEYS.CALENDARS]: calendars });
  },

  /**
   * Update a calendar (e.g. with new articles)
   * @param {Object} updatedCalendar 
   */
  async updateCalendar(updatedCalendar) {
    const calendars = await this.getCalendars();
    const index = calendars.findIndex(c => c.id === updatedCalendar.id);
    if (index !== -1) {
      calendars[index] = updatedCalendar;
      await chrome.storage.local.set({ [STORAGE_KEYS.CALENDARS]: calendars });
    }
  },

  /**
   * Remove a calendar by ID
   * @param {string} id 
   */
  async removeCalendar(id) {
    const calendars = await this.getCalendars();
    const newCalendars = calendars.filter(c => c.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.CALENDARS]: newCalendars });
  },

  /**
   * Get all favorites
   * @returns {Promise<Array>}
   */
  async getFavorites() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.FAVORITES);
    return data[STORAGE_KEYS.FAVORITES] || [];
  },

  /**
   * Add a favorite article
   * @param {Object} article - { url, title, date, calendarTitle }
   */
  async addFavorite(article) {
    const favorites = await this.getFavorites();
    if (favorites.some(f => f.url === article.url)) {
      return;
    }
    favorites.push(article);
    await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: favorites });
  },

  /**
   * Remove a favorite by URL
   * @param {string} url 
   */
  async removeFavorite(url) {
    const favorites = await this.getFavorites();
    const newFavorites = favorites.filter(f => f.url !== url);
    await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: newFavorites });
  },

  /**
   * Get settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...data[STORAGE_KEYS.SETTINGS] };
  },

  /**
   * Update settings
   * @param {Object} newSettings 
   */
  async setSettings(newSettings) {
    const current = await this.getSettings();
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.SETTINGS]: { ...current, ...newSettings } 
    });
  }
};

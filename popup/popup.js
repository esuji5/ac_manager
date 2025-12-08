import { storage } from '../utils/storage.js';

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const calendarsList = document.getElementById('calendars-list');
const favoritesList = document.getElementById('favorites-list');
const addCalendarBtn = document.getElementById('add-calendar-btn');
const calendarUrlInput = document.getElementById('calendar-url');
const calendarDetails = document.getElementById('calendar-details');
const backBtn = document.getElementById('back-btn');
const detailsTitle = document.getElementById('details-title');
const articlesList = document.getElementById('articles-list');
const forceUpdateBtn = document.getElementById('force-update-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const refreshIntervalInput = document.getElementById('refresh-interval');

// State
let currentCalendars = [];
let currentFavorites = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    // Clear new article counts when popup is opened
    await chrome.runtime.sendMessage({ type: 'CLEAR_NEW_COUNTS' });
});

async function loadData() {
    currentCalendars = await storage.getCalendars();
    currentFavorites = await storage.getFavorites();
    const settings = await storage.getSettings();
    
    refreshIntervalInput.value = settings.refreshInterval;
    
    renderCalendars();
    renderFavorites();
}

function setupEventListeners() {
    // Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Add Calendar
    addCalendarBtn.addEventListener('click', async () => {
        const url = calendarUrlInput.value.trim();
        if (!url) return;
        
        addCalendarBtn.disabled = true;
        addCalendarBtn.textContent = 'Adding...';
        
        try {
            await chrome.runtime.sendMessage({ type: 'ADD_CALENDAR', url });
            calendarUrlInput.value = '';
            await loadData();
        } catch (e) {
            alert('Failed to add calendar. Check URL.');
            console.error(e);
        } finally {
            addCalendarBtn.disabled = false;
            addCalendarBtn.textContent = 'Add';
        }
    });

    // Back from details
    backBtn.addEventListener('click', () => {
        calendarDetails.classList.add('hidden');
    });

    // Force Update
    forceUpdateBtn.addEventListener('click', async () => {
        forceUpdateBtn.textContent = 'Updating...';
        await chrome.runtime.sendMessage({ type: 'FORCE_UPDATE' });
        await loadData();
        forceUpdateBtn.textContent = 'Force Update All';
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', async () => {
        const settings = { refreshInterval: parseInt(refreshIntervalInput.value) || 60 };
        await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
        alert('Settings Saved');
    });
}

function renderCalendars() {
    calendarsList.innerHTML = '';
    currentCalendars.forEach(cal => {
        const el = document.createElement('div');
        el.className = 'calendar-card';
        el.innerHTML = `
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0;">
                    ${cal.title}
                    ${cal.newCount > 0 ? `<span class="new-badge">${cal.newCount}</span>` : ''}
                </h3>
                <button class="delete-cal-btn" style="background:none; border:none; color:#dc3545; cursor:pointer;" title="Remove Calendar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="meta">
                <span class="badge ${cal.platform}">${cal.platform}</span>
                <span>Last updated: ${new Date(cal.lastUpdated).toLocaleTimeString()}</span>
            </div>
        `;
        
        el.addEventListener('click', () => showDetails(cal));
        
        // Delete handler
        const deleteBtn = el.querySelector('.delete-cal-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Remove calendar "${cal.title}"?`)) {
                await storage.removeCalendar(cal.id);
                await loadData();
            }
        });
        
        calendarsList.appendChild(el);
    });
}

function renderFavorites() {
    favoritesList.innerHTML = '';
    
    if (currentFavorites.length === 0) {
        favoritesList.innerHTML = '<p style="text-align:center; color:#777;">No favorites yet.</p>';
        return;
    }

    currentFavorites.forEach(fav => {
        const el = document.createElement('div');
        el.className = 'article-card';
        el.innerHTML = `
            <h4><a href="${fav.url}" target="_blank">${fav.title}</a></h4>
            <div class="meta">
                <span>${fav.date} - ${fav.author}</span>
                <span class="remove-fav" style="cursor:pointer; color:red;">&times;</span>
            </div>
        `;
        el.querySelector('.remove-fav').addEventListener('click', async (e) => {
            e.stopPropagation();
            await storage.removeFavorite(fav.url);
            await loadData();
        });
        favoritesList.appendChild(el);
    });
}

function showDetails(calendar) {
    detailsTitle.innerHTML = `<a href="${calendar.url}" target="_blank" style="text-decoration:none; color:inherit;">${calendar.title} <i class="fas fa-external-link-alt" style="font-size:12px; color:#00c4cc;"></i></a>`;
    articlesList.innerHTML = '';
    
    calendar.articles.forEach(article => {
        const isFav = currentFavorites.some(f => f.url === article.url);
        const row = document.createElement('div');
        row.className = 'article-row';
        row.innerHTML = `
            <div class="article-info">
                <div style="font-weight:bold; font-size:12px; color:#555; display:flex; align-items:center;">
                    <span>${article.date}</span>
                </div>
                <div style="margin:2px 0;"><a href="${article.url}" target="_blank" style="text-decoration:none; color:#0366d6;">${article.title || article.url}</a></div>
                <div style="font-size:11px; color:#888; display:flex; align-items:center;">
                    ${article.icon ? `<img src="${article.icon}" style="width:16px; height:16px; border-radius:50%; margin-right:4px;">` : ''}
                    <span>${article.author}</span>
                </div>
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}">
                <i class="fas fa-star"></i>
            </button>
        `;
        
        row.querySelector('.fav-btn').addEventListener('click', async function() {
            const btn = this;
            if (btn.classList.contains('active')) {
                await storage.removeFavorite(article.url);
                btn.classList.remove('active');
            } else {
                await storage.addFavorite({
                    ...article,
                    calendarTitle: calendar.title
                });
                btn.classList.add('active');
            }
            // Refresh local state without full reload to prevent UI jump
            currentFavorites = await storage.getFavorites();
            renderFavorites(); // Update bg tab if visible or just state
        });
        
        articlesList.appendChild(row);
    });
    
    calendarDetails.classList.remove('hidden');
}

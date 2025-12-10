/**
 * Adventar Content Script
 * Injects a subscribe button on Adventar calendar pages
 */

// =============================================================================
// Configuration
// =============================================================================

const DEBUG = false;

const BUTTON_CONFIG = {
    ID: 'ac-manager-subscribe',
    POLL_INTERVAL_MS: 2000,
    REMOVE_DELAY_MS: 2000
};

const BUTTON_TEXT = {
    SUBSCRIBE: 'Subscribe to AC Manager',
    SUBSCRIBING: 'Subscribing...',
    SUBSCRIBED: 'Subscribed!',
    FAILED: 'Failed'
};

const BUTTON_STYLES = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '9999',
    padding: '10px 20px',
    backgroundColor: '#00c4cc',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'background-color 0.2s'
};

const BUTTON_COLORS = {
    PRIMARY: '#00c4cc',
    SUCCESS: '#ccc',
    ERROR: 'red'
};

// =============================================================================
// Logging
// =============================================================================

/**
 * Log message if debug mode is enabled
 * @param {string} message 
 */
function debugLog(message) {
    if (DEBUG) {
        console.log(`[AC Manager] ${message}`);
    }
}

// =============================================================================
// Button Creation
// =============================================================================

/**
 * Create subscribe button element
 * @returns {HTMLButtonElement}
 */
function createButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_CONFIG.ID;
    btn.textContent = BUTTON_TEXT.SUBSCRIBE;
    
    // Apply styles
    Object.assign(btn.style, BUTTON_STYLES);
    
    // Add hover effect
    btn.addEventListener('mouseenter', () => {
        btn.style.opacity = '0.9';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.opacity = '1';
    });
    
    return btn;
}

/**
 * Handle subscribe button click
 * @param {HTMLButtonElement} btn 
 */
function handleSubscribeClick(btn) {
    btn.textContent = BUTTON_TEXT.SUBSCRIBING;
    btn.disabled = true;
    
    chrome.runtime.sendMessage({
        type: 'ADD_CALENDAR',
        url: window.location.href
    }, (response) => {
        if (response && response.success) {
            showSuccessState(btn);
        } else {
            showErrorState(btn);
        }
    });
}

/**
 * Show success state and remove button
 * @param {HTMLButtonElement} btn 
 */
function showSuccessState(btn) {
    btn.textContent = BUTTON_TEXT.SUBSCRIBED;
    btn.style.backgroundColor = BUTTON_COLORS.SUCCESS;
    
    setTimeout(() => {
        btn.remove();
    }, BUTTON_CONFIG.REMOVE_DELAY_MS);
}

/**
 * Show error state
 * @param {HTMLButtonElement} btn 
 */
function showErrorState(btn) {
    btn.textContent = BUTTON_TEXT.FAILED;
    btn.style.backgroundColor = BUTTON_COLORS.ERROR;
    btn.disabled = false;
}

// =============================================================================
// Button Injection
// =============================================================================

/**
 * Inject subscribe button into page
 * Only injects if header exists and button doesn't already exist
 */
function injectButton() {
    const header = document.querySelector('header');
    if (!header) return;
    
    // Don't inject if already exists
    if (document.getElementById(BUTTON_CONFIG.ID)) return;
    
    const btn = createButton();
    btn.addEventListener('click', () => handleSubscribeClick(btn));
    document.body.appendChild(btn);
    
    debugLog('Subscribe button injected');
}

// =============================================================================
// Initialization
// =============================================================================

debugLog('Content script active');

// Initial injection
injectButton();

// Poll for SPA navigation changes
// Adventar is a SPA, so the header may be recreated on navigation
setInterval(injectButton, BUTTON_CONFIG.POLL_INTERVAL_MS);

console.log("AC Manager Adventar Script Active");

function injectButton() {
    const header = document.querySelector('header');
    if (!header || document.getElementById('ac-manager-subscribe')) return;

    const btn = document.createElement('button');
    btn.id = 'ac-manager-subscribe';
    btn.textContent = 'Subscribe to AC Manager';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 20px;
        background-color: #00c4cc;
        color: white;
        border: none;
        border-radius: 20px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    btn.addEventListener('click', () => {
        btn.textContent = 'Subscribing...';
        chrome.runtime.sendMessage({
            type: 'ADD_CALENDAR',
            url: window.location.href
        }, (response) => {
            if (response && response.success) {
                btn.textContent = 'Subscribed!';
                btn.style.backgroundColor = '#ccc';
                setTimeout(() => btn.remove(), 2000);
            } else {
                btn.textContent = 'Failed';
                btn.style.backgroundColor = 'red';
            }
        });
    });

    document.body.appendChild(btn);
}

// Simple polling for SPA changes or just run once?
// Adventar is SPA, so we might need MutationObserver or just interval check
setInterval(injectButton, 2000);
injectButton();

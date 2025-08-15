// Global listener for URL changes from browser iframes
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'browser-url-change') {
        const { url, sessionId, pageId } = event.data;
        const winBody = document.querySelector(`.window-body[data-session-id='${sessionId}']`);
        if (winBody) {
            const addressBar = winBody.querySelector('.address-bar');
            const tabEl = winBody.querySelector(`.browser-tab[data-page-id='${pageId}']`);

            if (tabEl) {
                // Update tab title (e.g., with the domain name)
                try {
                    const urlObject = new URL(url);
                    const title = urlObject.hostname.replace('www.', '');
                    tabEl.querySelector('span').textContent = title;
                } catch (e) {
                    tabEl.querySelector('span').textContent = 'New Tab';
                }
            }

            // Update address bar only if the message is from the active tab
            if (tabEl && tabEl.classList.contains('active')) {
                if (document.activeElement !== addressBar) {
                    addressBar.value = url;
                }
            }
        }
    }
});

function createBrowserWindow() {
    const appId = 'browser';
    const title = 'Browser';
    // New HTML structure with a tab bar
    const content = `
        <div class="w-full h-full flex flex-col bg-gray-200">
            <div class="bg-gray-300 p-1 flex items-center border-b border-gray-400">
                <div class="flex-grow h-8 flex items-center overflow-x-auto" id="browser-tabs-container">
                    <!-- Tabs will be dynamically inserted here -->
                </div>
                <button class="add-tab-btn bg-gray-400 hover:bg-gray-500 text-white font-bold w-8 h-8 rounded-full ml-1 flex-shrink-0">+</button>
            </div>
            <div class="bg-gray-100 p-1 flex items-center">
                <input type="text" class="address-bar flex-grow bg-white text-black rounded-full px-4 py-1 border border-gray-300">
                <button class="go-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-full ml-1">Go</button>
            </div>
            <div class="browser-content flex-grow relative bg-white">
                <!-- iFrames will be dynamically inserted here -->
            </div>
            <div class="loading-overlay hidden absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                <p class="text-white text-lg">Loading...</p>
            </div>
        </div>
    `;

    const winBody = createWindow(appId, title, content, { width: 1024, height: 768 });
    if (!winBody) return;

    const addressBar = winBody.querySelector('.address-bar');
    const goBtn = winBody.querySelector('.go-btn');
    const addTabBtn = winBody.querySelector('.add-tab-btn');
    const tabsContainer = winBody.querySelector('#browser-tabs-container');
    const browserContent = winBody.querySelector('.browser-content');
    const loadingOverlay = winBody.querySelector('.loading-overlay');

    let sessionId = null;
    let tabsState = {
        activePageId: null,
        pages: new Map() // pageId -> { iframe, tabEl }
    };

    function switchTab(pageId) {
        if (!tabsState.pages.has(pageId)) return;

        tabsState.activePageId = pageId;

        // Update tabs
        tabsContainer.querySelectorAll('.browser-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.pageId === pageId);
        });

        // Update iframes
        browserContent.querySelectorAll('iframe').forEach(iframe => {
            iframe.classList.toggle('hidden', iframe.dataset.pageId !== pageId);
        });

        // Update address bar
        const activePage = tabsState.pages.get(pageId);
        if (activePage && activePage.iframe.src !== 'about:blank') {
            // The postMessage listener will handle the final URL update
        } else {
            addressBar.value = '';
        }
        addressBar.focus();
    }

    async function closeTab(pageId) {
        if (!tabsState.pages.has(pageId)) return;

        // Send request to backend to close the page
        await fetch(`/api/browser/${sessionId}/pages/${pageId}`, { method: 'DELETE', credentials: 'include' });

        const { iframe, tabEl } = tabsState.pages.get(pageId);
        iframe.remove();
        tabEl.remove();
        tabsState.pages.delete(pageId);

        // If the closed tab was active, switch to another tab
        if (tabsState.activePageId === pageId) {
            if (tabsState.pages.size > 0) {
                const lastPageId = Array.from(tabsState.pages.keys()).pop();
                switchTab(lastPageId);
            } else {
                // All tabs are closed, close the window
                const win = winBody.closest('.app-window');
                win.remove(); // This will trigger the cleanup observer
            }
        }
    }

    async function addTab(pageId, makeActive = true) {
        const tabEl = document.createElement('div');
        tabEl.className = 'browser-tab bg-gray-200 text-black px-4 py-1 rounded-t-lg mr-1 flex items-center cursor-pointer';
        tabEl.dataset.pageId = pageId;
        tabEl.innerHTML = `
            <span class="truncate">New Tab</span>
            <button class="close-tab-btn ml-2 text-xs font-bold">x</button>
        `;
        tabsContainer.appendChild(tabEl);

        const iframe = document.createElement('iframe');
        iframe.className = 'w-full h-full border-0 hidden';
        iframe.dataset.pageId = pageId;
        iframe.src = 'about:blank';
        browserContent.appendChild(iframe);

        tabsState.pages.set(pageId, { iframe, tabEl });

        tabEl.addEventListener('click', () => switchTab(pageId));
        tabEl.querySelector('.close-tab-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(pageId);
        });

        if (makeActive) {
            switchTab(pageId);
        }
    }

    async function navigate() {
        if (!sessionId || !tabsState.activePageId) return;
        const activePageId = tabsState.activePageId;
        const { iframe } = tabsState.pages.get(activePageId);

        let userInput = addressBar.value.trim();
        if (!userInput) return;

        let url;
        let isSearch = false;

        if (!userInput.match(/^https?:\/\//)) {
            if (userInput.includes('.') && !userInput.includes(' ')) {
                url = 'https://' + userInput;
            } else {
                url = `https://www.google.com/search?q=${encodeURIComponent(userInput)}`;
                isSearch = true;
            }
        } else {
            url = userInput;
        }

        loadingOverlay.classList.remove('hidden');
        iframe.src = 'about:blank';

        try {
            const navResponse = await fetch(`/api/browser/${sessionId}/pages/${activePageId}/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                credentials: 'include'
            });

            if (!navResponse.ok) throw new Error('Navigation request failed');
            const navResult = await navResponse.json();
            if (navResult.error) throw new Error(navResult.error);

            if (!isSearch) {
                addressBar.value = navResult.final_url || url;
            }

            iframe.src = `/api/browser/${sessionId}/pages/${activePageId}/view`;
            iframe.onload = () => loadingOverlay.classList.add('hidden');
            iframe.onerror = () => {
                loadingOverlay.classList.add('hidden');
                showNotification('Failed to load page content.', 'error');
            };
        } catch (error) {
            loadingOverlay.classList.add('hidden');
            showNotification(`Navigation failed: ${error.message}`, 'error');
        }
    }

    async function initBrowser() {
        try {
            const response = await fetch('/api/browser', { method: 'POST', credentials: 'include' });
            if (!response.ok) throw new Error('Failed to start browser session');

            const data = await response.json();
            sessionId = data.session_id;
            winBody.dataset.sessionId = sessionId;

            // Clear any existing tabs/iframes from previous sessions if any
            tabsContainer.innerHTML = '';
            browserContent.innerHTML = '';
            tabsState.pages.clear();

            addTab(data.page_id, true);

        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
            winBody.closest('.app-window').remove();
        }
    }

    addTabBtn.addEventListener('click', async () => {
        const response = await fetch(`/api/browser/${sessionId}/pages`, { method: 'POST', credentials: 'include' });
        const data = await response.json();
        if (data.page_id) {
            addTab(data.page_id, true);
        }
    });

    goBtn.addEventListener('click', navigate);
    addressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate();
    });

    const win = winBody.closest('.app-window');
    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            if (sessionId) {
                navigator.sendBeacon(`/api/browser/${sessionId}`, JSON.stringify({}), { type: 'application/json', keepalive: true });
            }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    initBrowser();
}

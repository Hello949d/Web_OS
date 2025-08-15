function createBrowserWindow() {
    const appId = 'browser';
    const title = 'Browser';
    const content = `
        <div class="w-full h-full flex flex-col bg-gray-200">
            <!-- Tab Bar -->
            <div class="bg-gray-300 flex items-center" id="tab-bar">
                <div class="tab bg-gray-200 p-2 flex-grow border-r border-gray-400">
                    <span class="tab-title">New Tab</span>
                    <button class="close-tab-btn ml-2">x</button>
                </div>
                <button id="new-tab-btn" class="p-2">+</button>
            </div>
            <!-- Address Bar -->
            <div class="bg-gray-100 p-1 flex items-center">
                <input type="text" class="address-bar flex-grow bg-white rounded px-2 py-1" placeholder="https://...">
                <input type="text" class="search-bar bg-white rounded px-2 py-1 ml-2" placeholder="Search Google...">
            </div>
            <!-- Browser View -->
            <div class="browser-view flex-grow relative">
                <iframe class="browser-iframe w-full h-full border-0"></iframe>
                <div class="loading-overlay hidden absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center">
                    <p class="text-white">Loading...</p>
                </div>
            </div>
        </div>
    `;

    const winBody = createWindow(appId, title, content, { width: 1024, height: 768 });
    if (!winBody) return; // Window already open, it was focused instead

    const addressBar = winBody.querySelector('.address-bar');
    const searchBar = winBody.querySelector('.search-bar');
    const browserIframe = winBody.querySelector('.browser-iframe');
    const loadingOverlay = winBody.querySelector('.loading-overlay');
    const tabBar = winBody.querySelector('#tab-bar');
    const newTabBtn = winBody.querySelector('#new-tab-btn');

    let sessionId = null;
    let tabs = [];
    let activeTab = null;

    async function initBrowser() {
        try {
            const response = await fetch('/api/browser', { method: 'POST', credentials: 'include' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start browser session');
            }
            const data = await response.json();
            sessionId = data.session_id;
            createNewTab();
        } catch (error) {
            console.error('Failed to start browser session:', error);
            showNotification(`Error: ${error.message}`, 'error');
            winBody.parentElement.remove(); // Close the window
        }
    }

    function createNewTab() {
        const tabId = `tab-${Date.now()}`;
        const newTab = {
            id: tabId,
            title: 'New Tab',
            url: 'about:blank',
            iframe: browserIframe // For simplicity, we'll reuse the iframe for now
        };
        tabs.push(newTab);
        activeTab = newTab;
        renderTabs();
        switchTab(tabId);
    }

    function switchTab(tabId) {
        activeTab = tabs.find(t => t.id === tabId);
        addressBar.value = activeTab.url === 'about:blank' ? '' : activeTab.url;
        browserIframe.src = activeTab.url;
        renderTabs();
    }

    function renderTabs() {
        tabBar.innerHTML = ''; // Clear existing tabs
        tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = `tab p-2 flex-grow border-r border-gray-400 ${tab.id === activeTab.id ? 'bg-gray-200' : 'bg-gray-300'}`;
            tabEl.dataset.tabId = tab.id;
            tabEl.innerHTML = `
                <span class="tab-title">${tab.title}</span>
                <button class="close-tab-btn ml-2">x</button>
            `;
            tabEl.addEventListener('click', () => switchTab(tab.id));
            tabEl.querySelector('.close-tab-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(tab.id);
            });
            tabBar.appendChild(tabEl);
        });
        const newTabBtnEl = document.createElement('button');
        newTabBtnEl.className = 'p-2';
        newTabBtnEl.innerText = '+';
        newTabBtnEl.addEventListener('click', createNewTab);
        tabBar.appendChild(newTabBtnEl);
    }

    function closeTab(tabId) {
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        if (tabIndex > -1) {
            tabs.splice(tabIndex, 1);
            if (tabs.length === 0) {
                winBody.parentElement.remove(); // Close the window if no tabs are left
            } else {
                if (activeTab.id === tabId) {
                    switchTab(tabs[0].id);
                }
                renderTabs();
            }
        }
    }

    async function navigate() {
        if (!sessionId || !activeTab) return;
        let url = addressBar.value.trim();
        if (!url) return;

        if (!url.match(/^https?:\/\//)) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }

        activeTab.url = url;
        addressBar.value = url;
        loadingOverlay.classList.remove('hidden');
        browserIframe.src = 'about:blank';

        try {
            await fetch(`/api/browser/${sessionId}/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                credentials: 'include'
            });

            browserIframe.src = `/api/browser/${sessionId}/view?url=${encodeURIComponent(url)}`;

            browserIframe.onload = () => {
                loadingOverlay.classList.add('hidden');
                activeTab.title = browserIframe.contentDocument.title || url;
                renderTabs();
            };
            browserIframe.onerror = () => {
                loadingOverlay.classList.add('hidden');
                showNotification('Failed to load page content.', 'error');
            }

        } catch (error) {
            console.error('Navigation failed:', error);
            loadingOverlay.classList.add('hidden');
            showNotification('Navigation failed.', 'error');
        }
    }

    async function search() {
        if (!sessionId || !activeTab) return;
        let query = searchBar.value.trim();
        if (!query) return;

        let url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

        activeTab.url = url;
        addressBar.value = query; // Keep the search query in the address bar
        loadingOverlay.classList.remove('hidden');
        browserIframe.src = 'about:blank';

        try {
            await fetch(`/api/browser/${sessionId}/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                credentials: 'include'
            });

            browserIframe.src = `/api/browser/${sessionId}/view?url=${encodeURIComponent(url)}`;

            browserIframe.onload = () => {
                loadingOverlay.classList.add('hidden');
                activeTab.title = `Google Search: ${query}`;
                renderTabs();
            };
            browserIframe.onerror = () => {
                loadingOverlay.classList.add('hidden');
                showNotification('Failed to load page content.', 'error');
            }

        } catch (error) {
            console.error('Search failed:', error);
            loadingOverlay.classList.add('hidden');
            showNotification('Search failed.', 'error');
        }
    }

    addressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate();
    });

    searchBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') search();
    });

    const win = winBody.parentElement;
    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            if (sessionId) {
                navigator.sendBeacon(`/api/browser/${sessionId}`, JSON.stringify({}), {
                    type: 'application/json',
                    keepalive: true
                });
            }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    initBrowser();
}

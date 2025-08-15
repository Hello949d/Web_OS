function createBrowserWindow() {
    const appId = 'browser';
    const title = 'Browser';
    const content = `
        <div class="w-full h-full flex flex-col bg-gray-800">
            <div class="bg-gray-700 p-1 flex items-center">
                <input type="text" class="address-bar flex-grow bg-gray-900 text-white rounded px-2 py-1" placeholder="https://...">
                <button class="go-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded ml-1">Go</button>
            </div>
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
    const goBtn = winBody.querySelector('.go-btn');
    const browserIframe = winBody.querySelector('.browser-iframe');
    const loadingOverlay = winBody.querySelector('.loading-overlay');

    let sessionId = null;

    async function initBrowser() {
        try {
            const response = await fetch('/api/browser', { method: 'POST', credentials: 'include' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start browser session');
            }
            const data = await response.json();
            sessionId = data.session_id;
        } catch (error) {
            console.error('Failed to start browser session:', error);
            // Optionally, display an error in the UI
            showNotification(`Error: ${error.message}`, 'error');
            winBody.parentElement.remove(); // Close the window
        }
    }

    async function navigate() {
        if (!sessionId) return;
        const userInput = addressBar.value.trim();
        if (!userInput) return;

        let navigationUrl;

        // Check if it's a valid URL or a search term
        if (!userInput.match(/^https?:\/\//) && userInput.includes('.') && !userInput.includes(' ')) {
            // It's a domain name without protocol, so we'll treat it as a URL
            navigationUrl = 'https://' + userInput;
            addressBar.value = navigationUrl; // Update address bar with the full URL
        } else if (userInput.match(/^https?:\/\//)) {
            // It's a full URL
            navigationUrl = userInput;
        } else {
            // Assume it's a search query
            navigationUrl = `https://www.google.com/search?q=${encodeURIComponent(userInput)}`;
            // Do NOT update the address bar value, keep the search term
        }

        loadingOverlay.classList.remove('hidden');
        browserIframe.src = 'about:blank'; // Clear previous page

        try {
            // First, navigate the headless browser
            await fetch(`/api/browser/${sessionId}/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: navigationUrl }),
                credentials: 'include'
            });

            // Then, set the iframe source to our proxy. The URL param is not strictly needed
            // by the new backend logic, but it's good for debugging and consistency.
            browserIframe.src = `/api/browser/${sessionId}/view?url=${encodeURIComponent(navigationUrl)}`;

            browserIframe.onload = () => {
                loadingOverlay.classList.add('hidden');
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

    goBtn.addEventListener('click', navigate);
    addressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate();
    });

    const win = winBody.parentElement;
    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            if (sessionId) {
                // Use keepalive to ensure the request is sent on page close
                navigator.sendBeacon(`/api/browser/${sessionId}`, JSON.stringify({}), {
                    type: 'application/json',
                    keepalive: true
                });
            }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Set an initial blank page
    browserIframe.src = 'about:blank';
    initBrowser();
}

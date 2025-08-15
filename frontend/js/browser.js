function createBrowserWindow() {
    const appId = 'browser';
    const title = 'Browser';
    const content = `
        <div class="w-full h-full flex flex-col">
            <div class="bg-gray-700 p-1 flex items-center">
                <input type="text" class="address-bar flex-grow bg-gray-800 text-white rounded px-2 py-1" placeholder="https://...">
                <button class="go-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded ml-1">Go</button>
            </div>
            <div class="browser-view flex-grow bg-black relative" style="image-rendering: pixelated;">
                <img class="screenshot w-full h-full object-contain">
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
    const screenshotImg = winBody.querySelector('.screenshot');
    const browserView = winBody.querySelector('.browser-view');
    const loadingOverlay = winBody.querySelector('.loading-overlay');

    let sessionId = null;
    let refreshInterval = null;

    async function initBrowser() {
        try {
            const response = await fetch('/api/browser', { method: 'POST', credentials: 'include' });
            const data = await response.json();
            sessionId = data.session_id;
            startScreenshotLoop();
        } catch (error) {
            console.error('Failed to start browser session:', error);
        }
    }

    async function navigate() {
        if (!sessionId) return;
        const url = addressBar.value;
        loadingOverlay.classList.remove('hidden');
        try {
            await fetch(`/api/browser/${sessionId}/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                credentials: 'include'
            });
            // Don't wait for refresh, it will come from the loop
        } catch (error) {
            console.error('Navigation failed:', error);
        } finally {
            // The loading overlay will be hidden once a new screenshot arrives
        }
    }

    async function refreshScreenshot() {
        if (!sessionId || !document.body.contains(winBody)) {
            stopScreenshotLoop();
            return;
        }
        try {
            const response = await fetch(`/api/browser/${sessionId}/screenshot`, { credentials: 'include' });
            if (!response.ok) throw new Error('Screenshot request failed');
            const data = await response.json();
            if (data.screenshot) {
                screenshotImg.src = `data:image/png;base64,${data.screenshot}`;
                loadingOverlay.classList.add('hidden');
            }
        } catch (error) {
            console.error('Failed to refresh screenshot:', error);
            stopScreenshotLoop();
        }
    }

    function startScreenshotLoop() {
        stopScreenshotLoop(); // Ensure no multiple loops
        refreshInterval = setInterval(refreshScreenshot, 1500); // Refresh every 1.5 seconds
    }

    function stopScreenshotLoop() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = null;
    }

    browserView.addEventListener('click', async (e) => {
        if (!sessionId) return;
        const rect = screenshotImg.getBoundingClientRect();
        const scaleX = screenshotImg.naturalWidth / rect.width;
        const scaleY = screenshotImg.naturalHeight / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        loadingOverlay.classList.remove('hidden');
        try {
            await fetch(`/api/browser/${sessionId}/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y }),
                credentials: 'include'
            });
            setTimeout(refreshScreenshot, 250); // Eager refresh
        } catch (error) {
            console.error('Click failed:', error);
            loadingOverlay.classList.add('hidden');
        }
    });

    winBody.parentElement.addEventListener('keydown', async (e) => {
        if (!sessionId || document.activeElement === addressBar) return;

        e.preventDefault();
        try {
            await fetch(`/api/browser/${sessionId}/type`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: e.key }),
                credentials: 'include'
            });
        } catch (error) {
            console.error('Type failed:', error);
        }
    });

    goBtn.addEventListener('click', navigate);
    addressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate();
    });

    const win = winBody.parentElement;
    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            if (sessionId) {
                // Use keepalive to ensure the request is sent on page close
                navigator.sendBeacon(`/api/browser/${sessionId}`, '');
            }
            stopScreenshotLoop();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    initBrowser();
}

function createBrowserWindow() {
    const appId = 'browser';
    const title = 'Browser';
    const content = `
        <div class="w-full h-full flex flex-col bg-gray-800">
            <div class="bg-gray-700 p-1 flex items-center">
                <input type="text" class="address-bar flex-grow bg-gray-900 text-white rounded px-2 py-1" placeholder="https://...">
                <button class="go-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded ml-1">Go</button>
            </div>
            <div class="browser-view flex-grow relative bg-black">
                <img class="browser-screenshot w-full h-full" style="display: none; object-fit: contain;" />
                <div class="browser-input-overlay absolute inset-0 cursor-crosshair" style="display: none;" tabindex="0"></div>
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
    const browserScreenshot = winBody.querySelector('.browser-screenshot');
    const browserInputOverlay = winBody.querySelector('.browser-input-overlay');
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
            showNotification(`Error: ${error.message}`, 'error');
            winBody.parentElement.remove();
        }
    }

    async function refreshScreenshot() {
        if (!sessionId) return;
        loadingOverlay.classList.remove('hidden');
        try {
            const response = await fetch(`/api/browser/${sessionId}/screenshot`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to get screenshot');
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            browserScreenshot.src = `data:image/png;base64,${data.screenshot}`;
            browserScreenshot.style.display = 'block';
            browserInputOverlay.style.display = 'block';
            browserInputOverlay.focus();
        } catch (error) {
            console.error('Screenshot failed:', error);
            showNotification('Failed to update browser view.', 'error');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    async function navigate() {
        if (!sessionId) return;
        const addressBarValue = addressBar.value.trim();
        if (!addressBarValue) return;
        let navigationUrl = addressBarValue;
        if (!addressBarValue.match(/^https?:\/\//)) {
            if (addressBarValue.includes('.') && !addressBarValue.includes(' ')) {
                navigationUrl = 'https://' + addressBarValue;
                addressBar.value = navigationUrl;
            } else {
                navigationUrl = `https://www.google.com/search?q=${encodeURIComponent(addressBarValue)}`;
            }
        }
        loadingOverlay.classList.remove('hidden');
        browserScreenshot.style.display = 'none';
        browserInputOverlay.style.display = 'none';
        try {
            await fetch(`/api/browser/${sessionId}/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: navigationUrl }),
                credentials: 'include'
            });
            await refreshScreenshot();
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

    browserInputOverlay.addEventListener('click', async (e) => {
        if (!sessionId) return;
        const rect = browserInputOverlay.getBoundingClientRect();
        const imgWidth = browserScreenshot.naturalWidth;
        const imgHeight = browserScreenshot.naturalHeight;
        if (!imgWidth || !imgHeight) return;

        const divWidth = browserInputOverlay.clientWidth;
        const divHeight = browserInputOverlay.clientHeight;
        const imgAspectRatio = imgWidth / imgHeight;
        const divAspectRatio = divWidth / divHeight;

        let scale, blackBarX = 0, blackBarY = 0;

        if (imgAspectRatio > divAspectRatio) { // Letterboxed
            scale = imgWidth / divWidth;
            const scaledHeight = divHeight * (divAspectRatio / imgAspectRatio);
            blackBarY = (divHeight - scaledHeight) / 2;
        } else { // Pillarboxed
            scale = imgHeight / divHeight;
            const scaledWidth = divWidth * (imgAspectRatio / divAspectRatio);
            blackBarX = (divWidth - scaledWidth) / 2;
        }

        const clickX = e.clientX - rect.left - blackBarX;
        const clickY = e.clientY - rect.top - blackBarY;
        if (clickX < 0 || clickY < 0) return;

        const finalX = clickX * scale;
        const finalY = clickY * scale;
        if (finalX > imgWidth || finalY > imgHeight) return;

        loadingOverlay.classList.remove('hidden');
        try {
            await fetch(`/api/browser/${sessionId}/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: finalX, y: finalY }),
                credentials: 'include'
            });
            await refreshScreenshot();
        } catch (error) {
            console.error('Click failed:', error);
            loadingOverlay.classList.add('hidden');
        }
    });

    let scrollTimeout;
    browserInputOverlay.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!sessionId) return;

        fetch(`/api/browser/${sessionId}/scroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deltaY: e.deltaY }),
            credentials: 'include'
        });

        clearTimeout(scrollTimeout);
        loadingOverlay.classList.remove('hidden');
        scrollTimeout = setTimeout(refreshScreenshot, 200);
    });

    browserInputOverlay.addEventListener('keydown', async (e) => {
        e.preventDefault();
        if (!sessionId) return;

        loadingOverlay.classList.remove('hidden');
        try {
            await fetch(`/api/browser/${sessionId}/type`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: e.key }),
                credentials: 'include'
            });
            await refreshScreenshot();
        } catch (error) {
            console.error('Typing failed:', error);
            loadingOverlay.classList.add('hidden');
        }
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

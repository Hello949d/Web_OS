function initSettings() {
    const appId = 'settings';
    const title = 'Settings';

    const windowBody = createWindow(appId, title, '');
    if (!windowBody) return;

    // --- UI Setup ---
    windowBody.innerHTML = `
        <div class="settings-app p-4">
            <h3 class="text-lg font-bold mb-4">Appearance</h3>
            <div class="space-y-4">
                <div>
                    <label for="wallpaper-url" class="block mb-1 text-sm">Wallpaper URL</label>
                    <input type="text" id="wallpaper-url" class="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded">
                    <p class="text-xs text-gray-400 mt-1">Enter URL of a new wallpaper. (e.g., from unsplash.com)</p>
                </div>
                <!-- Add more settings here later -->
            </div>
            <div class="mt-6 text-right">
                <button id="settings-save-btn" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded">Save Changes</button>
            </div>
        </div>
    `;

    const wallpaperInput = windowBody.querySelector('#wallpaper-url');
    const saveBtn = windowBody.querySelector('#settings-save-btn');
    const desktop = document.getElementById('desktop');

    // --- Load Current Settings ---
    async function loadSettings() {
        try {
            const response = await fetch('/api/settings', { credentials: 'include' });
            const settings = await response.json();
            if (settings.wallpaper) {
                wallpaperInput.value = settings.wallpaper;
                // Apply current wallpaper
                desktop.style.backgroundImage = `url('${settings.wallpaper}')`;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    // --- Save Settings ---
    saveBtn.addEventListener('click', async () => {
        const newWallpaper = wallpaperInput.value;
        const newSettings = {
            wallpaper: newWallpaper
        };

        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newSettings)
            });

            // Apply new wallpaper live
            if (newWallpaper) {
                desktop.style.backgroundImage = `url('${newWallpaper}')`;
            } else {
                 desktop.style.backgroundImage = `url('/assets/wallpapers/default.jpg')`;
            }

            showNotification('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            showNotification('Error saving settings.', 'error');
        }
    });

    loadSettings();
}

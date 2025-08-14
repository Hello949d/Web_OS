document.addEventListener('DOMContentLoaded', () => {
    const clockElement = document.getElementById('clock');
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    const logoutButton = document.getElementById('logout-button');
    const desktopIcons = document.getElementById('desktop-icons');

    // --- Clock ---
    function updateClock() {
        const now = new Date();
        const hours = now.getHours() % 12 || 12; // 12-hour format
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        clockElement.textContent = `${hours}:${minutes} ${ampm}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- Start Menu ---
    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        if (!startMenu.classList.contains('hidden')) {
            startMenu.classList.add('hidden');
        }
    });

    // --- Start Menu Actions ---
    const settingsButton = document.getElementById('settings-app-button');
    settingsButton.addEventListener('click', () => {
        initSettings();
        startMenu.classList.add('hidden'); // Hide menu after clicking
    });

    logoutButton.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });

    // --- App Launching ---
    desktopIcons.addEventListener('click', (e) => {
        const icon = e.target.closest('.desktop-icon');
        if (icon) {
            const appName = icon.dataset.app;
            const appTitle = icon.querySelector('span').textContent;

            let windowBody;
            // Create the window, get the body element back
            if (appName === 'file-manager') {
                windowBody = createWindow(appName, appTitle, '', { width: 600, height: 400 });
            } else {
                windowBody = createWindow(appName, appTitle, ''); // Create with empty content
            }

            if (windowBody) {
                // Launch the specific app
                if (appName === 'file-manager') {
                    // This function is defined in file-manager.js
                    initFileManager(windowBody);
                } else if (appName === 'terminal') {
                    initTerminal();
                } else if (appName === 'calculator') {
                    initCalculator();
                }
            }
        }
    });
});

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
    desktopIcons.addEventListener('dblclick', (e) => {
        const icon = e.target.closest('.desktop-icon');
        if (!icon) return;

        const appName = icon.dataset.app;
        const appTitle = icon.querySelector('span').textContent;
        let windowBody;

        // Create the window with specific options for each app
        switch (appName) {
            case 'file-manager':
                windowBody = createWindow(appName, appTitle, '', { width: 600, height: 400 });
                if (windowBody) initFileManager(windowBody);
                break;
            case 'terminal':
                windowBody = createWindow(appName, appTitle, '', { width: 550, height: 350 });
                if (windowBody) initTerminal(windowBody);
                break;
            case 'calculator':
                windowBody = createWindow(appName, appTitle, '', { width: 300, height: 450 });
                if (windowBody) initCalculator(windowBody);
                break;
            case 'text-editor':
                // For launching from the desktop, it's always a new file.
                // The initTextEditor function will handle the null fileId.
                initTextEditor(null, 'Untitled');
                break;
            // Add other apps here
        }
    });
});

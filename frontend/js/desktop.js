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

    // --- Icon Dragging and Positioning ---
    let dragTarget = null;
    let offsetX, offsetY;

    async function saveIconPositions() {
        const positions = {};
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            const appName = icon.dataset.app;
            if (appName) {
                positions[appName] = {
                    top: icon.style.top,
                    left: icon.style.left
                };
            }
        });

        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                body: JSON.stringify({ iconPositions: positions })
            });
        } catch (error) {
            console.error('Failed to save icon positions:', error);
        }
    }

    async function loadIconPositions() {
        try {
            const response = await fetch('/api/settings', { credentials: 'include' });
            const settings = await response.json();
            const positions = settings.iconPositions;

            if (positions) {
                let hasValidPosition = false;
                document.querySelectorAll('.desktop-icon').forEach(icon => {
                    const appName = icon.dataset.app;
                    if (positions[appName] && positions[appName].top && positions[appName].left) {
                        icon.style.top = positions[appName].top;
                        icon.style.left = positions[appName].left;
                        hasValidPosition = true;
                    }
                });
                // If settings exist but are empty or don't match, apply default
                if (!hasValidPosition) applyDefaultIconPositions();
            } else {
                applyDefaultIconPositions();
            }
        } catch (error) {
            console.error('Failed to load icon positions, applying default.', error);
            applyDefaultIconPositions();
        }
    }

    function applyDefaultIconPositions() {
        const icons = document.querySelectorAll('.desktop-icon');
        icons.forEach((icon, index) => {
            icon.style.top = `${20 + (index % 5) * 110}px`;
            icon.style.left = `${20 + Math.floor(index / 5) * 110}px`;
        });
        saveIconPositions(); // Save the default positions so they are consistent on next load
    }

    function onDragStart(e) {
        dragTarget = e.target.closest('.desktop-icon');
        if (!dragTarget) return;

        e.preventDefault();

        const rect = dragTarget.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        document.addEventListener('mousemove', onDragging);
        document.addEventListener('mouseup', onDragEnd);
    }

    function onDragging(e) {
        if (!dragTarget) return;

        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // Constrain to desktop bounds
        const desktopRect = desktopIcons.getBoundingClientRect();
        newLeft = Math.max(0, Math.min(newLeft, desktopRect.width - dragTarget.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, desktopRect.height - dragTarget.offsetHeight));

        dragTarget.style.left = `${newLeft}px`;
        dragTarget.style.top = `${newTop}px`;
    }

    function onDragEnd() {
        if (dragTarget) {
            saveIconPositions();
        }
        dragTarget = null;
        document.removeEventListener('mousemove', onDragging);
        document.removeEventListener('mouseup', onDragEnd);
    }

    desktopIcons.addEventListener('mousedown', onDragStart);

    // --- Desktop Context Menu ---
    const desktop = document.getElementById('desktop');
    const desktopMenuOptions = [
        { label: 'New Folder', callback: (e) => createDesktopItem('folder', e) },
        { label: 'New Text File', callback: (e) => createDesktopItem('file', e) }
    ];

    function createDesktopItem(type, e) {
        const inputDiv = document.createElement('div');
        inputDiv.style.position = 'absolute';
        inputDiv.style.left = `${e.clientX}px`;
        inputDiv.style.top = `${e.clientY}px`;
        inputDiv.style.zIndex = '10000';

        const defaultName = type === 'folder' ? 'New Folder' : 'Untitled.txt';
        inputDiv.innerHTML = `<input type="text" class="w-full text-center bg-gray-900 border border-blue-500 rounded" value="${defaultName}">`;
        desktop.appendChild(inputDiv);

        const input = inputDiv.querySelector('input');
        input.focus();
        input.select();

        const finalize = async () => {
            const newName = input.value.trim();
            inputDiv.remove(); // Clean up the input field

            if (!newName) return; // Canceled

            let response;
            if (type === 'folder') {
                response = await fetch('/api/files/folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                    body: JSON.stringify({ filename: newName, parent_id: null }) // Create in root
                });
            } else { // 'file'
                 response = await fetch('/api/files/new_text_file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                    body: JSON.stringify({ parent_id: null, filename: newName })
                });
            }
            if (response.ok) showNotification(`'${newName}' created in root directory.`, 'success');
            else showNotification('Failed to create item.', 'error');
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finalize();
            else if (e.key === 'Escape') inputDiv.remove();
        });
        input.addEventListener('blur', finalize);
    }

    desktop.addEventListener('contextmenu', (e) => {
        // Only show the context menu if the click is on the desktop background
        if (e.target === desktop) {
            showContextMenu(e, desktopMenuOptions);
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
            case 'browser':
                createBrowserWindow();
                break;
            // Add other apps here
        }
    });

    // Initial Load
    loadIconPositions();
});

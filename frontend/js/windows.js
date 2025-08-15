let zIndexCounter = 100;
const openWindows = {};

function createWindow(appId, title, content, options = {}) {
    // If window already exists, handle it
    if (openWindows[appId]) {
        const win = openWindows[appId];
        if (win.style.display === 'none') {
            // It's minimized, so restore it
            restoreWindow(win, appId);
        } else {
            // It's open, so just focus it
            focusWindow(win);
        }
        return null;
    }

    const windowContainer = document.getElementById('window-container');

    // Create the window element
    const win = document.createElement('div');
    win.className = 'app-window';
    win.style.left = `${Math.random() * 200 + 50}px`;
    win.style.top = `${Math.random() * 100 + 50}px`;
    win.style.zIndex = zIndexCounter++;

    if (options.width) win.style.width = `${options.width}px`;
    if (options.height) win.style.height = `${options.height}px`;

    win.innerHTML = `
        <div class="window-header">
            <span class="window-title">${title}</span>
            <div class="window-controls">
                <button class="minimize-btn">-</button>
                <button class="maximize-btn">[]</button>
                <button class="close-btn">x</button>
            </div>
        </div>
        <div class="window-body">
            ${content}
        </div>
        <div class="resizer top-left"></div><div class="resizer top-right"></div>
        <div class="resizer bottom-left"></div><div class="resizer bottom-right"></div>
        <div class="resizer top"></div><div class="resizer bottom"></div>
        <div class="resizer left"></div><div class="resizer right"></div>
    `;

    windowContainer.appendChild(win);
    openWindows[appId] = win;

    // Make it interactive
    makeDraggable(win);
    makeResizable(win);

    // Setup controls
    win.querySelector('.close-btn').addEventListener('click', () => {
        win.remove();
        delete openWindows[appId];
        const taskbarIcon = document.querySelector(`.taskbar-app[data-app-id="${appId}"]`);
        if (taskbarIcon) {
            taskbarIcon.remove();
        }
    });

    win.querySelector('.maximize-btn').addEventListener('click', () => {
        toggleMaximize(win);
    });

    win.querySelector('.minimize-btn').addEventListener('click', () => {
        minimizeWindow(win, appId, title);
    });

    // Focus on creation and on click
    win.addEventListener('mousedown', () => focusWindow(win));
    focusWindow(win);

    // Return the body of the window so content can be added
    return win.querySelector('.window-body');
}

function focusWindow(win) {
    win.style.zIndex = zIndexCounter++;
}

function toggleMaximize(win) {
    const taskbar = document.getElementById('taskbar');
    const taskbarHeight = taskbar.offsetHeight;

    if (win.dataset.maximized === 'true') {
        // Restore
        win.style.width = win.dataset.originalWidth;
        win.style.height = win.dataset.originalHeight;
        win.style.top = win.dataset.originalTop;
        win.style.left = win.dataset.originalLeft;
        win.dataset.maximized = 'false';
        // Make resizable again
        win.querySelectorAll('.resizer').forEach(r => r.style.display = 'block');
    } else {
        // Maximize
        win.dataset.originalWidth = win.style.width || getComputedStyle(win).width;
        win.dataset.originalHeight = win.style.height || getComputedStyle(win).height;
        win.dataset.originalTop = win.style.top || getComputedStyle(win).top;
        win.dataset.originalLeft = win.style.left || getComputedStyle(win).left;

        win.style.width = '100vw';
        win.style.height = `calc(100vh - ${taskbarHeight}px)`;
        win.style.top = '0';
        win.style.left = '0';
        win.dataset.maximized = 'true';
        // Disable resizing when maximized
        win.querySelectorAll('.resizer').forEach(r => r.style.display = 'none');
    }
}

function minimizeWindow(win, appId, title) {
    win.style.display = 'none';

    const taskbar = document.getElementById('running-apps');
    let taskbarIcon = taskbar.querySelector(`[data-app-id="${appId}"]`);
    if (!taskbarIcon) {
        taskbarIcon = document.createElement('div');
        taskbarIcon.className = 'taskbar-app';
        taskbarIcon.dataset.appId = appId;
        taskbarIcon.innerHTML = `<i class="fas fa-window-maximize"></i><span>${title}</span>`; // Generic icon
        taskbar.appendChild(taskbarIcon);

        taskbarIcon.addEventListener('click', () => {
            if (win.style.display !== 'none') {
                win.style.display = 'none';
            } else {
                restoreWindow(win, appId);
            }
        });
    }
}

function restoreWindow(win, appId) {
    win.style.display = 'flex';
    focusWindow(win);
}

function makeDraggable(win) {
    const header = win.querySelector('.window-header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        if (win.dataset.maximized === 'true') {
            return;
        }
        isDragging = true;
        offsetX = e.clientX - win.offsetLeft;
        offsetY = e.clientY - win.offsetTop;

        // Bring window to front
        focusWindow(win);

        function onMouseMove(e) {
            if (isDragging) {
                win.style.left = `${e.clientX - offsetX}px`;
                win.style.top = `${e.clientY - offsetY}px`;
            }
        }

        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function makeResizable(win) {
    const resizers = win.querySelectorAll('.resizer');
    let currentResizer;
    let original_width, original_height, original_x, original_y, original_mouse_x, original_mouse_y;

    resizers.forEach(resizer => {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            currentResizer = e.target;
            original_width = parseFloat(getComputedStyle(win, null).getPropertyValue('width').replace('px', ''));
            original_height = parseFloat(getComputedStyle(win, null).getPropertyValue('height').replace('px', ''));
            original_x = win.getBoundingClientRect().left;
            original_y = win.getBoundingClientRect().top;
            original_mouse_x = e.pageX;
            original_mouse_y = e.pageY;

            focusWindow(win);

            function onMouseMove(e) {
                const width = original_width + (e.pageX - original_mouse_x);
                const height = original_height + (e.pageY - original_mouse_y);
                if (currentResizer.classList.contains('bottom-right')) {
                    win.style.width = width + 'px';
                    win.style.height = height + 'px';
                } else if (currentResizer.classList.contains('bottom-left')) {
                    win.style.width = original_width - (e.pageX - original_mouse_x) + 'px';
                    win.style.height = height + 'px';
                    win.style.left = original_x + (e.pageX - original_mouse_x) + 'px';
                } else if (currentResizer.classList.contains('top-right')) {
                    win.style.width = width + 'px';
                    win.style.height = original_height - (e.pageY - original_mouse_y) + 'px';
                    win.style.top = original_y + (e.pageY - original_mouse_y) + 'px';
                } else if (currentResizer.classList.contains('top-left')) {
                    win.style.width = original_width - (e.pageX - original_mouse_x) + 'px';
                    win.style.height = original_height - (e.pageY - original_mouse_y) + 'px';
                    win.style.top = original_y + (e.pageY - original_mouse_y) + 'px';
                    win.style.left = original_x + (e.pageX - original_mouse_x) + 'px';
                } else if (currentResizer.classList.contains('top')) {
                     win.style.height = original_height - (e.pageY - original_mouse_y) + 'px';
                     win.style.top = original_y + (e.pageY - original_mouse_y) + 'px';
                } else if (currentResizer.classList.contains('bottom')) {
                    win.style.height = height + 'px';
                } else if (currentResizer.classList.contains('left')) {
                    win.style.width = original_width - (e.pageX - original_mouse_x) + 'px';
                    win.style.left = original_x + (e.pageX - original_mouse_x) + 'px';
                } else { // right
                    win.style.width = width + 'px';
                }
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}

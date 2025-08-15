// --- Generic Context Menu System ---

function showContextMenu(e, options) {
    e.preventDefault();
    removeContextMenu(); // Close any existing menu

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'absolute bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 z-[9999]';

    options.forEach(option => {
        if (option.separator) {
            const separator = document.createElement('div');
            separator.className = 'border-t border-gray-700 my-1';
            menu.appendChild(separator);
            return;
        }

        const menuItem = document.createElement('div');
        menuItem.className = 'px-4 py-2 text-sm text-white hover:bg-gray-700 cursor-pointer';
        menuItem.textContent = option.label;
        menuItem.addEventListener('click', (event) => {
            // Pass the original contextmenu event to the callback
            option.callback(e);
            removeContextMenu();
        });
        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Position the menu
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = e.clientX;
    let top = e.clientY;

    if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth;
    }
    if (top + menuHeight > windowHeight) {
        top = windowHeight - menuHeight;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    // Add a listener to close the menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', removeContextMenu, { once: true });
    }, 0);
}

function removeContextMenu() {
    const existingMenu = document.getElementById('context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    // Make sure to remove the listener if the menu was closed by other means
    document.removeEventListener('click', removeContextMenu);
}

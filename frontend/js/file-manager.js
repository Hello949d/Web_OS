function initFileManager(container) {
    // This app is initialized differently, it gets the container, not creates the window
    // So we can't set the window size here. We need to do it in desktop.js
    let currentParentId = null;
    let pathHistory = [{ id: null, name: 'Home' }];

    // --- UI Setup ---
    container.innerHTML = `
        <div class="file-manager h-full flex flex-col">
            <div class="toolbar bg-gray-700 p-1 flex items-center gap-2">
                <button id="fm-back" class="px-2 py-1 rounded hover:bg-gray-600"><i class="fas fa-arrow-left"></i></button>
                <div id="fm-breadcrumbs" class="px-2 text-sm">/</div>
                <div class="flex-grow"></div>
                <input type="search" id="fm-search" placeholder="Search..." class="px-2 py-1 rounded bg-gray-800 text-white w-48">
                <button id="fm-new-folder" class="px-2 py-1 rounded hover:bg-gray-600"><i class="fas fa-folder-plus"></i> New Folder</button>
                <button id="fm-upload" class="px-2 py-1 rounded hover:bg-gray-600"><i class="fas fa-upload"></i> Upload</button>
            </div>
            <div id="fm-file-view" class="flex-grow p-2 overflow-y-auto flex flex-wrap content-start gap-2">
                <!-- Files will be rendered here -->
            </div>
        </div>
    `;

    const fileView = container.querySelector('#fm-file-view');
    const breadcrumbs = container.querySelector('#fm-breadcrumbs');
    const backBtn = container.querySelector('#fm-back');

    function updateBreadcrumbs() {
        breadcrumbs.innerHTML = pathHistory.map(p => `<span class="px-1">${p.name}</span>`).join('/');
    }

    // --- File Rendering ---
    async function renderFiles(parentId, parentName) {
        // Manage history
        if (parentName) { // Navigating into a folder
            pathHistory.push({ id: parentId, name: parentName });
        } else { // Navigating back or initial load
            const currentPath = pathHistory[pathHistory.length - 1];
            parentId = currentPath.id;
        }
        currentParentId = parentId;
        updateBreadcrumbs();

        const parentIdQuery = parentId === null ? 'null' : parentId;
        try {
            const response = await fetch(`/api/files?parent_id=${parentIdQuery}`, {
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (!response.ok) throw new Error('Failed to fetch files');
            const files = await response.json();

            fileView.innerHTML = ''; // Clear previous view
            if (files.length === 0) {
                fileView.innerHTML = '<p class="text-gray-500">This folder is empty.</p>';
            }

            files.forEach(file => {
                const fileEl = document.createElement('div');
                fileEl.className = 'desktop-icon'; // Reuse desktop icon style
                fileEl.dataset.id = file.id;
                fileEl.dataset.isFolder = file.is_folder;

                const iconClass = file.is_folder ? 'fa-folder' : 'fa-file';
                fileEl.innerHTML = `
                    <i class="fas ${iconClass} fa-2x"></i>
                    <span class="text-xs mt-1">${file.filename}</span>
                `;
                fileView.appendChild(fileEl);

                // Event Listeners
                fileEl.addEventListener('dblclick', () => {
                    if (file.is_folder) {
                        renderFiles(file.id, file.filename);
                    } else {
                        // It's a file, check extension to open appropriate app
                        const textExtensions = ['.txt', '.md', '.json', '.js', '.css', '.html'];
                        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

                        const isTextFile = textExtensions.some(ext => file.filename.toLowerCase().endsWith(ext));
                        const isImageFile = imageExtensions.some(ext => file.filename.toLowerCase().endsWith(ext));

                        if (isTextFile) {
                            initTextEditor(file.id, file.filename);
                        } else if (isImageFile) {
                            initImageViewer(file.id, file.filename);
                        } else {
                            // Default to text editor for unknown files
                            initTextEditor(file.id, file.filename);
                        }
                    }
                });
            });

        } catch (error) {
            console.error('Error rendering files:', error);
            fileView.innerHTML = `<p class="text-red-500">Error loading files.</p>`;
        }
    }

    // --- Navigation ---
    backBtn.addEventListener('click', () => {
        if (pathHistory.length > 1) {
            pathHistory.pop();
            renderFiles(); // Render the new current path
        }
    });

    // --- Event Listeners for Toolbar ---
    const searchInput = container.querySelector('#fm-search');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const icons = fileView.querySelectorAll('.desktop-icon');
        icons.forEach(icon => {
            const fileName = icon.querySelector('span').textContent.toLowerCase();
            if (fileName.includes(searchTerm)) {
                icon.style.display = ''; // Restore default display
            } else {
                icon.style.display = 'none';
            }
        });
    });

    const newFolderBtn = container.querySelector('#fm-new-folder');
    newFolderBtn.addEventListener('click', async () => {
        const folderName = prompt('Enter new folder name:');
        if (folderName) {
            const response = await fetch('/api/files/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ filename: folderName, parent_id: currentParentId })
            });
            if (response.ok) {
                showNotification(`Folder '${folderName}' created.`, 'success');
                renderFiles(currentParentId); // Refresh
            } else {
                const err = await response.json();
                showNotification(`Error: ${err.error}`, 'error');
            }
        }
    });

    const uploadBtn = container.querySelector('#fm-upload');

    // --- Context Menu ---
    fileView.addEventListener('contextmenu', (e) => {
        const targetFileElement = e.target.closest('.desktop-icon');

        if (targetFileElement) {
            // Clicked on a file or folder
            const fileId = targetFileElement.dataset.id;
            const isFolder = targetFileElement.dataset.isFolder === 'true';

            const fileMenuOptions = [
                { label: 'Rename', callback: () => renameFile(fileId) },
                { label: 'Delete', callback: () => deleteFile(fileId) }
            ];

            if (!isFolder) {
                fileMenuOptions.push({ label: 'Download', callback: () => downloadFile(fileId) });
            }
            showContextMenu(e, fileMenuOptions);

        } else if (e.target === fileView) {
            // Clicked on the background
            const backgroundMenuOptions = [
                { label: 'New Folder', callback: () => createNewItem('folder') },
                { label: 'New Text File', callback: () => createNewItem('file') }
            ];
            showContextMenu(e, backgroundMenuOptions);
        }
    });

    async function renameFile(fileId) {
        const fileEl = fileView.querySelector(`[data-id='${fileId}']`);
        if (!fileEl) return;

        const icon = fileEl.querySelector('i');
        const span = fileEl.querySelector('span');
        const currentName = span.textContent;

        span.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full text-center bg-gray-900 border border-blue-500 rounded';
        input.value = currentName;

        fileEl.appendChild(input);
        input.focus();
        input.select();

        const finalize = async () => {
            const newName = input.value.trim();
            if (!newName || newName === currentName) {
                // If name is empty or unchanged, just restore the view
                input.remove();
                span.style.display = 'block';
                return;
            }

            const response = await fetch(`/api/files/rename/${fileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                body: JSON.stringify({ new_name: newName })
            });

            if (response.ok) showNotification('Renamed successfully.', 'success');
            else showNotification('Rename failed.', 'error');

            renderFiles(currentParentId); // Refresh the entire view
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finalize();
            } else if (e.key === 'Escape') {
                input.remove();
                span.style.display = 'block';
            }
        });
        input.addEventListener('blur', finalize);
    }

    async function deleteFile(fileId) {
        if (confirm('Are you sure you want to delete this? This action cannot be undone.')) {
            const response = await fetch(`/api/files/delete/${fileId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (response.ok) showNotification('Deleted successfully.', 'success');
            else showNotification('Delete failed.', 'error');
            renderFiles(currentParentId);
        }
    }

    function downloadFile(fileId) {
        window.location.href = `/api/files/download/${fileId}`;
    }

    async function createNewItem(type) {
        // Remove empty folder message if it exists
        const emptyMsg = fileView.querySelector('p');
        if (emptyMsg) emptyMsg.remove();

        const tempId = `temp-${Date.now()}`;
        const fileEl = document.createElement('div');
        fileEl.className = 'desktop-icon'; // Reuse desktop icon style
        fileEl.dataset.id = tempId;

        const iconClass = type === 'folder' ? 'fa-folder' : 'fa-file';
        const defaultName = type === 'folder' ? 'New Folder' : 'Untitled.txt';

        fileEl.innerHTML = `
            <i class="fas ${iconClass} fa-2x"></i>
            <span class="text-xs mt-1" style="display: none;">${defaultName}</span>
            <input type="text" class="w-full text-center bg-gray-900 border border-blue-500 rounded" value="${defaultName}">
        `;
        fileView.appendChild(fileEl);

        const input = fileEl.querySelector('input');
        input.focus();
        input.select();

        const finalize = async () => {
            const newName = input.value.trim();
            if (!newName) {
                fileEl.remove(); // Canceled or empty
                return;
            }

            let response;
            if (type === 'folder') {
                response = await fetch('/api/files/folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                    body: JSON.stringify({ filename: newName, parent_id: currentParentId })
                });
            } else { // 'file'
                 response = await fetch('/api/files/new_text_file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                    body: JSON.stringify({ parent_id: currentParentId, filename: newName }) // Assume API can take filename
                });
            }

            if (response.ok) {
                showNotification(`'${newName}' created.`, 'success');
            } else {
                const err = await response.json();
                showNotification(`Error: ${err.error}`, 'error');
            }
            renderFiles(currentParentId); // Refresh the view
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finalize();
            } else if (e.key === 'Escape') {
                fileEl.remove();
            }
        });
        input.addEventListener('blur', finalize);
    }


    uploadBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('parent_id', currentParentId || '');

                try {
                    const response = await fetch('/api/files/upload', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error || 'Upload failed');
                    }
                    showNotification(`'${file.name}' uploaded successfully.`, 'success');
                    renderFiles(currentParentId); // Refresh view
                } catch (error) {
                    console.error('Error uploading file:', error);
                    showNotification(error.message, 'error');
                }
            }
        });

        container.appendChild(fileInput);
        fileInput.click();
        fileInput.remove();
    });

    // Initial load
    renderFiles(null);
}

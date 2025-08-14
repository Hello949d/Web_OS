function initFileManager(container) {
    // This app is initialized differently, it gets the container, not creates the window
    // So we can't set the window size here. We need to do it in desktop.js
    let currentParentId = null;
    let pathHistory = [{ id: null, name: 'Home' }];

    // --- UI Setup ---
    container.innerHTML = `
        <div class="file-manager h-full flex flex-col">
            <div class="toolbar bg-gray-700 p-1 flex items-center">
                <button id="fm-back" class="px-2 py-1 rounded hover:bg-gray-600"><i class="fas fa-arrow-left"></i></button>
                <div id="fm-breadcrumbs" class="px-2 text-sm">/</div>
                <div class="flex-grow"></div>
                <button id="fm-new-folder" class="px-2 py-1 rounded hover:bg-gray-600 mr-2"><i class="fas fa-folder-plus"></i> New Folder</button>
                <button id="fm-upload" class="px-2 py-1 rounded hover:bg-gray-600"><i class="fas fa-upload"></i> Upload</button>
            </div>
            <div id="fm-file-view" class="flex-grow p-2 overflow-y-auto">
                <!-- Files will be rendered here -->
            </div>
            <div id="fm-context-menu" class="hidden absolute bg-gray-900 rounded shadow-lg p-2 z-50">
                <div class="p-1 hover:bg-gray-700 cursor-pointer" data-action="rename">Rename</div>
                <div class="p-1 hover:bg-gray-700 cursor-pointer" data-action="delete">Delete</div>
                <div class="p-1 hover:bg-gray-700 cursor-pointer" data-action="download">Download</div>
                <div class="p-1 hover:bg-gray-700 cursor-pointer" data-action="new-file">New Text File</div>
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
            const response = await fetch(`/api/files?parent_id=${parentIdQuery}`, { credentials: 'include' });
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
    const newFolderBtn = container.querySelector('#fm-new-folder');
    newFolderBtn.addEventListener('click', async () => {
        const folderName = prompt('Enter new folder name:');
        if (folderName) {
            await fetch('/api/files/folder', {
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
    const contextMenu = container.querySelector('#fm-context-menu');
    let contextFile = null; // To store which file the context menu is for

    // --- Context Menu ---
    function showContextMenu(e, target) {
        e.preventDefault();
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.classList.remove('hidden');

        const isFile = target && target.classList.contains('desktop-icon');

        // Toggle item visibility based on target
        contextMenu.querySelector('[data-action="rename"]').style.display = isFile ? 'block' : 'none';
        contextMenu.querySelector('[data-action="delete"]').style.display = isFile ? 'block' : 'none';
        contextMenu.querySelector('[data-action="download"]').style.display = (isFile && target.dataset.isFolder === 'false') ? 'block' : 'none';
        contextMenu.querySelector('[data-action="new-file"]').style.display = isFile ? 'none' : 'block';

        if (isFile) {
            contextFile = {
                id: target.dataset.id,
                isFolder: target.dataset.isFolder === 'true'
            };
        } else {
            contextFile = null;
        }
    }

    fileView.addEventListener('contextmenu', (e) => {
        const targetFile = e.target.closest('.desktop-icon');
        // If right-clicking on a file or on the background
        if (targetFile || e.target === fileView) {
            showContextMenu(e, targetFile);
        }
    });

    // Hide context menu on left-click
    document.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
    });

    // Context menu actions
    contextMenu.addEventListener('click', async (e) => {
        if (!contextFile) return;
        const action = e.target.dataset.action;

        switch(action) {
            case 'new-file':
                await fetch('/api/files/new_text_file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ parent_id: currentParentId })
                });
                renderFiles(currentParentId);
                break;
            case 'rename':
                const newName = prompt('Enter new name:');
                if (newName) {
                    await fetch(`/api/files/rename/${contextFile.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ new_name: newName })
                    });
                    if(response.ok) showNotification('Renamed successfully.', 'success');
                    else showNotification('Rename failed.', 'error');
                    renderFiles(currentParentId);
                }
                break;
            case 'delete':
                if (confirm('Are you sure you want to delete this? This action cannot be undone.')) {
                    const response = await fetch(`/api/files/delete/${contextFile.id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    if(response.ok) showNotification('Deleted successfully.', 'success');
                    else showNotification('Delete failed.', 'error');
                    renderFiles(currentParentId);
                }
                break;
            case 'download':
                window.location.href = `/api/files/download/${contextFile.id}`;
                break;
        }
        contextFile = null;
    });

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

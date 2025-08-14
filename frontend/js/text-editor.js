function initTextEditor(fileId, fileName) {
    const appId = `text-editor-${fileId}`;
    const title = `${fileName} - Text Editor`;

    // Create a new window for the text editor
    const windowBody = createWindow(appId, title, '');
    if (!windowBody) {
        // Window already exists, it has been focused.
        return;
    }

    // --- UI Setup ---
    windowBody.innerHTML = `
        <div class="text-editor h-full flex flex-col">
            <textarea class="flex-grow w-full bg-gray-900 text-white p-2 font-mono focus:outline-none"></textarea>
            <div class="statusbar bg-gray-700 p-1 flex justify-end">
                <button class="save-btn px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded">Save</button>
            </div>
        </div>
    `;

    const textarea = windowBody.querySelector('textarea');
    const saveBtn = windowBody.querySelector('.save-btn');

    // --- Load File Content ---
    async function loadContent() {
        try {
            const response = await fetch(`/api/files/content/${fileId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load file content.');
            const data = await response.json();
            textarea.value = data.content;
        } catch (error) {
            console.error('Error loading file:', error);
            textarea.value = `Error: ${error.message}`;
            textarea.disabled = true;
        }
    }

    // --- Save File Content ---
    saveBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/files/content/${fileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: textarea.value })
            });
            if (!response.ok) throw new Error('Failed to save file.');

            showNotification('File saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving file:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    });

    loadContent();
}

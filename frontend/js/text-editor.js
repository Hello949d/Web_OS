// A variable to track new file windows to give them unique IDs
let newFileCounter = 0;

function initTextEditor(fileId, fileName) {
    // If fileId is null, it's a new file. Generate a temporary, unique ID.
    const isNewFile = fileId === null;
    const appId = isNewFile ? `text-editor-new-${newFileCounter++}` : `text-editor-${fileId}`;
    const title = isNewFile ? 'Untitled - Text Editor' : `${fileName} - Text Editor`;

    // Create a new window for the text editor
    const windowBody = createWindow(appId, title, '', { width: 500, height: 600 });
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
    const windowEl = windowBody.closest('.app-window'); // Get the top-level window element

    // --- State ---
    let currentFileId = fileId;
    let currentFileName = fileName;

    // --- Load File Content ---
    async function loadContent() {
        if (isNewFile) {
            textarea.value = ''; // Start with a blank slate
            return;
        }
        try {
            const response = await fetch(`/api/files/content/${currentFileId}`, { credentials: 'include' });
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
        const content = textarea.value;

        try {
            if (currentFileId === null) {
                // This is a new file, create it first
                const createResponse = await fetch('/api/files/new_text_file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ parent_id: null }) // Save to root for now
                });
                if (!createResponse.ok) throw new Error('Failed to create file entry.');
                const newFileData = await createResponse.json();

                // Now we have an ID and a filename
                currentFileId = newFileData.id;
                currentFileName = newFileData.filename;

                // Update window title
                const titleEl = windowEl.querySelector('.window-title');
                if (titleEl) {
                    titleEl.textContent = `${currentFileName} - Text Editor`;
                }
                // We should also update the appId in the global openWindows object, but we can't.
                // This means the user could open the same file twice. Acceptable for now.
            }

            // Now, save the content to the (possibly new) file ID
            const saveResponse = await fetch(`/api/files/content/${currentFileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: content })
            });
            if (!saveResponse.ok) throw new Error('Failed to save file content.');

            showNotification('File saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving file:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    });

    loadContent();
}

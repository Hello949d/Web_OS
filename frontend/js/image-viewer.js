function initImageViewer(fileId, fileName) {
    const appId = `image-viewer-${fileId}`;
    const title = `${fileName} - Image Viewer`;

    const windowBody = createWindow(appId, title, '', { width: 500, height: 400 });
    if (!windowBody) {
        return;
    }

    windowBody.style.padding = '0';
    windowBody.style.overflow = 'hidden';
    windowBody.innerHTML = `
        <div class="image-viewer h-full w-full flex items-center justify-center bg-gray-900">
            <img src="/api/files/download/${fileId}" alt="${fileName}" class="max-w-full max-h-full object-contain">
        </div>
    `;
}

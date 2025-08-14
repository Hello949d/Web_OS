function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notif = document.createElement('div');

    let bgColor, textColor, iconClass;
    switch (type) {
        case 'success':
            bgColor = 'bg-green-500';
            textColor = 'text-white';
            iconClass = 'fas fa-check-circle';
            break;
        case 'error':
            bgColor = 'bg-red-500';
            textColor = 'text-white';
            iconClass = 'fas fa-exclamation-circle';
            break;
        default: // 'info'
            bgColor = 'bg-blue-500';
            textColor = 'text-white';
            iconClass = 'fas fa-info-circle';
            break;
    }

    notif.className = `notification ${bgColor} ${textColor} p-4 rounded-lg shadow-lg flex items-center animate-pulse`;
    notif.innerHTML = `
        <i class="${iconClass} mr-3"></i>
        <span>${message}</span>
    `;

    container.appendChild(notif);

    // Remove the notification after 3 seconds
    setTimeout(() => {
        notif.style.transition = 'opacity 0.5s ease';
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 500);
    }, 3000);
}

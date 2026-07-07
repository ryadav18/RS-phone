class NotificationsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    init() {
        if (!this.activeDeviceId) return;
        this.fetchNotifications();
        // Har 5 second mein naye notifications check karega
        setInterval(() => this.fetchNotifications(), 5000);
    }

    async fetchNotifications() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/notifications?device_id=${this.activeDeviceId}&limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderNotifications(result.data);
            }
        } catch (e) {
            console.error("Notifications Engine Error:", e);
        }
    }

    renderNotifications(items) {
        const container = document.getElementById('dashboard-notif-feed');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No notifications archived.</div>';
            return;
        }

        container.innerHTML = items.map(n => `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent-cyan); margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong style="color: var(--accent-cyan); font-size: 0.9rem;">${n.app_name}</strong>
                    <span style="color: var(--text-muted); font-size: 0.8rem;">${new Date(n.received_at).toLocaleString()}</span>
                </div>
                <div style="font-size: 1rem; font-weight: 600; margin-bottom: 5px;">${n.title}</div>
                <div style="font-size: 0.9rem; color: #ccc;">${n.message}</div>
            </div>
        `).join('');
    }
}

window.wipeNotificationsHistory = async function() {
    if(!confirm("WARNING: Permanently delete all notifications?")) return;
    const token = localStorage.getItem('owner_token');
    const activeId = localStorage.getItem('active_device_id');
    
    try {
        const res = await fetch('/api/notifications/clear', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: activeId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("Notifications wiped cleanly.");
            window.location.reload();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        console.error(e);
    }
};

document.addEventListener('DOMContentLoaded', () => new NotificationsEngine());

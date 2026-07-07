class MessagesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    init() {
        if (!this.activeDeviceId) return;
        this.fetchMessages();
        setInterval(() => this.fetchMessages(), 5000);
    }

    async fetchMessages() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/messages?device_id=${this.activeDeviceId}&limit=150`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderMessages(result.data);
            }
        } catch (e) {
            console.error("Messages Engine Error:", e);
        }
    }

    renderMessages(items) {
        const container = document.getElementById('sms-list');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No SMS streams detected.</div>';
            return;
        }

        container.innerHTML = items.map(m => `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #f5a623; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong style="color: #f5a623; font-size: 0.95rem;">${m.sender}</strong>
                    <span style="color: var(--text-muted); font-size: 0.8rem;">${new Date(m.timestamp).toLocaleString()}</span>
                </div>
                <div style="font-size: 0.95rem; color: #e2e8f0; line-height: 1.4;">${m.message_preview}</div>
            </div>
        `).join('');
    }
}

window.wipeSMSHistory = async function() {
    if(!confirm("WARNING: Permanently delete all SMS logs?")) return;
    const token = localStorage.getItem('owner_token');
    const activeId = localStorage.getItem('active_device_id');
    
    try {
        const res = await fetch('/api/messages/clear', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: activeId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("SMS logs wiped cleanly.");
            window.location.reload();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        console.error(e);
    }
};

document.addEventListener('DOMContentLoaded', () => new MessagesEngine());

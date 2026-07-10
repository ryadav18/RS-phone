class MessagesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        await this.loadDevicesList();
        if (!this.activeDeviceId) return; 
        
        this.fetchMessages();
        // 15 seconds polling taaki limit=10 par server overload na ho
        setInterval(() => this.fetchMessages(), 15000);
    }

    async loadDevicesList() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch('/api/devices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();

            if (result.status === 'success') {
                const selectEl = document.getElementById('device-select');
                if (selectEl) {
                    selectEl.innerHTML = ''; 
                    if (result.data.length === 0) {
                        selectEl.innerHTML = '<option value="">No Devices Found</option>';
                        return;
                    }
                    result.data.forEach(dev => {
                        const option = document.createElement('option');
                        option.value = dev.id;
                        option.textContent = dev.name;
                        selectEl.appendChild(option);
                    });
                    if (!this.activeDeviceId && result.data.length > 0) {
                        this.activeDeviceId = result.data[0].id;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                    }
                    selectEl.value = this.activeDeviceId;
                    selectEl.addEventListener('change', (e) => {
                        this.activeDeviceId = e.target.value;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                        this.fetchMessages(); 
                    });
                }
            }
        } catch (e) { console.error("Failed to load devices:", e); }
    }

    async fetchMessages() {
        const token = localStorage.getItem('owner_token');
        try {
            // Strict Limit = 10
            const res = await fetch(`/api/messages?device_id=${this.activeDeviceId}&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderMessages(result.data);
            }
        } catch (e) { console.error("Messages Engine Error:", e); }
    }

    renderMessages(items) {
        const container = document.getElementById('sms-list');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px;">No communication logged. Waiting for sync...</div>';
            return;
        }

        container.innerHTML = items.map(m => {
            // Android Type Logic: 1 = Inbox (Received), 2 = Sent (Outgoing)
            let directionText = 'UNKNOWN';
            let badgeColor = '#95a5a6';
            let arrowIcon = '↔️';

            if (m.message_type === '1' || m.message_type.toLowerCase() === 'inbox') {
                directionText = 'RECEIVED';
                badgeColor = '#2ecc71';
                arrowIcon = '↙️';
            } else if (m.message_type === '2' || m.message_type.toLowerCase() === 'sent') {
                directionText = 'SENT';
                badgeColor = '#3498db';
                arrowIcon = '↗️';
            }

            // Timestamp Formatting
            const dateObj = new Date(m.timestamp);
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            return `
            <div style="background: rgba(255,255,255,0.05); padding: 18px; border-radius: 8px; border-left: 4px solid ${badgeColor}; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem;">${arrowIcon}</span>
                        <strong style="color: #fff; font-size: 1.1rem; letter-spacing: 0.5px;">${m.sender}</strong>
                    </div>
                    <span style="background: ${badgeColor}33; color: ${badgeColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; border: 1px solid ${badgeColor};">
                        ${directionText}
                    </span>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #333; padding-top: 10px; margin-top: 5px;">
                    <span style="color: #666; font-size: 0.85rem; font-weight: bold;">
                        🔒 ENCRYPTED / CONTENT HIDDEN
                    </span>
                    <span style="color: #aaa; font-size: 0.85rem; font-family: monospace;">
                        ${dateStr} &bull; ${timeStr}
                    </span>
                </div>
            </div>
            `;
        }).join('');
    }
}

window.wipeSMSHistory = async function() {
    if(!confirm("WARNING: Permanently delete all 10 SMS logs?")) return;
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
    } catch (e) { console.error(e); }
};

document.addEventListener('DOMContentLoaded', () => new MessagesEngine());

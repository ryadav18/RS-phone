class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.activeDeviceToken = null; // 🚀 FIXED: Dynamic state registry to hold secondary UUID token signatures
        this.init();
    }

    async init() {
        await this.loadDevicesList();
        if (!this.activeDeviceId) return; 
        await this.loadDeviceMetrics();
        
        // Existing metric refresher
        setInterval(() => this.loadDeviceMetrics(), 10000);
        
        // Automated high-priority telemetry loop for Geofence & SOS alerts
        this.initializeBackgroundTelemetryLoops();
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
                    if (!result.data || result.data.length === 0) {
                        selectEl.innerHTML = '<option value="">No Devices Found</option>';
                        return;
                    }

                    // 🚀 FIXED: Dynamic Sanitization Block to neutralize stale 'mock_device_token' strings
                    const validDevice = result.data.find(d => d.id == this.activeDeviceId || d.device_token == this.activeDeviceId);
                    
                    if (!validDevice) {
                        // Force reset to the actual newly registered hardware context (e.g., moto g31)
                        this.activeDeviceId = result.data[0].id;
                        this.activeDeviceToken = result.data[0].device_token;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                    } else {
                        this.activeDeviceId = validDevice.id;
                        this.activeDeviceToken = validDevice.device_token;
                    }

                    result.data.forEach(dev => {
                        const option = document.createElement('option');
                        option.value = dev.id;
                        option.textContent = `${dev.name} (${dev.model || 'Active Only'})`;
                        selectEl.appendChild(option);
                    });

                    selectEl.value = this.activeDeviceId;
                    
                    // Re-bind change listener with defensive checks
                    selectEl.addEventListener('change', (e) => {
                        this.activeDeviceId = e.target.value;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                        
                        const selected = result.data.find(d => d.id == this.activeDeviceId);
                        if (selected) this.activeDeviceToken = selected.device_token;
                        
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
        if (!this.activeDeviceId) return;

        try {
            const res = await fetch('/api/devices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                // 🚀 FIXED: Flexible type verification matrix to prevent DB Int vs String UUID selection crashes
                const dev = result.data.find(d => d.id == this.activeDeviceId || d.device_token == this.activeDeviceId);
                if (dev) {
                    this.activeDeviceToken = dev.device_token;
                    this.populateMetadata(dev);
                }
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
            // 🚀 FIXED: Completely overrides the fallback template with real metadata from the child context
            nameEl.innerHTML = `
                <div style="font-size: 1.1rem; color: white; font-weight: bold;">
                    ${dev.name || 'Unknown'} <span style="font-size: 0.8rem; opacity: 0.8;">(${dev.model || ''})</span>
                </div>
                <button onclick="deleteDevice('${dev.id}')" style="margin-top: 8px; background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">
                    Remove Device
                </button>
            `;
        }
    }

    initializeBackgroundTelemetryLoops() {
        setInterval(async () => {
            if (!this.activeDeviceId) return;
            const token = localStorage.getItem('owner_token');
            
            // 🚀 FIXED: Explicitly routes the secure device token to protect secondary tracking microservices
            const targetToken = this.activeDeviceToken || this.activeDeviceId;

            try {
                // 1. Emergency SOS Interception Channel
                const sosRes = await fetch(`/api/sos/monitor?token=${targetToken}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const sosData = await sosRes.json();
                
                const badge = document.getElementById('metric-sos-badge');
                const label = document.getElementById('sos-status-label');
                
                if (sosData.status === "success" && sosData.sos_data.sos_active) {
                    if (badge) { badge.innerText = "🚨 PANIC"; badge.style.color = "#e74c3c"; }
                    if (label) label.innerText = `CRITICAL STATE: Battery ${sosData.sos_data.battery}% | Status: ${sosData.sos_data.status}`;
                    window.triggerSOSWindowOverlay(sosData.sos_data.battery, sosData.sos_data.status);
                } else {
                    if (badge) { badge.innerText = "STANDBY"; badge.style.color = "#fff"; }
                }

                // 2. Proximity Geofence Violation Polling Channel
                const geoRes = await fetch(`/api/geofence/alerts/poll?token=${targetToken}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const geoData = await geoRes.json();
                if (geoData.status === "success" && geoData.alerts.length > 0) {
                    const lastAlert = geoData.alerts[geoData.alerts.length - 1];
                    console.warn(`[Geofence Breach Intercepted]: ${lastAlert}`);
                }

            } catch (e) {
                console.error("Telemetry Loop Execution Failure:", e);
            }
        }, 4000);
    }
}

// =================================================================================
// THE MASTER COMMAND DISPATCHER & REDIRECT ENGINE
// =================================================================================
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

// =================================================================================
// DYNAMIC CONNECTIONS FOR THE 4 ADVANCED NEW FEATURES
// =================================================================================
let liveSocketPipeline = null;

window.toggleScreenStream = async function() {
    const btn = document.getElementById('btn-toggle-stream');
    const viewport = document.getElementById('stream-viewport');
    const canvas = document.getElementById('stream-canvas');
    const placeholder = document.getElementById('stream-placeholder');
    const duration = document.getElementById('stream-duration').value;
    
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');

    if (!deviceId) return alert("Select an active hardware context first.");

    if (btn.innerText.toUpperCase() === "START STREAM") {
        try {
            await fetch(`/api/devices/${deviceId}/action`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: `start_screen_stream:${duration}` })
            });
        } catch (err) { console.error("Stream initialization request skipped:", err); }

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const host = window.location.host;
        
        liveSocketPipeline = new WebSocket(`${protocol}://${host}/ws/dashboard/${deviceId}`);
        liveSocketPipeline.binaryType = "blob"; 

        const ctx = canvas.getContext('2d');

        liveSocketPipeline.onmessage = function(event) {
            if (placeholder) placeholder.style.display = "none";
            const blob = event.data;
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(img.src); 
            };
            img.src = URL.createObjectURL(blob);
        };

        liveSocketPipeline.onclose = function() {
            window.resetStreamUI(btn, viewport, placeholder);
        };

        btn.innerText = "Stop Stream";
        btn.style.background = "rgba(231, 76, 60, 0.8)"; 
        if (viewport) viewport.style.display = "flex";

    } else {
        if (liveSocketPipeline) liveSocketPipeline.close();
        try {
            await fetch(`/api/devices/${deviceId}/action`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "stop_screen_stream" })
            });
        } catch(e) {}
        window.resetStreamUI(btn, viewport, placeholder);
    }
};

window.resetStreamUI = function(btn, viewport, placeholder) {
    if (btn) {
        btn.innerText = "Start Stream";
        btn.style.background = "rgba(46, 204, 113, 0.8)"; 
    }
    if (viewport) viewport.style.display = "none";
    if (placeholder) placeholder.style.display = "block";
};

window.toggleStudyHourPolicy = async function() {
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');
    if (!deviceId) return alert("Missing target identifier context.");

    try {
        const res = await fetch(`/api/settings/toggle-study-hour?token=${deviceId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === "success") {
            const status = data.study_hour_active ? "ACTIVATED" : "DEACTIVATED";
            alert(`Study Hour Restriction Configuration: ${status}`);
        }
    } catch (e) {
        console.error("Policy mapping breakdown:", e);
    }
};

window.triggerSOSWindowOverlay = function(battery, status) {
    let overlay = document.getElementById('sos-alert-window-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sos-alert-window-overlay';
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(192,57,43,0.98); z-index:99999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; padding:25px; text-align:center;";
        overlay.innerHTML = `
            <h1 style="font-size:32px; font-weight:800; margin-bottom:15px;">EMERGENCY SOS SIGNAL ACTIVATED</h1>
            <p id="sos-overlay-desc" style="font-size:16px; margin-bottom:25px; max-width:500px; opacity:0.9;"></p>
            <button onclick="window.dismissSOSAlertState()" style="padding:12px 35px; border:2px solid white; background:none; color:white; font-weight:bold; cursor:pointer; text-transform:uppercase;">Dismiss Emergency</button>
        `;
        document.body.appendChild(overlay);
    }
    const desc = document.getElementById('sos-overlay-desc');
    if (desc) {
        desc.innerText = `Child device context triggered a high-priority emergency event loop. Current Battery: ${battery}% | Network telemetry signature: ${status}`;
    }
};

window.dismissSOSAlertState = async function() {
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');
    
    try {
        await fetch(`/api/sos/clear?token=${deviceId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const overlay = document.getElementById('sos-alert-window-overlay');
        if (overlay) overlay.remove();
        
        const label = document.getElementById('sos-status-label');
        if (label) label.innerText = "Monitoring Panic Signals Matrix";
    } catch (e) {
        console.error("Failed to dismiss SOS state:", e);
    }
};

// =================================================================================
// DIAGNOSTICS & SETTINGS CHECK ENGINE
// =================================================================================
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
        const permRes = await fetch(`/api/devices/diagnostics?device_id=${deviceId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await permRes.json();

        if (result.status !== 'success' || !result.data || result.data.length === 0) {
            content.innerHTML = '<p style="color: #f39c12; text-align: center; margin-top: 20px;">No diagnostic reports synchronized from the target context yet.</p>';
            return;
        }

        const perms = result.data[0];
        
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

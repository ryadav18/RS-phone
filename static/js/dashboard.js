// CORE DASHBOARD ENGINE (Optimized for Flat UI & Real-time Operations)
class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        if (!this.activeDeviceId) return;
        
        // Initial load
        await this.loadDeviceMetrics();
        
        // Real-time Zinda Polling (Har 10 second mein auto-update)
        setInterval(() => this.loadDeviceMetrics(), 10000);
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
                if (dev) {
                    this.populateMetadata(dev);
                }
            }
        } catch (e) {
            console.error("Telemetry Fetch Error:", e);
        }
    }

    populateMetadata(dev) {
        // 1. Zinda Online Status Badge Update
        const badge = document.getElementById('online-badge');
        if (badge) {
            badge.style.color = dev.online_status ? '#2ecc71' : '#e74c3c';
            badge.innerText = dev.online_status ? '● ONLINE' : '○ OFFLINE';
        }

        // 2. Dynamic Battery UI Logic (Card Color Swap)
        const batteryEl = document.getElementById('metric-battery');
        const batteryCard = document.getElementById('battery-card');
        const batteryState = document.getElementById('battery-state');
        
        if (batteryEl && batteryCard) {
            batteryEl.textContent = `${dev.battery_level}%`;
            
            if (dev.is_charging) {
                // Charger connected -> Green Card
                batteryCard.className = 'flat-card bg-green';
                batteryState.textContent = 'Charging';
            } else {
                // Unplugged -> Red Card
                batteryCard.className = 'flat-card bg-red';
                batteryState.textContent = 'Discharging';
            }
        }

        // 3. Storage Update
        const storageEl = document.getElementById('metric-storage');
        if (storageEl) {
            storageEl.textContent = dev.storage_used || 'N/A';
        }

        // 4. Device Name, Model & Pro Remove Button
        const nameEl = document.getElementById('info-name');
        if (nameEl) {
            nameEl.innerHTML = `
                <div style="font-size: 1.1rem; color: white;">
                    ${dev.name} <span style="font-size: 0.8rem; opacity: 0.8;">(${dev.model})</span>
                </div>
                <button onclick="deleteDevice('${dev.id}')" style="margin-top: 8px; background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">
                    Remove Device
                </button>
            `;
        }
    }
}

// ==========================================
// 🚀 ADVANCED OPERATIONS BRIDGE (NEW API CALLS)
// ==========================================

window.executeRemoteAction = async function(actionType) {
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');
    
    if (!deviceId) return alert("No active device selected.");

    // Simple loading feedback
    console.log(`Executing remote command: ${actionType}`);

    try {
        const res = await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: actionType })
        });
        
        const result = await res.json();
        if (result.status === 'success') {
            alert(`✅ Command '${actionType}' sent successfully!`);
        } else {
            alert(`❌ Action Failed: ${result.message}`);
        }
    } catch (e) {
        console.error("Action Execution Error:", e);
        alert("Network error. Could not send command to the target device.");
    }
};

// Dedicated Triggers for HTML Buttons
window.requestScreenCapture = () => window.executeRemoteAction('screen_capture');
window.requestAudioSync = () => window.executeRemoteAction('audio_record');
window.forceLockDevice = () => window.executeRemoteAction('force_lock');


// ==========================================
// GLOBAL DEVICE DELETION
// ==========================================
window.deleteDevice = async function(deviceId) {
    if (!confirm("WARNING: Are you sure you want to permanently remove this device and all its data? This action cannot be undone.")) return;

    const token = localStorage.getItem('owner_token');
    try {
        const res = await fetch(`/api/devices/${deviceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("Device removed successfully.");
            localStorage.removeItem('active_device_id'); 
            window.location.reload(); 
        } else {
            alert("Failed to remove device: " + result.message);
        }
    } catch (e) {
        console.error("Delete Action Failed:", e);
    }
};

// Initialize Engine on Page Load
document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});

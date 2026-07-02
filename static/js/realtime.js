// REALTIME DATA REPLICATION SUBSCRIBER
class RealtimeSubscriberEngine {
    constructor() {
        this.supabaseClient = null;
        this.init();
    }

    async init() {
        const token = localStorage.getItem('owner_token');
        if (!token) return;

        try {
            // Retrieve dynamic keys without local file exposures
            const response = await fetch('/api/config');
            const config = await response.json();

            // Direct initialize of the supabase real-time listening instance
            this.supabaseClient = supabase.createClient(config.supabase_url, config.supabase_key);
            this.subscribeToDeviceStream();
        } catch (e) {
            console.error("Initialization issue inside subscriber network interface", e);
        }
    }

    subscribeToDeviceStream() {
        const activeId = localStorage.getItem('active_device_id');
        if (!activeId) return;

        // Establish channel interface directly from Database row changes
        this.supabaseClient
            .channel('any')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devices', filter: `id=eq.${activeId}` }, payload => {
                this.updateLocalDeviceUI(payload.new);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'permissions', filter: `device_id=eq.${activeId}` }, payload => {
                this.updateLocalPermissionsUI(payload.new);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `device_id=eq.${activeId}` }, payload => {
                this.handleIncomingNotificationStream(payload.new);
            })
            .subscribe();
    }

    updateLocalDeviceUI(device) {
        console.log("Realtime stream input detected on device row:", device);
        const onlineIndicator = document.getElementById('online-badge');
        if (onlineIndicator) {
            if (device.online_status) {
                onlineIndicator.className = 'status-dot online';
            } else {
                onlineIndicator.className = 'status-dot';
            }
        }

        // Live metrics selector queries
        const battery = document.getElementById('metric-battery');
        const charging = document.getElementById('metric-charging');
        const temp = document.getElementById('metric-temp');
        const network = document.getElementById('metric-net');

        if (battery) battery.textContent = `${device.battery_level}%`;
        if (charging) charging.textContent = device.is_charging ? 'Charging' : 'Discharging';
        if (temp) temp.textContent = `${device.temperature}°C`;
        if (network) network.textContent = device.network_type;
    }

    updateLocalPermissionsUI(perm) {
        console.log("Realtime execution payload matched for system permissions changes:", perm);
        // Instant update elements matches
        if (window.location.pathname.includes('permissions')) {
            window.location.reload();
        }
    }

    handleIncomingNotificationStream(notification) {
        console.log("Realtime synchronization notification event captured:", notification);
        const container = document.getElementById('notifications-stream');
        if (container) {
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <div>
                    <strong>${notification.app_name}</strong> - ${notification.title}
                    <p style="color: #94a3b8; font-size: 0.9rem;">${notification.message}</p>
                </div>
                <div style="color: #94a3b8; font-size: 0.85rem;">Just Now</div>
            `;
            container.prepend(el);
        }
    }
}

// Global invocation setup
document.addEventListener('DOMContentLoaded', () => {
    new RealtimeSubscriberEngine();
});
class SettingsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        await this.populateDevicesDropdown();
        if (!this.activeDeviceId) return;
        await this.loadCurrentDevicePolicy();
    }

    async populateDevicesDropdown() {
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
                        selectEl.innerHTML = '<option value="">No Devices Present</option>';
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
                        this.loadCurrentDevicePolicy();
                    });
                }
            }
        } catch (e) { console.error("Dropdown allocation breakdown:", e); }
    }

    async loadCurrentDevicePolicy() {
        const token = localStorage.getItem('owner_token');
        const loader = document.getElementById('settings-loading-layer');
        const form = document.getElementById('settings-form-layer');

        loader.style.display = 'block';
        form.style.display = 'none';

        try {
            // 🚀 CRITICAL PATCH: Target proxy URL instead of hitting direct Supabase API from client context
            const res = await fetch(`/api/settings?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();

            loader.style.display = 'none';
            form.style.display = 'flex';

            if (result.status === 'success' && result.data.length > 0) {
                const policy = result.data[0];
                document.getElementById('toggle-sms').checked = policy.sync_sms;
                document.getElementById('toggle-calls').checked = policy.sync_calls;
                document.getElementById('toggle-location').checked = policy.sync_location;
                document.getElementById('toggle-contacts').checked = policy.sync_contacts;
                document.getElementById('toggle-photos').checked = policy.sync_photos;
            } else {
                // If the device registry configuration space is brand new, default parameters stay ON
                document.querySelectorAll('input[type="checkbox"]').forEach(box => box.checked = true);
            }
        } catch (error) {
            console.error("Configuration sync state load exception:", error);
        }
    }

    async saveActiveDeviceSettings() {
        const token = localStorage.getItem('owner_token');
        const saveButton = document.getElementById('save-btn');
        
        saveButton.innerText = "Deploying Policy...";
        saveButton.disabled = true;

        const payload = {
            device_id: this.activeDeviceId,
            sync_sms: document.getElementById('toggle-sms').checked,
            sync_calls: document.getElementById('toggle-calls').checked,
            sync_location: document.getElementById('toggle-location').checked,
            sync_contacts: document.getElementById('toggle-contacts').checked,
            sync_photos: document.getElementById('toggle-photos').checked
        };

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.status === 'success') {
                saveButton.innerText = "Configuration Synced!";
                saveButton.style.background = "#2ecc71";
                setTimeout(() => {
                    saveButton.innerText = "Apply System Rules";
                    saveButton.style.background = "#3498db";
                    saveButton.disabled = false;
                }, 2000);
            } else {
                throw new Error(result.message);
            }
        } catch (e) {
            saveButton.innerText = "Deployment Fault";
            saveButton.style.background = "#e74c3c";
            setTimeout(() => {
                saveButton.innerText = "Apply System Rules";
                saveButton.style.background = "#3498db";
                saveButton.disabled = false;
            }, 2000);
        }
    }
}

window.settingsEngine = null;
document.addEventListener('DOMContentLoaded', () => {
    window.settingsEngine = new SettingsEngine();
});

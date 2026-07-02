// MAIN CORE APPLICATION INTERACTION SYSTEM
class AppCore {
    constructor() {
        this.selectedDeviceId = localStorage.getItem('active_device_id') || '';
        this.init();
    }

    async init() {
        this.renderGlobalUIElements();
        await this.discoverAuthorizedDevices();
        this.bindEvents();
    }

    renderGlobalUIElements() {
        // Hydrate navigation highlighting parameters
        const path = window.location.pathname;
        const links = document.querySelectorAll('.sidebar-menu li');
        links.forEach(li => {
            const linkPath = li.querySelector('a')?.getAttribute('href');
            if (linkPath && path.startsWith(linkPath)) {
                li.classList.add('active');
            } else {
                li.classList.remove('active');
            }
        });

        // Set up logout button handler
        const logoutBtn = document.getElementById('logout-action');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                AuthenticationEngine.performSignOut();
            });
        }
    }

    async discoverAuthorizedDevices() {
        const token = localStorage.getItem('owner_token');
        if (!token) return;

        try {
            const response = await fetch('/api/devices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            if (result.status === 'success' && result.data.length > 0) {
                this.populateDeviceDropdown(result.data);
            } else {
                this.showDeviceEmptyState();
            }
        } catch (err) {
            console.error('Device configuration lookup issue:', err);
        }
    }

    populateDeviceDropdown(devices) {
        const switcher = document.getElementById('device-select');
        if (!switcher) return;

        switcher.innerHTML = '';
        devices.forEach(dev => {
            const opt = document.createElement('option');
            opt.value = dev.id;
            opt.textContent = `${dev.name} (${dev.model})`;
            if (this.selectedDeviceId === dev.id) {
                opt.selected = true;
            }
            switcher.appendChild(opt);
        });

        if (!this.selectedDeviceId) {
            this.selectedDeviceId = devices[0].id;
            localStorage.setItem('active_device_id', this.selectedDeviceId);
        }

        switcher.addEventListener('change', (e) => {
            this.selectedDeviceId = e.target.value;
            localStorage.setItem('active_device_id', this.selectedDeviceId);
            window.location.reload();
        });
    }

    showDeviceEmptyState() {
        const switcher = document.getElementById('device-select');
        if (switcher) {
            switcher.innerHTML = '<option value="">No Devices Linked</option>';
        }
    }

    bindEvents() {
        // Additional modular integrations hooks if required
    }
}

// Bootstrap
let App;
document.addEventListener('DOMContentLoaded', () => {
    App = new AppCore();
});
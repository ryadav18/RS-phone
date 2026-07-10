class AppsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.currentAppIds = []; 
        this.allAppsCurrentChunk = [];
        this.init();
    }

    async init() {
        const container = document.getElementById('apps-container');
        if (!container) return;

        if (!this.activeDeviceId) {
            container.innerHTML = '<p style="color: #e74c3c; text-align: center;">Target Device ID missing. Please select a device.</p>';
            return;
        }

        // Live Search Setup
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const filtered = this.allAppsCurrentChunk.filter(a => 
                    (a.app_name && a.app_name.toLowerCase().includes(query)) || 
                    (a.package_name && a.package_name.toLowerCase().includes(query))
                );
                this.renderApps(filtered);
            });
        }

        this.fetchApps();
    }

    async fetchApps() {
        const token = localStorage.getItem('owner_token');
        const container = document.getElementById('apps-container');
        const controls = document.getElementById('pagination-controls');
        const statsBar = document.getElementById('stats-bar');
        
        container.innerHTML = '<p style="color:#aaa; text-align: center;">Loading secure registry chunk...</p>';
        controls.innerHTML = '';
        statsBar.style.display = 'none';

        try {
            const res = await fetch(`/api/apps?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();

            if (result.status === 'success') {
                if (result.data.length === 0) {
                    container.innerHTML = '<p style="color:#aaa; text-align: center;">No apps available in registry. Waiting for device sync...</p>';
                    return;
                }

                this.currentAppIds = result.data.map(a => a.id);
                this.allAppsCurrentChunk = result.data;

                this.updateChunkStats(result.data);
                this.renderApps(result.data);

                // Agar theek 20 apps aayi hain, matlab database mein aur bhi ho sakti hain
                if (result.data.length === 20) {
                    controls.innerHTML = `
                        <button id="next-chunk-btn" style="background:#e74c3c; color:white; padding:12px 20px; border:none; border-radius:4px; cursor:pointer; font-weight:bold; width: 100%; font-size: 16px; margin-top: 15px; text-transform: uppercase;">
                            Burn This Page & Load Next 20
                        </button>
                    `;
                    document.getElementById('next-chunk-btn').addEventListener('click', () => this.loadNextPageAndBurn());
                }
            }
        } catch (e) {
            console.error("Apps Fetch Error:", e);
            container.innerHTML = '<p style="color: #e74c3c; text-align: center;">Network Error: Failed to fetch apps.</p>';
        }
    }

    updateChunkStats(appData) {
        const statsBar = document.getElementById('stats-bar');
        if (!statsBar) return;
        
        statsBar.style.display = 'flex';
        const total = appData.length;
        const systemCount = appData.filter(a => a.is_system_app).length;
        const userCount = total - systemCount;

        document.getElementById('stat-total').innerText = `Page Total: ${total}`;
        document.getElementById('stat-user').innerText = `User: ${userCount}`;
        document.getElementById('stat-system').innerText = `System: ${systemCount}`;
    }

    renderApps(appList) {
        const container = document.getElementById('apps-container');
        container.innerHTML = '';
        
        if (appList.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center;">No apps match your search in this chunk.</p>';
            return;
        }

        appList.forEach(app => {
            const isSystem = app.is_system_app;
            const badgeClass = isSystem ? 'system-app' : 'user-app';
            const badgeText = isSystem ? 'SYSTEM' : 'USER';
            const borderColor = isSystem ? '#e74c3c' : '#2ecc71';

            const card = document.createElement('div');
            card.className = 'app-card';
            card.style.borderLeftColor = borderColor;
            
            card.innerHTML = `
                <div class="app-info">
                    <span class="app-name">${app.app_name}</span>
                    <span class="app-pkg">${app.package_name}</span>
                </div>
                <div>
                    <span class="badge ${badgeClass}">${badgeText}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    async loadNextPageAndBurn() {
        const isConfirmed = confirm("Security Warning: This action will permanently delete these 20 apps from the server to load the next chunk. Proceed?");
        if (!isConfirmed) return;

        const token = localStorage.getItem('owner_token');
        const nextBtn = document.getElementById('next-chunk-btn');
        if (nextBtn) nextBtn.innerText = "Burning old records...";

        try {
            if (this.currentAppIds.length > 0) {
                await fetch('/api/apps/burn', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        device_id: this.activeDeviceId,
                        app_ids: this.currentAppIds
                    })
                });
            }

            this.fetchApps();

        } catch (e) {
            console.error("Burn Engine Error:", e);
            alert("Failed to process the next chunk.");
            if (nextBtn) nextBtn.innerText = "Burn This Page & Load Next 20";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new AppsEngine());

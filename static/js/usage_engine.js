document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('usage-container');
    const token = localStorage.getItem('session_token');
    const deviceId = localStorage.getItem('current_device_id');

    if (!token || !deviceId) {
        container.innerHTML = '<p style="color: #d32f2f;">Critical Error: Session or Target Device ID missing. Please re-authenticate from the dashboard.</p>';
        return;
    }

    try {
        // 1. Fetch Supabase Public Config
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        // 2. Fetch Usage Data directly from Supabase REST API (Order by highest usage)
        const usageRes = await fetch(`${config.supabase_url}/rest/v1/app_usage?device_id=eq.${deviceId}&order=time_spent.desc`, {
            headers: {
                'apikey': config.supabase_key,
                'Authorization': `Bearer ${config.supabase_key}`
            }
        });

        const usageData = await usageRes.json();

        if (!usageData || usageData.length === 0) {
            container.innerHTML = '<p style="color: #aaa;">No active app usage telemetry detected for this device yet.</p>';
            return;
        }

        container.innerHTML = ''; // Clear loading state

        // 3. Render DOM Elements dynamically
        usageData.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            
            // Format time intelligently
            let timeText = `${app.time_spent} seconds`;
            if (app.time_spent >= 3600) {
                timeText = `${(app.time_spent / 3600).toFixed(1)} hours`;
            } else if (app.time_spent >= 60) {
                timeText = `${Math.floor(app.time_spent / 60)} minutes`;
            }

            card.innerHTML = `
                <div class="app-info">
                    <span class="app-name">${app.app_name}</span>
                    <span class="app-pkg">${app.package_name}</span>
                    <span class="app-time">Foreground Time: ${timeText}</span>
                </div>
                <button class="block-btn" onclick="triggerAppBlock('${app.package_name}', '${app.app_name}')">Block App</button>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Telemetry Fetch Failure:", error);
        container.innerHTML = '<p style="color: #d32f2f;">Failed to retrieve app data. Check console logs.</p>';
    }
});

// ==========================================
// 🚀 THE BLOCKING ENGINE EXECUTOR
// ==========================================
async function triggerAppBlock(packageName, appName) {
    const isConfirmed = confirm(`SECURITY WARNING: Are you sure you want to enforce a remote block on ${appName}?`);
    if (!isConfirmed) return;

    const token = localStorage.getItem('session_token');
    const deviceId = localStorage.getItem('current_device_id');

    try {
        const res = await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'block_app',
                target_package: packageName
            })
        });

        const data = await res.json();
        
        if (data.status === 'success') {
            alert(`SUCCESS: Block command for ${appName} injected into the Sync Queue. Device will apply rules on next polling cycle.`);
        } else {
            alert(`Execution Failed: ${data.message}`);
        }
    } catch (error) {
        alert('Network Failure: Unable to establish secure link with the action server.');
        console.error(error);
    }
}

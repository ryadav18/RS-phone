class GalleryEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        
        // 🚀 GALLERY STATES: Dedicated memory buffers for 5-items per page slicing
        this.allData = [];
        this.currentPage = 1;
        this.itemsPerPage = 5;

        this.init();
    }

    init() {
        this.setupPaginationListeners();
        
        const token = localStorage.getItem('owner_token');
        if (!token || !this.activeDeviceId) {
            const container = document.getElementById('gallery-container');
            if (container) {
                container.innerHTML = '<p style="color: #d32f2f; text-align: center; padding: 20px;">Critical Error: Session or Target Device ID missing. Please re-authenticate via Dashboard.</p>';
            }
            return;
        }

        this.fetchGallery();
        // 15 seconds real-time background refresh check loop
        setInterval(() => this.fetchGallery(), 15000);
    }

    // Bind click events directly to the theme-compliant pagination nodes
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
        try {
            // 🚀 SECURE GATEWAY ROUTING: Pulling data out of our custom Flask proxy channel
            const res = await fetch(`/api/gallery?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            
            if (result.status === 'success') {
                this.allData = result.data || [];
                this.renderCurrentPage();
            }
        } catch (error) {
            console.error("Gallery Telemetry Buffer Sync Failure:", error);
            const container = document.getElementById('gallery-container');
            if (container && this.allData.length === 0) {
                container.innerHTML = '<p style="color: #d32f2f; text-align: center;">Database bridge handshake failed. Check server status logs.</p>';
            }
        }
    }

    renderCurrentPage() {
        const container = document.getElementById('gallery-container');
        if (!container) return;

        if (this.allData.length === 0) {
            container.innerHTML = '<div class="empty-state">No photos captured or synchronized yet.<br><small>Waiting for device payload sequence...</small></div>';
            this.updatePaginationUI(1);
            return;
        }

        container.innerHTML = '<div class="gallery-grid" id="grid"></div>';
        const grid = document.getElementById('grid');

        // 🧠 DATA SLICING ENGINE: Mathematically extract exactly 5 frames for the active view viewport
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const slicedPhotos = this.allData.slice(startIndex, endIndex);

        slicedPhotos.forEach(photo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            
            // Format timestamps safely with fallbacks if database synchronization lags
            const dateObj = photo.created_at ? new Date(photo.created_at) : new Date();
            const formattedDate = dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

            // 🚀 DYNAMIC EMBED LOGIC: Renders raw Google Drive binary stream straight inside the dashboard box container
            const imageRenderHtml = photo.media_url 
                ? `<img src="${photo.media_url}" alt="${photo.file_name}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 6px; margin-bottom: 12px; border: 1px solid #2a2a2a;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23555\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg>'; this.style.opacity='0.5';">`
                : `<div class="file-icon">🖼️</div>`;

            card.innerHTML = `
                <div>
                    ${imageRenderHtml}
                    <div class="file-name" title="${photo.file_name || 'Unknown_Image.jpg'}">${photo.file_name || 'Unknown_Image.jpg'}</div>
                    <div class="file-meta">
                        Synced: ${formattedDate}<br>
                        Source: <span style="color: var(--accent-cyan, #00f0ff); font-weight: 600;">Google Drive Isolated Vault</span>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <a href="${photo.media_url}" target="_blank" class="view-btn">👁️ Full Resolution View</a>
                </div>
            `;
            grid.appendChild(card);
        });

        const totalPages = Math.ceil(this.allData.length / this.itemsPerPage) || 1;
        this.updatePaginationUI(totalPages);
    }

    // 🚀 PAGINATION STATE CONTROLLER: Dynamic bounds tracking loop
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

class MessagesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        
        // 🚀 CONVERSATION THREAD STATES: Memory allocation buffers for grouped contexts
        this.allData = [];
        this.currentPage = 1;
        this.itemsPerPage = 5; // Reduced to 5 threads per page because each thread holds multiple chats safely
        this.lastDataHash = "";  

        this.init();
    }

    async init() {
        this.setupPaginationListeners();
        await this.loadDevicesList();
        if (!this.activeDeviceId) return; 
        
        this.fetchMessages();
        // 12 seconds high-speed telemetry polling loop
        setInterval(() => this.fetchMessages(), 12000); 
    }

    setupPaginationListeners() {
        const prevBtn = document.getElementById('sms-prev-btn');
        const nextBtn = document.getElementById('sms-next-btn');

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
                // Group calculation for page metrics safety clamping
                const groupedThreads = this.groupDataIntoThreads();
                const totalPages = Math.ceil(groupedThreads.length / this.itemsPerPage) || 1;
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderCurrentPage();
                }
            });
        }
    }

    async loadDevicesList() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch('/api/devices', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success') {
                const selectEl = document.getElementById('device-select');
                if (selectEl) {
                    selectEl.innerHTML = ''; 
                    if (!result.data || result.data.length === 0) {
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
                        this.currentPage = 1; 
                        this.lastDataHash = ""; 
                        this.fetchMessages(); 
                    });
                }
            }
        } catch (e) { console.error("Failed to load devices:", e); }
    }

    async fetchMessages() {
        const token = localStorage.getItem('owner_token');
        if (!this.activeDeviceId) return;
        try {
            const res = await fetch(`/api/messages?device_id=${this.activeDeviceId}&limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                const incomingData = result.data || [];
                const currentDataHash = incomingData.map(m => m.id + "_" + (m.message_type || m.type || '')).join("|");
                
                if (this.lastDataHash !== currentDataHash) {
                    this.lastDataHash = currentDataHash;
                    this.allData = incomingData;
                    this.renderCurrentPage();
                }
            }
        } catch (e) { console.error("Messages Transmission Engine Error:", e); }
    }

    // 🧠 CORE THREADING ENGINES: Processes the flat array records into structural identities
    groupDataIntoThreads() {
        const threadsMap = {};

        this.allData.forEach(m => {
            // Isolate true contact thread name or fallback to number safely
            let threadIdentity = (m.contact_name && m.contact_name !== 'Unknown' && m.contact_name.trim() !== '') 
                ? m.contact_name 
                : (m.sender && m.sender !== 'Me' ? m.sender : 'Unknown Identity');

            // If number details map exists, cross-link it to prevent empty phone tags
            let associatedPhone = (m.sender && m.sender !== 'Me') ? m.sender : '';
            if (threadIdentity === associatedPhone) associatedPhone = 'Direct Protocol';

            if (!threadsMap[threadIdentity]) {
                threadsMap[threadIdentity] = {
                    name: threadIdentity,
                    phone: associatedPhone,
                    messagesList: []
                };
            }
            threadsMap[threadIdentity].messagesList.push(m);
        });

        // Convert grouped keys map to linear arrays sorted dynamically by latest chat time execution
        return Object.values(threadsMap).sort((a, b) => {
            const latestA = Math.max(...a.messagesList.map(m => new Date(m.timestamp).getTime()));
            const latestB = Math.max(...b.messagesList.map(m => new Date(m.timestamp).getTime()));
            return latestB - latestA;
        });
    }

    renderCurrentPage() {
        const container = document.getElementById('sms-list');
        if (!container) return;

        const sortedThreads = this.groupDataIntoThreads();

        if (sortedThreads.length === 0) {
            container.innerHTML = '<div style="color: #888; text-align: center; padding: 40px;">No communication logs captured. Awaiting mobile transmitter sync...</div>';
            this.updatePaginationUI(1);
            return;
        }

        // Apply pagination parameters strictly over the Grouped Thread nodes
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const slicedThreads = sortedThreads.slice(startIndex, endIndex);

        container.innerHTML = slicedThreads.map(thread => {
            
            // Sort nested logs chronologically (Oldest messages top, newest bottom inside thread viewport)
            const chronologicalMessages = thread.messagesList.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            // 🚀 BUBBLE INJECTION CORE: Transforms raw metrics to clear premium Left/Right chat flows
            const bubblesHtml = chronologicalMessages.map(m => {
                const rawType = String(m.message_type || m.type || '1').toUpperCase().trim();
                
                // Absolute Classifier Protocol: Zero confusion rule between incoming and outgoing streams
                const isSent = (rawType === '2' || rawType === 'SENT' || rawType === 'RCS_SENT' || m.sender === 'Me');
                
                // Dynamic alignment vectors mapping configurations
                const wrapperStyle = isSent 
                    ? 'display: flex; justify-content: flex-end; width: 100%; margin-bottom: 10px; padding-left: 25%;' 
                    : 'display: flex; justify-content: flex-start; width: 100%; margin-bottom: 10px; padding-right: 25%;';

                const bubbleStyle = isSent
                    ? 'background: rgba(0, 240, 255, 0.12); color: #e0faff; border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 14px 14px 2px 14px; padding: 10px 14px;'
                    : 'background: rgba(255, 255, 255, 0.04); color: #f0f0f0; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px 14px 14px 2px; padding: 10px 14px;';

                const dateObj = new Date(m.timestamp);
                const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                let mediaAttachmentHtml = '';
                if (m.media_url || (m.message && (m.message.includes('.jpg') || m.message.includes('.png')))) {
                    mediaAttachmentHtml = `
                    <div style="display: flex; align-items: center; gap: 4px; margin-top: 6px; color: #00f0ff; font-size: 11px; font-weight: 500;">
                        <i data-lucide="image" style="width: 12px; height: 12px;"></i>
                        <span>Multimedia Uploaded</span>
                    </div>`;
                }

                return `
                <div style="${wrapperStyle}">
                    <div style="${bubbleStyle} min-width: 80px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                        <p style="margin: 0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; text-align: left;">${m.message || '[Empty Data String]'}</p>
                        ${mediaAttachmentHtml}
                        <div style="font-size: 9px; color: rgba(255,255,255,0.3); text-align: right; margin-top: 4px; font-weight: 500;">
                            ${timeStr}
                        </div>
                    </div>
                </div>
                `;
            }).join('');

            return `
            <div class="sms-card" style="margin-bottom: 25px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <div class="sms-meta-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin-bottom: 15px;">
                    <div class="sms-sender-info" style="display: flex; flex-direction: column;">
                        <span class="sms-sender-name" style="font-weight: 700; color: #fff; font-size: 15px; letter-spacing: 0.3px;">${thread.name}</span>
                        <span class="sms-sender-phone" style="font-size: 11px; color: #666; margin-top: 2px; font-family: monospace;">${thread.phone}</span>
                    </div>
                    <span style="font-size: 11px; background: rgba(0, 240, 255, 0.1); color: #00f0ff; padding: 4px 10px; border-radius: 20px; font-weight: 600; border: 1px solid rgba(0, 240, 255, 0.15);">
                        ${thread.messagesList.length} LOGS
                    </span>
                </div>
                
                <!-- Chat Viewport Container Frame -->
                <div class="chat-viewport-stream" style="display: flex; flex-direction: column; max-height: 380px; overflow-y: auto; padding-right: 6px;">
                    ${bubblesHtml}
                </div>
            </div>
            `;
        }).join('');
        
        const totalPages = Math.ceil(sortedThreads.length / this.itemsPerPage) || 1;
        this.updatePaginationUI(totalPages);

        if (window.lucide) window.lucide.createIcons();
    }

    updatePaginationUI(totalPages) {
        const prevBtn = document.getElementById('sms-prev-btn');
        const nextBtn = document.getElementById('sms-next-btn');
        const indicator = document.getElementById('sms-page-num');

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

window.wipeSMSHistory = async function() {
    if(!confirm("WARNING: Force flush all active text logs?")) return;
    const token = localStorage.getItem('owner_token');
    const activeId = localStorage.getItem('active_device_id');
    try {
        const res = await fetch('/api/messages/clear', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: activeId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("SMS logs wiped cleanly.");
            window.location.reload();
        }
    } catch (e) { console.error(e); }
};

document.addEventListener('DOMContentLoaded', () => new MessagesEngine());

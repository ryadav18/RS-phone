class OpsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    init() {
        if (!this.activeDeviceId) {
            document.getElementById('ops-list').innerHTML = '<p style="color: red;">No device selected.</p>';
            return;
        }
        
        // Pehli baar fetch karo
        this.fetchOperations();
        
        // Har 5 second mein naya data laao taaki 'Pending' status auto-update ho jaye
        setInterval(() => this.fetchOperations(), 5000);
    }

    async fetchOperations() {
        const token = localStorage.getItem('owner_token');
        const container = document.getElementById('ops-list');

        try {
            const res = await fetch(`/api/ops?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            
            if (result.status === 'success') {
                this.renderOperations(result.data);
            }
        } catch (e) {
            console.error("Ops Fetch Error:", e);
        }
    }

    renderOperations(ops) {
        const container = document.getElementById('ops-list');
        
        if (ops.length === 0) {
            container.innerHTML = '<p style="color: #888;">No operations recorded for this device.</p>';
            return;
        }

        container.innerHTML = ops.map(op => {
            // Status Badge Config
            let statusBadge = '';
            if (op.status === 'pending') statusBadge = '<span class="status status-pending">⏳ PENDING</span>';
            else if (op.status === 'success') statusBadge = '<span class="status status-success">✅ SUCCESS</span>';
            else statusBadge = '<span class="status status-failed">❌ FAILED</span>';

            // Format Date
            const dateStr = new Date(op.created_at).toLocaleString('en-IN');

            // Result Viewer Config (Image, Audio, or Error)
            let resultHtml = '';
            if (op.status === 'success' && op.result_data) {
                if (op.command.includes('screenshot')) {
                    resultHtml = `<div class="result-box"><a href="${op.result_data}" target="_blank"><img src="${op.result_data}" class="result-img" alt="Screenshot"></a></div>`;
                } else if (op.command.includes('audio')) {
                    resultHtml = `<div class="result-box"><audio controls src="${op.result_data}"></audio></div>`;
                } else {
                    resultHtml = `<div class="result-box"><span style="color:#27ae60;">Action completed successfully.</span></div>`;
                }
            } else if (op.status === 'failed' && op.result_data) {
                resultHtml = `<div class="result-box"><span class="error-text">Reason: ${op.result_data}</span></div>`;
            }

            // Return clean HTML card
            return `
            <div class="op-card">
                <div class="op-header">
                    <div>
                        <div class="op-title">${op.command.replace('_', ' ')}</div>
                        <div class="op-time">${dateStr}</div>
                    </div>
                    <div>${statusBadge}</div>
                </div>
                ${resultHtml}
            </div>
            `;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new OpsEngine();
});

class UsageEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.rawUsageData = []; // Pure 7 din ka array
        this.groupedData = {};  // Date mapping dict {"2026-05-10": [...]}
        this.selectedDate = null;
        this.init();
    }

    async init() {
        const container = document.getElementById('usage-container');
        if (!this.activeDeviceId) {
            container.innerHTML = '<p style="color: #d32f2f; text-align: center;">Target Device ID reference missing.</p>';
            return;
        }
        await this.fetchAnalyticsData();
    }

    async integrateTokenCheck() {
        return localStorage.getItem('owner_token');
    }

    async fetchAnalyticsData() {
        const token = await this.integrateTokenCheck();
        const container = document.getElementById('usage-container');

        try {
            // Naye clean python analytics route ko target kiya
            const res = await fetch(`/api/usage/analytics?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();

            if (result.status === 'success') {
                if (result.data.length === 0) {
                    container.innerHTML = '<p style="color: #aaa; text-align: center;">No active app usage metrics found for this period.</p>';
                    return;
                }

                this.rawUsageData = result.data;
                this.groupDataByDate();
                this.renderDayTabs();
                
                // By default jo sabse latest/pehla din ho, use open karo
                const availableDates = Object.keys(this.groupedData);
                if (availableDates.length > 0) {
                    this.switchActiveDay(availableDates[0]);
                }
            }
        } catch (e) {
            console.error("Telemetry Processing Error:", e);
            container.innerHTML = '<p style="color: #d32f2f; text-align: center;">Network Failure: Failed to sync analytics blueprint.</p>';
        }
    }

    groupDataByDate() {
        this.groupedData = {};
        this.rawUsageData.forEach(item => {
            const dateKey = item.usage_date;
            if (!this.groupedData[dateKey]) {
                this.groupedData[dateKey] = [];
            }
            this.groupedData[dateKey].push(item);
        });
    }

    renderDayTabs() {
        const tabsContainer = document.getElementById('day-tabs-container');
        const dates = Object.keys(this.groupedData); // Returns array of uniquely grouped dates

        tabsContainer.innerHTML = dates.map((dateStr, index) => {
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            return `
                <button class="tab-btn ${index === 0 ? 'active' : ''}" id="tab-${dateStr}" onclick="window.usageEngine.switchActiveDay('${dateStr}')">
                    ${formattedDate}
                </button>
            `;
        }).join('');
    }

    switchActiveDay(dateStr) {
        this.selectedDate = dateStr;
        
        // Remove active state from all buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        // Add active class to current selection
        const activeBtn = document.getElementById(`tab-${dateStr}`);
        if (activeBtn) activeBtn.classList.add('active');

        this.renderDayRecords();
    }

    renderDayRecords() {
        const container = document.getElementById('usage-container');
        const records = this.groupedData[this.selectedDate] || [];
        
        // Calculate dynamic grand total screen time for this selected day
        let totalSeconds = records.reduce((sum, item) => sum + item.time_spent, 0);
        this.updateTotalScreenTimeDisplay(totalSeconds);

        if (records.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center;">No entries for this date.</p>';
            return;
        }

        container.innerHTML = records.map(app => {
            let timeText = `${app.time_spent}s`;
            if (app.time_spent >= 3600) {
                const hrs = Math.floor(app.time_spent / 3600);
                const mins = Math.floor((app.time_spent % 3600) / 60);
                timeText = `${hrs} hr ${mins} min`;
            } else if (app.time_spent >= 60) {
                timeText = `${Math.floor(app.time_spent / 60)} min`;
            }

            return `
                <div class="app-card">
                    <div class="app-info">
                        <span class="app-name">${app.app_name}</span>
                        <span class="app-pkg">${app.package_name}</span>
                        <span class="app-time">Active Runtime: ${timeText}</span>
                    </div>
                    <button class="block-btn" onclick="window.usageEngine.triggerAppBlock('${app.package_name}', '${app.app_name}')">Block</button>
                </div>
            `;
        }).join('');
    }

    updateTotalScreenTimeDisplay(totalSeconds) {
        const totalDisplay = document.getElementById('day-total-screentime');
        if (!totalDisplay) return;

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        totalDisplay.innerText = `${hours} Hours ${minutes} Minutes`;
    }

    async triggerAppBlock(packageName, appName) {
        const isConfirmed = confirm(`SECURITY PROTOCOL: Are you sure you want to enforce a real-time system restriction on ${appName}?`);
        if (!isConfirmed) return;

        const token = await this.integrateTokenCheck();
        
        try {
            const res = await fetch(`/api/devices/${this.activeDeviceId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'block_app',
                    target_package: packageName
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                alert(`SUCCESS: Restriction parameters for ${appName} pushed to device runtime queue.`);
            } else {
                alert(`Execution Error: ${data.message}`);
            }
        } catch (error) {
            alert('Network failure processing the lockdown request.');
        }
    }
}

// Global object linkage
window.usageEngine = null;
document.addEventListener('DOMContentLoaded', () => {
    window.usageEngine = new UsageEngine();
});

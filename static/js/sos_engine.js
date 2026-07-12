/**
 * Emergency SOS Telemetry Script Agent.
 * Continuously polls critical status pathways to detect remote hardware panic triggers.
 */
document.addEventListener("DOMContentLoaded", function() {
    // Start continuous observation polling loop thread context
    setInterval(checkEmergencySOSState, 4000); 
});

function checkEmergencySOSState() {
    const deviceSelect = document.getElementById('device-select');
    const activeDeviceToken = deviceSelect ? deviceSelect.value : "mock_device_token";
    const sosBadge = document.getElementById('metric-sos-badge');
    const sosLabel = document.getElementById('sos-status-label');

    fetch(`/api/sos/monitor?token=${activeDeviceToken}`)
    .then(res => res.json())
    .then(data => {
        if (data.status === "success" && data.sos_data.sos_active) {
            // Update Main UI Display Node Indicators
            if (sosBadge) {
                sosBadge.innerText = "🚨 PANIC";
                sosBadge.style.color = "#ff5252";
            }
            if (sosLabel) {
                sosLabel.innerText = `CRITICAL STATE: Battery ${data.sos_data.battery}% | Alert: ${data.sos_data.status}`;
            }

            // Trigger the explicit absolute overlay window modal box
            triggerSOSScreenOverlayModal(data.sos_data.battery, data.sos_data.status);
        } else {
            if (sosBadge) {
                sosBadge.innerText = "STANDBY";
                sosBadge.style.color = "#fff";
            }
        }
    })
    .catch(err => console.error("SOS thread evaluation channel broken: ", err));
}

function triggerSOSScreenOverlayModal(battery, details) {
    let modal = document.getElementById('sos-alert-window-overlay');
    if (!modal) {
        // Dynamically inject a high-priority structural overlay wrapper layout sheet directly into DOM base
        modal = document.createElement('div');
        modal.id = 'sos-alert-window-overlay';
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,0,0,0.95); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; padding:30px; text-align:center;";
        
        modal.innerHTML = `
            <i data-lucide="alert-octagon" style="width:80px; height:80px; margin-bottom:20px; animation: pulse 1s infinite;"></i>
            <h1 style="font-size:36px; font-weight:800; letter-spacing:1px; margin-bottom:15px;">EMERGENCY SOS SIGNAL RECEIVED</h1>
            <p id="sos-modal-desc" style="font-size:18px; max-width:600px; opacity:0.9; margin-bottom:30px;">Loading details...</p>
            <button onclick="dismissEmergencySOSStateAlert()" style="padding:15px 40px; border:2px solid white; background:none; color:white; font-weight:bold; cursor:pointer; text-transform:uppercase; border-radius:4px;">Dismiss Alert State</button>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('sos-modal-desc').innerText = `The child device triggered a manual panic loop. Hardware Status Check -> Current Battery Level: ${battery}% | Target Payload Signature: ${details}`;
}

function dismissEmergencySOSStateAlert() {
    const deviceSelect = document.getElementById('device-select');
    const activeDeviceToken = deviceSelect ? deviceSelect.value : "mock_device_token";
    
    fetch(`/api/sos/clear?token=${activeDeviceToken}`, { method: 'POST' })
    .then(() => {
        const modal = document.getElementById('sos-alert-window-overlay');
        if (modal) modal.remove();
        
        const sosLabel = document.getElementById('sos-status-label');
        if (sosLabel) sosLabel.innerText = "Monitoring Panic Signals Matrix";
    });
}

/**
 * Live Screen Mirroring Frontend Engine.
 * Manages WebSocket binary frame connections and paints raw bytes directly onto the canvas context.
 */
let liveSocketPipeline = null;

function toggleScreenStream() {
    const btn = document.getElementById('btn-toggle-stream');
    const viewport = document.getElementById('stream-viewport');
    const canvas = document.getElementById('stream-canvas');
    const placeholder = document.getElementById('stream-placeholder');
    const duration = document.getElementById('stream-duration').value;
    
    // Extract token identifier directly from your dashboard selector framework
    const deviceSelect = document.getElementById('device-select');
    const activeDeviceToken = deviceSelect ? deviceSelect.value : "mock_device_token";

    if (btn.innerText === "START STREAM") {
        console.log("[Pipeline] Invoking WebSocket bridge channel initialization sequence...");
        
        // 1. Inject trigger command into HTTP REST queue matrix
        fetch(`/api/sync/commands/trigger?token=${activeDeviceToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: `take_screenshot_stream:${duration}` })
        })
        .then(res => res.json())
        .catch(err => console.error("REST Execution Error: ", err));

        // 2. Open high-speed WebSocket binary connection framework
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const host = window.location.host; // Automatically binds to python execution environment
        
        liveSocketPipeline = new WebSocket(`${protocol}://${host}/ws/dashboard/${activeDeviceToken}`);
        liveSocketPipeline.binaryType = "blob"; // Strictly enforce binary transfer context definitions

        const ctx = canvas.getContext('2d');

        liveSocketPipeline.onmessage = function(event) {
            placeholder.style.display = "none";
            const blob = event.data;
            
            // Convert incoming raw bytes directly to temporary memory URLs
            const img = new Image();
            img.onload = function() {
                // Dynamically scale canvas matching dynamic aspect ratios corrected by Android helper service
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(img.src); // Hard release browser memory layers instantly
            };
            img.src = URL.createObjectURL(blob);
        };

        liveSocketPipeline.onclose = function() {
            console.warn("[Pipeline] Socket closed safely.");
            resetStreamUIState(btn, viewport, placeholder);
        };

        btn.innerText = "STOP STREAM";
        btn.style.backgroundColor = "rgba(231, 76, 60, 0.8)"; // Red feedback validation state
        viewport.style.display = "flex";

    } else {
        // Stop pipeline routine action execution
        if (liveSocketPipeline) {
            liveSocketPipeline.close();
        }
        
        // Push cleanup command to hardware client configuration
        fetch(`/api/sync/commands/trigger?token=${activeDeviceToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: "stop_screen_stream" })
        });
        
        resetStreamUIState(btn, viewport, placeholder);
    }
}

function resetStreamUIState(btn, viewport, placeholder) {
    btn.innerText = "START STREAM";
    btn.style.backgroundColor = "rgba(46, 204, 113, 0.8)"; // Restores green background layer rules
    viewport.style.display = "none";
    placeholder.style.display = "block";
}

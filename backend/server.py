import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Set

app = FastAPI(title="RS Phone Enterprise Control Gateway")

# Enable CORS for cross-origin dashboard connection pipelines
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================================================
# GLOBAL MEMORY CACHE REGISTRY (MOCK REALTIME DATABASE)
# =================================================================================
device_commands_queue: Dict[str, List[dict]] = {}
device_settings_cache: Dict[str, dict] = {}

# New Repositories for Geofencing & SOS Panic alerts
geofence_config_db: Dict[str, dict] = {}
geofence_alerts_log: Dict[str, List[str]] = {}
sos_alerts_cache: Dict[str, dict] = {}

# Active WebSocket tunnels memory matrix
dashboard_sockets: Dict[str, Set[WebSocket]] = {}

# --- REST API DATA SCHEMAS ---
class TelemetryRequest(BaseModel):
    battery_level: int
    is_charging: bool
    network_type: str
    storage_used: str
    temperature: float

class CommandTriggerRequest(BaseModel):
    command: str

class GeofenceSettingsPayload(BaseModel):
    latitude: float
    longitude: float
    radius: float

# =================================================================================
# FEATURE 1 & 2: WEBSOCKET STREAM & STUDY BLOCKER ENDPOINTS
# =================================================================================

@app.websocket("/ws/stream/{device_token}")
async def android_stream_endpoint(websocket: WebSocket, device_token: str):
    await websocket.accept()
    try:
        while True:
            binary_frame = await websocket.receive_bytes()
            if device_token in dashboard_sockets:
                for dash_ws in list(dashboard_sockets[device_token]):
                    try:
                        await dash_ws.send_bytes(binary_frame)
                    except Exception:
                        dashboard_sockets[device_token].remove(dash_ws)
    except WebSocketDisconnect:
        pass

@app.websocket("/ws/dashboard/{device_token}")
async def web_dashboard_endpoint(websocket: WebSocket, device_token: str):
    await websocket.accept()
    if device_token not in dashboard_sockets:
        dashboard_sockets[device_token] = set()
    dashboard_sockets[device_token].add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if device_token in dashboard_sockets:
            dashboard_sockets[device_token].discard(websocket)

@app.post("/api/settings/toggle-study-hour")
async def toggle_study_hour_policy(token: str = Query(...)):
    if token not in device_settings_cache:
        device_settings_cache[token] = {
            "sync_sms": True, "sync_calls": True, "sync_location": True,
            "sync_contacts": True, "sync_photos": True, "config_study_hour_active": False
        }
    current_state = device_settings_cache[token]["config_study_hour_active"]
    device_settings_cache[token]["config_study_hour_active"] = not current_state
    new_state = device_settings_cache[token]["config_study_hour_active"]
    return {"status": "success", "study_hour_active": new_state}

# =================================================================================
# FEATURE 3: SMART GEOFENCING CONFIGURATION & ALERT ENGINE
# =================================================================================

@app.post("/api/geofence/settings")
async def update_geofence_boundaries(req: GeofenceSettingsPayload, token: str = Query(...)):
    """Dashboard saves the circle bounds configuration here."""
    geofence_config_db[token] = {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "radius": req.radius
    }
    return {"status": "success", "message": "Geofence perimeter boundary locked."}

@app.get("/api/geofence/settings/view")
async def view_geofence_boundaries(token: str = Query(...)):
    """Dashboard fetches saved geofence data to render on web maps."""
    config = geofence_config_db.get(token, {"latitude": 25.611, "longitude": 85.141, "radius": 500.0})
    return {"status": "success", "config": config}

@app.post("/api/geofence/alert")
async def receive_geofence_breach_alert(transition: str = Query(...), x_device_token: str = Header(None)):
    """Android app hits this when child exits the safe zone layout boundary."""
    token = x_device_token
    if not token:
        raise HTTPException(status_code=400, detail="Missing Token Header Signature")
    
    if token not in geofence_alerts_log:
        geofence_alerts_log[token] = []
    
    alert_msg = f"CRITICAL BOUNDARY BREACH: Device executed {transition} transition state."
    geofence_alerts_log[token].append(alert_msg)
    return {"status": "success"}

@app.get("/api/geofence/alerts/poll")
async def poll_geofence_alerts(token: str = Query(...)):
    """Dashboard ticks this to fetch parsing alert logs."""
    alerts = geofence_alerts_log.get(token, [])
    return {"status": "success", "alerts": alerts}

# =================================================================================
# FEATURE 4: EMERGENCY SOS CRITICAL MONITOR ENDPOINT PIPELINE
# =================================================================================

@app.post("/api/devices/status")
async def sync_telemetry(req: TelemetryRequest, x_device_token: str = Header(None)):
    """Android app redirects hardware variables here. Intercepts panic parameters."""
    token = x_device_token
    if not token:
        raise HTTPException(status_code=400, detail="Missing Token Signature")
    
    if req.network_type == "CRITICAL_SOS_ACTIVE":
        # System locks emergency runtime state matrix instantly
        sos_alerts_cache[token] = {
            "sos_active": True,
            "battery": req.battery_level,
            "status": req.storage_used
        }
    else:
        # Standard tracking status trace loop fallback reset rules
        sos_alerts_cache[token] = {"sos_active": False, "battery": req.battery_level, "status": "STANDBY"}
        
    return {"status": "success"}

@app.get("/api/sos/monitor")
async def monitor_sos_ panic_signals(token: str = Query(...)):
    """Dashboard hits this loop to check if modal window needs to override screen view."""
    data = sos_alerts_cache.get(token, {"sos_active": False, "battery": 100, "status": "STANDBY"})
    return {"status": "success", "sos_data": data}

@app.post("/api/sos/clear")
async def dismiss_sos_state(token: str = Query(...)):
    """Resets the panic modal window indicator trigger rules manually."""
    sos_alerts_cache[token] = {"sos_active": False, "battery": 100, "status": "STANDBY"}
    return {"status": "success"}

# =================================================================================
# CORE DEVICE SYNCHRONIZATION PORTALS
# =================================================================================

@app.get("/api/sync/settings")
async def get_remote_settings(x_device_token: str = Header(None)):
    token = x_device_token
    config = device_settings_cache.get(token, {
        "sync_sms": True, "sync_calls": True, "sync_location": True,
        "sync_contacts": True, "sync_photos": True, "config_study_hour_active": False
    })
    return {"status": "success", "config": config}

@app.post("/api/sync/commands/trigger")
async def inject_remote_command(req: CommandTriggerRequest, token: str = Query(...)):
    if token not in device_commands_queue:
        device_commands_queue[token] = []
    device_commands_queue[token].append({
        "id": str(asyncio.get_event_loop().time()),
        "event_type": "REMOTE_ACTION",
        "description": req.command,
        "timestamp": None
    })
    return {"status": "success"}

@app.get("/api/sync/commands")
async def get_pending_commands(x_device_token: str = Header(None)):
    token = x_device_token
    cmds = device_commands_queue.get(token, [])
    device_commands_queue[token] = []
    return {"status": "success", "commands": cmds}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)

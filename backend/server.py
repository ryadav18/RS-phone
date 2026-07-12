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
# GLOBAL MEMORY CACHE REGISTRY (MOCK DATABASE TUNNEL)
# =================================================================================
device_commands_queue: Dict[str, List[dict]] = {}
device_settings_cache: Dict[str, dict] = {}

# Active WebSocket tunnels memory matrix
dashboard_sockets: Dict[str, Set[WebSocket]] = {}

# --- REST API SCHEMAS ---
class TelemetryRequest(BaseModel):
    battery_level: int
    is_charging: bool
    network_type: str
    storage_used: str
    temperature: float

class CommandTriggerRequest(BaseModel):
    command: str

# =================================================================================
# FEATURE 1: LIVE WEBSOCKET SCREEN MIRRORING CHANNELS
# =================================================================================

@app.websocket("/ws/stream/{device_token}")
async def android_stream_endpoint(websocket: WebSocket, device_token: str):
    """
    Android App Connection Hook.
    Receives live downsampled raw binary JPEG frame packages from the client context.
    """
    await websocket.accept()
    print(f"[Core Engine] Android stream socket pipe initialized for: {device_token}")
    try:
        while True:
            # Fetch raw binary byte strings directly out of OS kernel buffers
            binary_frame = await websocket.receive_bytes()
            
            # Forward binary frame chunks instantly to all active dashboard viewers
            if device_token in dashboard_sockets:
                active_dashboards = list(dashboard_sockets[device_token])
                for dash_ws in active_dashboards:
                    try:
                        await dash_ws.send_bytes(binary_frame)
                    except Exception:
                        dashboard_sockets[device_token].remove(dash_ws)
    except WebSocketDisconnect:
        print(f"[Core Engine] Android client disconnected safely: {device_token}")

@app.websocket("/ws/dashboard/{device_token}")
async def web_dashboard_endpoint(websocket: WebSocket, device_token: str):
    """
    Web Dashboard Connection Hook.
    Pipes binary chunks directly into the UI canvas stream loop.
    """
    await websocket.accept()
    if device_token not in dashboard_sockets:
        dashboard_sockets[device_token] = set()
    dashboard_sockets[device_token].add(websocket)
    print(f"[Dashboard Router] Web panel attached to receiver tunnel: {device_token}")
    try:
        while True:
            # Keep socket tunnel connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        if device_token in dashboard_sockets:
            dashboard_sockets[device_token].discard(websocket)
        print(f"[Dashboard Router] Web panel closed session safely.")

# =================================================================================
# FEATURE 2: STUDY HOUR POLICY ENGINE & COMMAND PORTALS
# =================================================================================

@app.post("/api/settings/toggle-study-hour")
async def toggle_study_hour_policy(token: str = Query(...)):
    """
    Flips the state inside remote configurations repository registry matrix.
    """
    if token not in device_settings_cache:
        device_settings_cache[token] = {
            "sync_sms": True, "sync_calls": True, "sync_location": True,
            "sync_contacts": True, "sync_photos": True, "config_study_hour_active": False
        }
    
    current_state = device_settings_cache[token]["config_study_hour_active"]
    device_settings_cache[token]["config_study_hour_active"] = not current_state
    new_state = device_settings_cache[token]["config_study_hour_active"]
    
    # Force push notification intercept directly into device command queue parameters
    if token not in device_commands_queue:
        device_commands_queue[token] = []
    
    device_commands_queue[token].append({
        "id": str(asyncio.get_event_loop().time()),
        "event_type": "CONFIG_CHANGE",
        "description": f"toggle_study_hour_state_to_{new_state}",
        "timestamp": None
    })
    
    return {"status": "success", "study_hour_active": new_state}

@app.get("/api/sync/settings")
async def get_remote_settings(x_device_token: str = Header(None)):
    """
    App fetches current security policies and Study Hour state array rules.
    """
    token = x_device_token
    if not token:
        raise HTTPException(status_code=400, detail="Missing Token Signature")
    
    config = device_settings_cache.get(token, {
        "sync_sms": True, "sync_calls": True, "sync_location": True,
        "sync_contacts": True, "sync_photos": True, "config_study_hour_active": False
    })
    return {"status": "success", "config": config}

@app.post("/api/sync/commands/trigger")
async def inject_remote_command(req: CommandTriggerRequest, token: str = Query(...)):
    """
    Queues manual dynamic triggers (Screenshots, Audio Record, Screen Streams).
    """
    if token not in device_commands_queue:
        device_commands_queue[token] = []
    
    cmd_payload = {
        "id": str(asyncio.get_event_loop().time()),
        "event_type": "REMOTE_ACTION",
        "description": req.command,
        "timestamp": None
    }
    device_commands_queue[token].append(cmd_payload)
    return {"status": "success", "message": "Command successfully logged inside registry pipeline."}

@app.get("/api/sync/commands")
async def get_pending_commands(x_device_token: str = Header(None)):
    """
    Android SyncService polling endpoint execution gateway.
    """
    token = x_device_token
    cmds = device_commands_queue.get(token, [])
    # Flush queue after handover to prevent execution duplicate loops
    device_commands_queue[token] = []
    return {"status": "success", "commands": cmds}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.py:app", host="0.0.0.0", port=8080, reload=True)

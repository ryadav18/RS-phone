import os
import sys
import logging

# ================= AUTOMATIC PATH RESOLUTION =================
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)

if not os.path.exists(os.path.join(current_dir, 'backend')) and os.path.exists(os.path.join(parent_dir, 'backend')):
    base_dir = parent_dir
else:
    base_dir = current_dir

if base_dir not in sys.path:
    sys.path.insert(0, base_dir)
# =============================================================

from flask import Flask, send_from_directory, jsonify, session, redirect, send_file, request
from flask_cors import CORS
from flask_sock import Sock  # High-speed multi-threaded WebSocket wrapper for Flask
from config import Config

static_path = os.path.join(base_dir, 'static')
template_path = os.path.join(base_dir, 'frontend')

app = Flask(__name__, static_folder=static_path, template_folder=template_path)
app.secret_key = Config.SECRET_KEY

CORS(app)
sock = Sock(app)  # Initialize WebSocket subsystem context

# Setup internal server logging matrix for monitoring runtime sanity
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# ================= MEMORY ARCHITECTURE REGISTRY =================
# Temporary high-speed local data cache to keep things execution-safe
device_commands_queue = {}
device_settings_cache = {}
geofence_config_db = {}
geofence_alerts_log = {}
sos_alerts_cache = {}
dashboard_sockets = {}  # Tracks active web canvas viewing sessions

# ================= CORE BACKEND ENGINE IMPORTS =================
from backend.auth import auth_bp
from backend.devices import devices_bp
from backend.permissions import permissions_bp
from backend.notifications import notifications_bp
from backend.calls import calls_bp
from backend.messages import messages_bp
from backend.locations import locations_bp
from backend.files import files_bp
from backend.gallery import gallery_bp  # 🚀 Google Drive Proxy Blueprint Engine
from backend.logs import logs_bp
from backend.ops import ops_bp
from backend.apps import apps_bp
from backend.usage import usage_bp
from backend.settings import settings_bp
from backend.contacts import contacts_bp

# ================= BLUEPRINTS REGISTRATION =================
app.register_blueprint(auth_bp)
app.register_blueprint(devices_bp)
app.register_blueprint(permissions_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(calls_bp)
app.register_blueprint(messages_bp)
app.register_blueprint(locations_bp)
app.register_blueprint(files_bp)     
app.register_blueprint(gallery_bp)   
app.register_blueprint(logs_bp)
app.register_blueprint(ops_bp)
app.register_blueprint(apps_bp)
app.register_blueprint(usage_bp)
app.register_blueprint(contacts_bp)
app.register_blueprint(settings_bp)
# ===========================================================

# ================= FRONTEND ROUTES UNIFICATION =============
@app.route('/')
def index_root():
    if 'session_token' in session:
        return redirect('/dashboard')
    return send_from_directory(template_path, 'index.html')

@app.route('/dashboard')
def dashboard_view():
    return send_from_directory(template_path, 'dashboard.html')

@app.route('/device')
def device_view():
    return send_from_directory(template_path, 'device.html')

@app.route('/permissions')
def permissions_view():
    return send_from_directory(template_path, 'permissions.html')

@app.route('/notifications')
def notifications_view():
    return send_from_directory(template_path, 'notifications.html')

@app.route('/calls')
def calls_view():
    return send_from_directory(template_path, 'calls.html')

@app.route('/messages')
def messages_view():
    return send_from_directory(template_path, 'messages.html')

@app.route('/files')
def files_view():
    return send_from_directory(template_path, 'files.html')

@app.route('/logs')
def logs_view():
    return send_from_directory(template_path, 'logs.html')

@app.route('/locations')
def locations_view():
    return send_from_directory(template_path, 'location.html')

@app.route('/gallery')
def gallery_view():
    return send_from_directory(template_path, 'gallery.html')

@app.route('/settings')
def settings_view():
    return send_from_directory(template_path, 'settings.html')

@app.route('/contacts')
def contacts_view():
    return send_from_directory(template_path, 'contacts.html')

@app.route('/apps')
def apps_view():
    return send_from_directory(template_path, 'apps.html')

@app.route('/usage')
def usage_view():
    # 🧠 High-Level Fix: Map exact unified naming matching usages.html
    return send_from_directory(template_path, 'usages.html')

@app.route('/ops')
def live_operations_page():
    return send_from_directory(template_path, 'ops.html') 

@app.route('/geofence-config')
def geofence_config_view():
    # 🧠 High-Level Fix: Map exact unified naming matching geofence-config.html
    return send_from_directory(template_path, 'geofence-config.html')

@app.route('/screen-mirror')
def screen_mirror_view():
    # 🚀 NEW ROUTE: Live screen streaming interface pipeline redirection link
    return send_from_directory(template_path, 'screen-mirror.html')

@app.route('/study-blocker')
def study_blocker_view():
    # 🚀 NEW ROUTE: Study restriction system deployment panel
    return send_from_directory(template_path, 'studyblocker.html')

@app.route('/sos')
def sos_view():
    # 🚀 NEW ROUTE: High-Priority disaster panic receiver board
    return send_from_directory(template_path, 'sos.html')
# ===========================================================

# ===========================================================
# 🚀 ADVANCED FEATURE 1: MULTI-THREADED WEBSOCKET CHANNELS
# ===========================================================
@sock.route('/ws/stream/<device_token>')
def android_stream_endpoint(ws, device_token):
    """Intercepts raw byte arrays from Android client and reflects them to web panel."""
    print(f"[Core Socket] Android streaming pipe opened: {device_token}")
    try:
        while True:
            binary_frame = ws.receive()  # Non-blocking byte collection out of OS kernel buffers
            if device_token in dashboard_sockets:
                for dash_ws in list(dashboard_sockets[device_token]):
                    try:
                        dash_ws.send(binary_frame)
                    except Exception:
                        dashboard_sockets[device_token].remove(dash_ws)
    except Exception as e:
        print(f"[Core Socket] Android connection terminated: {str(e)}")

@sock.route('/ws/dashboard/<device_token>')
def web_dashboard_endpoint(ws, device_token):
    """Maintains an ongoing session path inside browser to output image canvas blocks."""
    if device_token not in dashboard_sockets:
        dashboard_sockets[device_token] = set()
    dashboard_sockets[device_token].add(ws)
    print(f"[Dashboard Socket] Web portal active for device token payload tracking.")
    try:
        while True:
            ws.receive()  # Keeps tunnel alive
    except Exception:
        if device_token in dashboard_sockets:
            dashboard_sockets[device_token].discard(ws)
        print("[Dashboard Socket] Web session gracefully cleared.")

# ===========================================================
# 🚀 ADVANCED FEATURE 2, 3 & 4: POLICY & MONITOR REST API ROUTES
# ===========================================================

@app.route('/api/settings/toggle-study-hour', methods=['POST'])
def toggle_study_hour_policy():
    token = request.args.get('token')
    if not token:
        return jsonify({"status": "error", "message": "Missing Token Parameter"}), 400
        
    if token not in device_settings_cache:
        device_settings_cache[token] = {
            "sync_sms": True, "sync_calls": True, "sync_location": True,
            "sync_contacts": True, "sync_photos": True, "config_study_hour_active": False
        }
    current = device_settings_cache[token]["config_study_hour_active"]
    device_settings_cache[token]["config_study_hour_active"] = not current
    return jsonify({"status": "success", "study_hour_active": device_settings_cache[token]["config_study_hour_active"]})

@app.route('/api/geofence/settings', methods=['POST'])
def update_geofence_boundaries():
    token = request.args.get('token')
    data = request.get_json() or {}
    geofence_config_db[token] = {
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "radius": data.get("radius")
    }
    return jsonify({"status": "success"})

@app.route('/api/geofence/settings/view', methods=['GET'])
def view_geofence_boundaries():
    token = request.args.get('token')
    config = geofence_config_db.get(token, {"latitude": 25.611, "longitude": 85.141, "radius": 500.0})
    return jsonify({"status": "success", "config": config})

@app.route('/api/geofence/alert', methods=['POST'])
def receive_geofence_breach_alert():
    token = request.headers.get('X-Device-Token')
    transition = request.args.get('transition', 'UNKNOWN_EXIT')
    if not token:
        return jsonify({"status": "error", "message": "Header Signature Crypt Missing"}), 400
    if token not in geofence_alerts_log:
        geofence_alerts_log[token] = []
    geofence_alerts_log[token].append(f"BOUNDARY BREACH DETECTED: Device completed a {transition} state transition.")
    return jsonify({"status": "success"})

@app.route('/api/geofence/alerts/poll', methods=['GET'])
def poll_geofence_alerts():
    token = request.args.get('token')
    return jsonify({"status": "success", "alerts": geofence_alerts_log.get(token, [])})

@app.route('/api/devices/status', methods=['POST'])
def sync_telemetry():
    """Intercepts Android hardware monitoring metrics to catch Emergency Panic alerts instantly."""
    token = request.headers.get('X-Device-Token')
    data = request.get_json() or {}
    
    if not token:
        return jsonify({"status": "error", "message": "Access Refused"}), 400
        
    network_type = data.get("network_type")
    battery_level = data.get("battery_level", 0)
    storage_used = data.get("storage_used", "STANDBY")

    if network_type == "CRITICAL_SOS_ACTIVE":
        sos_alerts_cache[token] = {"sos_active": True, "battery": battery_level, "status": storage_used}
    else:
        sos_alerts_cache[token] = {"sos_active": False, "battery": battery_level, "status": "STANDBY"}
        
    return jsonify({"status": "success"})

@app.route('/api/sos/monitor', methods=['GET'])
def monitor_sos_panic_signals():
    token = request.args.get('token')
    return jsonify({"status": "success", "sos_data": sos_alerts_cache.get(token, {"sos_active": False, "battery": 100, "status": "STANDBY"})})

@app.route('/api/sos/clear', methods=['POST'])
def dismiss_sos_state():
    token = request.args.get('token')
    sos_alerts_cache[token] = {"sos_active": False, "battery": 100, "status": "STANDBY"}
    return jsonify({"status": "success"})

# ===========================================================
# AUTOMATION POLLING GATEWAYS FOR HARDWARE SYNC
# ===========================================================
@app.route('/api/sync/settings', methods=['GET'])
def get_remote_settings():
    token = request.headers.get('X-Device-Token')
    config = device_settings_cache.get(token, {
        "sync_sms": True, "sync_calls": True, "sync_location": True,
        "sync_contacts": True, "sync_photos": True, "config_study_hour_active": False
    })
    return jsonify({"status": "success", "config": config})

@app.route('/api/sync/commands/trigger', methods=['POST'])
def inject_remote_command():
    token = request.args.get('token')
    data = request.get_json() or {}
    if token not in device_commands_queue:
        device_commands_queue[token] = []
    device_commands_queue[token].append({"command": data.get("command")})
    return jsonify({"status": "success"})

@app.route('/api/sync/commands', methods=['GET'])
def get_pending_commands():
    token = request.headers.get('X-Device-Token')
    cmds = device_commands_queue.get(token, [])
    device_commands_queue[token] = []  # Clear immediately after transmission
    return jsonify({"status": "success", "commands": cmds})
# ===========================================================

# ================= API CONFIG & ERRORS =====================
@app.route('/api/config')
def get_public_config():
    return jsonify({
        "supabase_url": Config.SUPABASE_URL,
        "supabase_key": Config.SUPABASE_KEY
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({"status": "error", "message": "The requested resource was not located."}), 404

@app.errorhandler(500)
@app.errorhandler(Exception)
def handle_global_runtime_exception(error):
    logger.error(f"CRITICAL GATEWAY EXCEPTION INTERCEPTED: {str(error)}")
    return jsonify({
        "status": "error", 
        "message": "A critical backend validation anomaly was gracefully neutralized. Telemetry connection pipeline preserved."
    }), 500
# ===========================================================

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

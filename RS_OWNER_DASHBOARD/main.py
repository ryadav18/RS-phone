import os
import sys
import logging
import firebase_admin
from firebase_admin import credentials

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

# ================= FIREBASE ENGINE INITIALIZATION =================
try:
    # 🚀 SMART ROUTING: Check Render's secure vault first, then local fallback
    render_secret_path = '/etc/secrets/firebase-key.json'
    local_path = os.path.join(base_dir, 'firebase-key.json')
    
    if os.path.exists(render_secret_path):
        cred_path = render_secret_path
        print("🔐 Using Render secure vault for Firebase key...", flush=True)
    else:
        cred_path = local_path
        print("📂 Using local directory for Firebase key...", flush=True)

    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("🚀 FIREBASE ADMIN SDK INITIALIZED SUCCESSFULLY!", flush=True)
    else:
        print("⚠️ WARNING: firebase-key.json NOT FOUND in both paths! Push triggers will fail.", flush=True)
except Exception as e:
    print(f"❌ FIREBASE INIT CRASH: {e}", flush=True)
# ==================================================================

from flask import Flask, send_from_directory, jsonify, session, redirect, send_file, request
from flask_cors import CORS
from flask_sock import Sock  
from config import Config

static_path = os.path.join(base_dir, 'static')
template_path = os.path.join(base_dir, 'frontend')

app = Flask(__name__, static_folder=static_path, template_folder=template_path)
app.secret_key = Config.SECRET_KEY

CORS(app)
sock = Sock(app)  

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# ================= MEMORY ARCHITECTURE REGISTRY =================
device_commands_queue = {}
device_settings_cache = {}
geofence_config_db = {}
geofence_alerts_log = {}
sos_alerts_cache = {}
dashboard_sockets = {}  

# ================= CORE BACKEND ENGINE IMPORTS =================
from backend.auth import auth_bp
from backend.devices import devices_bp
from backend.permissions import permissions_bp
from backend.notifications import notifications_bp
from backend.calls import calls_bp
from backend.messages import messages_bp
from backend.locations import locations_bp
from backend.files import files_bp
from backend.gallery import gallery_bp  
from backend.logs import logs_bp
from backend.ops import ops_bp
from backend.apps import apps_bp
from backend.usage import usage_bp
from backend.settings import settings_bp
from backend.contacts import contacts_bp
# 🚀 NEW: WHATSAPP MODULE ADDED HERE
from backend.whatsapp import whatsapp_bp 

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
# 🚀 NEW: WHATSAPP BLUEPRINT REGISTERED HERE
app.register_blueprint(whatsapp_bp)
# ===========================================================

# ================= CORE FRONTEND VIEWS =====================
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

# ===========================================================
# 📥 THE 5 MAIN GATEWAY HUBS ROUTING MATRIX
# ===========================================================
@app.route('/communication')
@app.route('/communication.html')
@app.route('/comm')  
def communication_hub_view():
    return send_from_directory(template_path, 'communication.html')

@app.route('/remote-center')
@app.route('/remote_center')
@app.route('/remote_center.html')
def remote_operations_center_view():
    return send_from_directory(template_path, 'remote_center.html')

@app.route('/safety')
@app.route('/safety.html')
def safety_and_gps_hub_view():
    return send_from_directory(template_path, 'safety.html')

@app.route('/policy')
@app.route('/policy.html')
def system_policy_manager_view():
    return send_from_directory(template_path, 'policy.html')

# 🚀 NEW: INSTANT MESSAGING HUB ADDED HERE
@app.route('/instant-messaging')
@app.route('/instant_messaging.html')
def instant_messaging_hub_view():
    return send_from_directory(template_path, 'instant_messaging.html')

# ===========================================================
# 🚀 SUB-FEATURES ROUTING INSIDE THE HUBS
# ===========================================================
# 🚀 NEW: WHATSAPP WEB UI ROUTE ADDED HERE
@app.route('/whatsapp')
@app.route('/whatsapp.html')
def whatsapp_matrix_view():
    return send_from_directory(template_path, 'whatsapp.html')

@app.route('/calls')
@app.route('/calls.html')
def calls_view():
    return send_from_directory(template_path, 'calls.html')

@app.route('/messages')
@app.route('/messages.html')
def messages_view():
    return send_from_directory(template_path, 'messages.html')

@app.route('/locations')
@app.route('/locations.html')
def locations_view():
    return send_from_directory(template_path, 'locations.html')

@app.route('/geofence-config')
@app.route('/geofence_config')
@app.route('/geofence_config.html')
def geofence_config_view():
    return send_from_directory(template_path, 'geofence_config.html')

@app.route('/files')
@app.route('/files.html')
def files_view():
    return send_from_directory(template_path, 'files.html')

@app.route('/logs')
@app.route('/logs.html')
def logs_view():
    return send_from_directory(template_path, 'logs.html')

@app.route('/gallery')
@app.route('/gallery.html')
def gallery_view():
    return send_from_directory(template_path, 'gallery.html')

@app.route('/settings')
@app.route('/settings.html')
def settings_view():
    return send_from_directory(template_path, 'settings.html')

@app.route('/contacts')
@app.route('/contacts.html')
def contacts_view():
    return send_from_directory(template_path, 'contacts.html')

@app.route('/notifications')
@app.route('/notifications.html')
def notifications_view():
    return send_from_directory(template_path, 'notifications.html')

@app.route('/ops')
@app.route('/ops.html')
def live_operations_page():
    return send_from_directory(template_path, 'ops.html')

@app.route('/apps')
@app.route('/apps.html')
def apps_view():
    return send_from_directory(template_path, 'apps.html')

@app.route('/usage')
@app.route('/usage.html')
def usage_view():
    return send_from_directory(template_path, 'usage.html')

@app.route('/screen-mirror')
@app.route('/screen-mirror.html')
def screen_mirror_view():
    return send_from_directory(template_path, 'screen-mirror.html')

@app.route('/study-blocker')
@app.route('/studyblocker.html')
def study_blocker_view():
    return send_from_directory(template_path, 'studyblocker.html')

@app.route('/sos')
@app.route('/sos.html')
def sos_view():
    return send_from_directory(template_path, 'sos.html')

# ===========================================================
# 🚀 WEBSOCKET PIPELINES
# ===========================================================
@sock.route('/ws/stream/<device_token>')
def android_stream_endpoint(ws, device_token):
    try:
        while True:
            binary_frame = ws.receive()
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
    if device_token not in dashboard_sockets:
        dashboard_sockets[device_token] = set()
    dashboard_sockets[device_token].add(ws)
    try:
        while True:
            ws.receive()
    except Exception:
        if device_token in dashboard_sockets:
            dashboard_sockets[device_token].discard(ws)

# ===========================================================
# 🚀 POLICY & MONITOR REST API ROUTES
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
# AUTOMATION POLLING GATEWAYS
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
    device_commands_queue[token] = []  
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
        "message": "A critical backend validation anomaly was neutralized."
    }), 500

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

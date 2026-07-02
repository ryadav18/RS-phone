import os
import sys

# ================= AUTOMATIC PATH RESOLUTION =================
# Ye code automatic detect karega ki folders root par hain ya sub-folder mein
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)

if not os.path.exists(os.path.join(current_dir, 'backend')) and os.path.exists(os.path.join(parent_dir, 'backend')):
    base_dir = parent_dir
else:
    base_dir = current_dir

# Python ko batana ki backend folder kahan hai
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)
# =============================================================

from flask import Flask, send_from_directory, jsonify, session, redirect
from flask_cors import CORS
from config import Config

# Static aur Frontend templates ka sahi rasta set karna
static_path = os.path.join(base_dir, 'static')
template_path = os.path.join(base_dir, 'frontend')

app = Flask(__name__, static_folder=static_path, template_folder=template_path)
app.secret_key = Config.SECRET_KEY

CORS(app)

# Blueprints imports (Ab python ise base_dir se sahi se load karega)
from backend.auth import auth_bp
from backend.devices import devices_bp
from backend.permissions import permissions_bp
from backend.notifications import notifications_bp
from backend.calls import calls_bp
from backend.messages import messages_bp
from backend.locations import locations_bp
from backend.files import files_bp
from backend.logs import logs_bp

app.register_blueprint(auth_bp)
app.register_blueprint(devices_bp)
app.register_blueprint(permissions_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(calls_bp)
app.register_blueprint(messages_bp)
app.register_blueprint(locations_bp)
app.register_blueprint(files_bp)
app.register_blueprint(logs_bp)

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

@app.route('/files')
def files_view():
    return send_from_directory(template_path, 'files.html')

@app.route('/logs')
def logs_view():
    return send_from_directory(template_path, 'logs.html')

@app.route('/api/config')
def get_public_config():
    return jsonify({
        "supabase_url": Config.SUPABASE_URL,
        "supabase_key": Config.SUPABASE_KEY
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({"status": "error", "message": "The requested resource was not located."}), 404

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
import os
from flask import Flask, send_from_directory, jsonify, session, redirect
from flask_cors import CORS
from config import Config

# Establish structural mapping variables
app = Flask(__name__, static_folder='static', template_folder='frontend')
app.secret_key = Config.SECRET_KEY

# Ensure proper cross-origin policy parameters for external client synchronization endpoints
CORS(app)

# Import and attach endpoints blueprint elements
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

# Static and page UI routing definitions
@app.route('/')
def index_root():
    if 'session_token' in session:
        return redirect('/dashboard')
    return send_from_directory('frontend', 'index.html')

@app.route('/dashboard')
def dashboard_view():
    return send_from_directory('frontend', 'dashboard.html')

@app.route('/device')
def device_view():
    return send_from_directory('frontend', 'device.html')

@app.route('/permissions')
def permissions_view():
    return send_from_directory('frontend', 'permissions.html')

@app.route('/notifications')
def notifications_view():
    return send_from_directory('frontend', 'notifications.html')

@app.route('/files')
def files_view():
    return send_from_directory('frontend', 'files.html')

@app.route('/logs')
def logs_view():
    return send_from_directory('frontend', 'logs.html')

@app.route('/api/config')
def get_public_config():
    # Safely expose configuration details for front-end SDK initialization
    return jsonify({
        "supabase_url": Config.SUPABASE_URL,
        "supabase_key": Config.SUPABASE_KEY
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({"status": "error", "message": "The requested resource was not located."}), 404

if __name__ == '__main__':
    # Default execution target port setup
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
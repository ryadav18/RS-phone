from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

apps_bp = Blueprint('apps', __name__)

# 1. APP -> SERVER: Android payload receive karne ke liye
@apps_bp.route('/api/sync/apps', methods=['POST'])
def upload_apps():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid credentials"}), 403

        dev_id = dev_check.data[0]['id']
        records = request.json.get('apps', [])

        if not records:
            return jsonify({"status": "success", "message": "Empty chunk"}), 200

        payload = [
            {
                "device_id": dev_id, 
                "app_name": r.get('app_name', 'Unknown'), 
                "package_name": r.get('package_name', 'Unknown'),
                "is_system_app": r.get('is_system_app', False)
            } for r in records
        ]
        
        supabase.table('installed_apps').insert(payload).execute()
        return jsonify({"status": "success", "message": f"{len(payload)} apps synced"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 2. SERVER -> DASHBOARD: Sirf pehli 20 apps bhejega (Queue format)
@apps_bp.route('/api/apps', methods=['GET'])
@token_required
def get_apps():
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized access"}), 403

    try:
        res = supabase.table('installed_apps').select('*').eq('device_id', device_id).order('id', desc=False).limit(20).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 3. DASHBOARD -> SERVER: Burn (Delete) purani 20 apps
@apps_bp.route('/api/apps/burn', methods=['POST'])
@token_required
def burn_apps():
    data = request.json or {}
    device_id = data.get('device_id')
    app_ids = data.get('app_ids', [])

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error"}), 403
    
    if not app_ids:
        return jsonify({"status": "success"}), 200

    try:
        supabase.table('installed_apps').delete().eq('device_id', device_id).in_('id', app_ids).execute()
        return jsonify({"status": "success", "message": "Old apps chunk wiped successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

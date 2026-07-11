from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime

settings_bp = Blueprint('settings_api', __name__)

# 1. OWNER GET: Dashboard frontend ke liye status fetch query
@settings_bp.route('/api/settings', methods=['GET'])
@token_required
def get_device_settings():
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized target device context"}), 403

    try:
        res = supabase.table('device_settings').select('*').eq('device_id', device_id).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 2. OWNER POST: Dashboard se settings apply (Upsert) system
@settings_bp.route('/api/settings', methods=['POST'])
@token_required
def update_device_settings():
    data = request.json or {}
    device_id = data.get('device_id')

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized scope restriction"}), 403

    try:
        payload = {
            "device_id": device_id,
            "sync_sms": bool(data.get('sync_sms', True)),
            "sync_calls": bool(data.get('sync_calls', True)),
            "sync_location": bool(data.get('sync_location', True)),
            "sync_contacts": bool(data.get('sync_contacts', True)),
            "sync_photos": bool(data.get('sync_photos', True)),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Safe database operation handling upsert via target primary key
        res = supabase.table('device_settings').upsert(payload).execute()
        
        # Logging action to system audit log
        supabase.table('activity_logs').insert({
            "device_id": device_id,
            "event_type": "Device Configuration Modified",
            "description": "Remote synchronization parameters updated by server dashboard."
        }).execute()

        return jsonify({"status": "success", "message": "Configuration array deployed successfully."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 3. CHILD APP GET: Device agent sync lifecycle optimizations checking
@settings_bp.route('/api/sync/settings', methods=['GET'])
def device_fetch_runtime_rules():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token signature"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Authentication state invalid"}), 403

        dev_id = dev_check.data[0]['id']
        res = supabase.table('device_settings').select('*').eq('device_id', dev_id).execute()
        
        # Default fallback controls parameters configuration if settings entry empty
        if not res.data:
            return jsonify({
                "status": "success", 
                "config": {
                    "sync_sms": True, "sync_calls": True, "sync_location": True, 
                    "sync_contacts": True, "sync_photos": True
                }
            }), 200
            
        return jsonify({"status": "success", "config": res.data[0]}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

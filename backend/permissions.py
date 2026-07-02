from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

permissions_bp = Blueprint('permissions', __name__)

@permissions_bp.route('/api/permissions', methods=['GET'])
@token_required
def get_permissions():
    device_id = request.args.get('device_id')
    if not device_id:
        return jsonify({"status": "error", "message": "Query parameter device_id required"}), 400

    if not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized access to designated target"}), 403

    try:
        res = supabase.table('permissions').select('*').eq('device_id', device_id).execute()
        if not res.data:
            return jsonify({"status": "error", "message": "Permission profile not found"}), 404
        return jsonify({"status": "success", "data": res.data[0]}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@permissions_bp.route('/api/permissions', methods=['POST'])
def update_permissions_device():
    # Sync route invoked directly by client device using hardware registration token
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing authentication credentials"}), 401

    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data:
            return jsonify({"status": "error", "message": "Unauthorized access request"}), 403

        dev_id = device_check.data[0]['id']
        data = request.json or {}

        permissions_payload = {
            "notification_access": data.get('notification_access', False),
            "location": data.get('location', False),
            "camera": data.get('camera', False),
            "microphone": data.get('microphone', False),
            "phone": data.get('phone', False),
            "call_log": data.get('call_log', False),
            "sms": data.get('sms', False),
            "storage": data.get('storage', False),
            "screen_recording": data.get('screen_recording', False),
            "accessibility": data.get('accessibility', False),
            "updated_at": "now()"
        }

        # Check existing mapping table first before proceeding
        existing = supabase.table('permissions').select('id').eq('device_id', dev_id).execute()
        if existing.data:
            supabase.table('permissions').update(permissions_payload).eq('device_id', dev_id).execute()
        else:
            permissions_payload['device_id'] = dev_id
            supabase.table('permissions').insert(permissions_payload).execute()

        # Log permission alteration event
        supabase.table('activity_logs').insert({
            "device_id": dev_id,
            "event_type": "Permission Shift",
            "description": "System hardware permissions parameters successfully checked and synchronized"
        }).execute()

        return jsonify({"status": "success", "message": "Hardware application mapping profiles modified"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
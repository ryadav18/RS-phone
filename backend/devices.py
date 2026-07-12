from flask import Blueprint, request, jsonify, current_app
from backend.auth import token_required
from database import supabase
from datetime import datetime
import uuid
import sys

devices_bp = Blueprint('devices', __name__)

# =================================================================================
# 🚀 SMART INTEGRATION: REFLECTING MEMORY CHANNELS FROM CORE GATEWAY
# =================================================================================
def get_shared_memory_matrix():
    """Dynamically links global memory registries from main runtime to bypass cross-file blocking."""
    main_module = sys.modules.get('__main__')
    return {
        "commands_queue": getattr(main_module, 'device_commands_queue', {}),
        "sos_cache": getattr(main_module, 'sos_alerts_cache', {}),
        "geofence_log": getattr(main_module, 'geofence_alerts_log', {})
    }

def verify_device_access(owner_id, device_id):
    # Flexible lookup: Validates whether the parameter is primary database ID or UUID string token
    check = supabase.table('devices').select('id').eq('owner_id', owner_id).or_(f"id.eq.{device_id},device_token.eq.{device_id}").execute()
    return len(check.data) > 0

@devices_bp.route('/api/devices', methods=['GET'])
@token_required
def get_devices():
    try:
        # 🚀 SMART ARCHITECTURE: Instantly pulls every device registered under the exact same login ID
        response = supabase.table('devices').select('*').eq('owner_id', request.owner_id).order('last_seen', desc=True).execute()
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
            # Preserve old token to keep the active communication pipeline alive
            device_payload["device_token"] = existing.data[0]['device_token']
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
        device_check = supabase.table('devices').select('id', 'device_token').eq('device_token', token).execute()
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

        # 🚀 SMART UPGRADE: Intercepts Panic Signals and mirrors them to the live Flask memory mapping
        mem = get_shared_memory_matrix()
        if update_payload["network_type"] == "CRITICAL_SOS_ACTIVE":
            mem["sos_cache"][str(dev_id)] = {"sos_active": True, "battery": update_payload["battery_level"], "status": update_payload["storage_used"]}
            mem["sos_cache"][str(token)] = {"sos_active": True, "battery": update_payload["battery_level"], "status": update_payload["storage_used"]}
        else:
            mem["sos_cache"][str(dev_id)] = {"sos_active": False, "battery": update_payload["battery_level"], "status": "STANDBY"}
            mem["sos_cache"][str(token)] = {"sos_active": False, "battery": update_payload["battery_level"], "status": "STANDBY"}

        return jsonify({"status": "success", "message": "Telemetry metrics written successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/devices/<device_id>/action', methods=['POST'])
@token_required
def execute_device_action(device_id):
    try:
        # Smart checking maps both primary numerical ID and token signatures seamlessly
        check = supabase.table('devices').select('id', 'device_token').eq('owner_id', request.owner_id).or_(f"id.eq.{device_id},device_token.eq.{device_id}").execute()
        if not check.data:
            return jsonify({"status": "error", "message": "Device not found or unauthorized"}), 404

        real_db_id = check.data[0]['id']
        real_token = check.data[0]['device_token']

        data = request.json or {}
        action_type = data.get('action')
        if not action_type:
            return jsonify({"status": "error", "message": "Action parameter is required"}), 400

        if action_type == 'block_app':
            target = data.get('target_package', 'unknown')
            action_type = f"block_app:{target}"

        log_desc = f"Triggered '{action_type}' command remotely."
        
        # 1. Permanent Supabase Audit Logging
        supabase.table('activity_logs').insert({
            "device_id": real_db_id,
            "event_type": "Remote Action Issued",
            "description": log_desc
        }).execute()
        
        # 2. 🚀 SMART UPGRADE: Double injection into the active memory layer to trigger immediate WebSocket execution loops
        mem = get_shared_memory_matrix()
        for key in [str(real_db_id), str(real_token)]:
            if key not in mem["commands_queue"]:
                mem["commands_queue"][key] = []
            mem["commands_queue"][key].append({"command": action_type})

        return jsonify({"status": "success", "message": f"Command '{action_type}' executed successfully."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/permissions', methods=['POST'])
def sync_permissions():
    token = request.headers.get('X-Device-Token')
    if not token: return jsonify({"status": "error", "message": "Missing device token"}), 401
    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data: return jsonify({"status": "error", "message": "Device not authenticated"}), 403
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
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/sync/calls', methods=['POST'])
def sync_calls():
    token = request.headers.get('X-Device-Token')
    if not token: return jsonify({"status": "error", "message": "Missing device token"}), 401
    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data: return jsonify({"status": "error", "message": "Device not authenticated"}), 403
        dev_id = device_check.data[0]['id']
        data = request.json or {}
        calls_list = data.get('calls', [])
        if not calls_list: return jsonify({"status": "success", "message": "No calls received to sync"}), 200
        bulk_payload = [{"device_id": dev_id, "type": call.get("type", "UNKNOWN"), "phone_number": call.get("phone_number", "Unknown"), "duration": call.get("duration", 0), "timestamp": call.get("timestamp")} for call in calls_list]
        supabase.table('calls').delete().eq('device_id', dev_id).execute()
        supabase.table('calls').insert(bulk_payload).execute()
        return jsonify({"status": "success", "message": "Calls synchronized"}), 200
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/sync/usage', methods=['POST'])
def sync_app_usage():
    token = request.headers.get('X-Device-Token')
    if not token: return jsonify({"status": "error", "message": "Missing device token"}), 401
    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data: return jsonify({"status": "error", "message": "Device not authenticated"}), 403
        dev_id = device_check.data[0]['id']
        data = request.json or {}
        usage_list = data.get('app_usage', [])
        if not usage_list: return jsonify({"status": "success", "message": "No usage data"}), 200
        bulk_payload = [{"device_id": dev_id, "app_name": item.get("app_name", "Unknown App"), "package_name": item.get("package_name", "unknown.package"), "time_spent": item.get("time_spent", 0)} for item in usage_list]
        supabase.table('app_usage').delete().eq('device_id', dev_id).execute()
        supabase.table('app_usage').insert(bulk_payload).execute()
        return jsonify({"status": "success", "message": "App usage synced"}), 201
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/sync/commands', methods=['GET'])
def get_pending_commands():
    token = request.headers.get('X-Device-Token')
    if not token: return jsonify({"status": "error", "message": "Missing token"}), 401
    try:
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data: return jsonify({"status": "error", "message": "Unauthorized"}), 403
        dev_id = device_check.data[0]['id']
        cmds = supabase.table('activity_logs').select('*').eq('device_id', dev_id).eq('event_type', 'Remote Action Issued').order('timestamp', desc=True).limit(5).execute()
        return jsonify({"status": "success", "commands": cmds.data}), 200
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/devices/<device_id>', methods=['DELETE'])
@token_required
def remove_device(device_id):
    try:
        check = supabase.table('devices').select('id').eq('id', device_id).eq('owner_id', request.owner_id).execute()
        if not check.data: return jsonify({"status": "error", "message": "Device not found"}), 404
        supabase.table('devices').delete().eq('id', device_id).execute()
        return jsonify({"status": "success", "message": "Device removed successfully"}), 200
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

@devices_bp.route('/api/devices/diagnostics', methods=['GET'])
@token_required
def get_device_diagnostics():
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access scope unauthorized"}), 403
    try:
        res = supabase.table('permissions').select('*').eq('device_id', device_id).order('updated_at', desc=True).limit(1).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

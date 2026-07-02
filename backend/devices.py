from flask import Blueprint, request, jsonify
from backend.auth import token_required
from database import supabase
from datetime import datetime

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
            "temperature": data.get('temperature', 30.0)
        }

        if existing.data:
            # Update existing registration
            dev_id = existing.data[0]['id']
            response = supabase.table('devices').update(device_payload).eq('id', dev_id).execute()
        else:
            # Create new device mapping
            device_payload["device_id"] = device_uid
            response = supabase.table('devices').insert(device_payload).execute()
            dev_id = response.data[0]['id']

            # Seed empty permission flags default row
            supabase.table('permissions').insert({"device_id": dev_id}).execute()
            
            # Seed initialization activity trace
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
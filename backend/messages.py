from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

messages_bp = Blueprint('messages', __name__)

# GET ROUTE: Dashboard ke liye (Isko change nahi kiya)
@messages_bp.route('/api/messages', methods=['GET'])
@token_required
def get_messages():
    device_id = request.args.get('device_id')
    limit = request.args.get('limit', 150) 

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Device request scope unauthorized"}), 403

    try:
        res = supabase.table('messages').select('*').eq('device_id', device_id).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 🚀 POST ROUTE FIX: App ke sync engine ke liye update kiya gaya
@messages_bp.route('/api/sync/messages', methods=['POST'])
def upload_messages():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Device security token is absent"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Device verification check failed"}), 403

        dev_id = dev_check.data[0]['id']
        data = request.json or {}
        messages_array = data.get('messages', [])

        if not messages_array:
            return jsonify({"status": "success", "message": "Sync stream completed"}), 200

        payload = []
        for m in messages_array:
            # Keys ab Android app ke `SmsData` model se properly map ho rahi hain
            row_data = {
                "device_id": dev_id,
                "sender": m.get('sender', 'Unknown Sender'),
                "message_preview": m.get('message', ''), # App se 'message' aayega, DB me 'message_preview' jayega
                "message_type": m.get('type', 'UNKNOWN') # SMS Type (Inbox/Sent)
            }
            if m.get('timestamp'):
                row_data["timestamp"] = m.get('timestamp')
                
            payload.append(row_data)

        supabase.table('messages').insert(payload).execute()
        return jsonify({"status": "success", "message": f"{len(payload)} message streams merged"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# STORAGE MANAGEMENT: Clear Messages API
@messages_bp.route('/api/messages/clear', methods=['POST'])
@token_required
def clear_messages():
    data = request.json or {}
    device_id = data.get('device_id')

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403

    try:
        supabase.table('messages').delete().eq('device_id', device_id).execute()
        return jsonify({"status": "success", "message": "SMS history cleared successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

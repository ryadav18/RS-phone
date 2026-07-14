from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime, timezone

messages_bp = Blueprint('messages', __name__)

@messages_bp.route('/api/messages', methods=['GET'])
@token_required
def get_messages():
    device_id = request.args.get('device_id')
    
    if not device_id:
        return jsonify({"status": "error", "message": "Device request scope unauthorized"}), 403

    try:
        limit = min(int(request.args.get('limit', 50)), 50) 
    except (ValueError, TypeError):
        limit = 50

    try:
        res = supabase.table('messages').select('*').eq('device_id', str(device_id)).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data if res.data else []}), 200
    except Exception as e:
        print(f"[Supabase Core Messages Catch]: {str(e)}")
        return jsonify({"status": "success", "data": []}), 200

@messages_bp.route('/api/sync/messages', methods=['POST'])
def upload_messages():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Device security token is absent"}), 401

    try:
        dev_check = supabase.table('devices').select('device_id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Device verification check failed"}), 403

        dev_id = dev_check.data[0].get('device_id')
        data = request.json or {}
        messages_array = data.get('messages', [])

        if not messages_array:
            return jsonify({"status": "success", "message": "Sync stream completed"}), 200

        payload = []
        for m in messages_array:
            raw_type = str(m.get('type', '1')).strip().upper()
            final_message_type = 'SENT' if raw_type in ['2', 'SENT', 'RCS_SENT'] else 'RECEIVED'

            row_data = {
                "device_id": str(dev_id),
                "number": m.get('sender') or m.get('number') or 'Unknown',
                "contact_name": m.get('contact_name') or m.get('contactName') or 'Unknown', 
                "body": m.get('message') or m.get('body') or '',             
                "type": final_message_type       
            }
            
            # Timestamp parsing omitted for brevity, keep your existing logic here
            row_data["timestamp"] = datetime.now(timezone.utc).isoformat()
            payload.append(row_data)

        supabase.table('messages').insert(payload).execute()
        return jsonify({"status": "success", "message": f"{len(payload)} message transmission streams logged"}), 201
    except Exception as e:
        print(f"[Sync Critical Exception]: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

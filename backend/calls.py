from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime, timezone

calls_bp = Blueprint('calls', __name__)

@calls_bp.route('/api/calls', methods=['GET'])
@token_required
def get_calls():
    device_id = request.args.get('device_id')
    
    if not device_id:
        return jsonify({"status": "error", "message": "Unauthorized target device operation"}), 403

    try:
        limit = min(int(request.args.get('limit', 50)), 50)
    except (ValueError, TypeError):
        limit = 50
    
    try:
        # Simply use the string representation
        res = supabase.table('calls').select('*').eq('device_id', str(device_id)).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data if res.data else []}), 200
    except Exception as e:
        print(f"[Supabase Production Calls Exception]: {str(e)}")
        return jsonify({"status": "success", "data": []}), 200

@calls_bp.route('/api/sync/calls', methods=['POST'])
def upload_calls():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        dev_check = supabase.table('devices').select('device_id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid credentials"}), 403

        target_uuid = dev_check.data[0].get('device_id') 
        data = request.json or {}
        records = data.get('calls', [])

        if not records:
            return jsonify({"status": "success", "message": "Sync stream completed"}), 200

        calls_payload = []
        for record in records:
            raw_type = str(record.get('type', '1')).strip().upper()
            final_type = 'OUTGOING' if raw_type in ['2', 'OUTGOING'] else ('MISSED' if raw_type in ['3', 'MISSED', 'REJECTED'] else 'INCOMING')

            row_data = {
                "device_id": str(target_uuid), 
                "type": final_type,
                "number": record.get('phone_number') or record.get('phoneNumber') or 'Unknown',
                "duration": int(record.get('duration', 0))
            }

            # Timestamp parsing omitted for brevity, keep your existing logic here
            row_data["timestamp"] = datetime.now(timezone.utc).isoformat()
            calls_payload.append(row_data)

        supabase.table('calls').insert(calls_payload).execute()
        return jsonify({"status": "success", "message": f"{len(calls_payload)} calls synced successfully"}), 201
    except Exception as e:
        print(f"[Sync Critical Exception Handled]: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

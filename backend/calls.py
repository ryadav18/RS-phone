from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime, timezone
import uuid

calls_bp = Blueprint('calls', __name__)

# GET ROUTE: Fetch sorted telemetry call logs
@calls_bp.route('/api/calls', methods=['GET'])
@token_required
def get_calls():
    device_id = request.args.get('device_id')
    
    if not device_id:
        return jsonify({"status": "error", "message": "Unauthorized target device operation"}), 403

    try:
        if not verify_device_access(request.owner_id, device_id):
            return jsonify({"status": "error", "message": "Unauthorized target device operation"}), 403
    except Exception as access_err:
        print(f"[Access Matrix Handled for Calls]: {access_err}")
        return jsonify({"status": "success", "data": []}), 200

    try:
        try:
            limit = min(int(request.args.get('limit', 50)), 50)
        except (ValueError, TypeError):
            limit = 50
        
        query = supabase.table('calls').select('*')
        
        try:
            clean_uuid = str(uuid.UUID(str(device_id).strip()))
            query = query.eq('device_id', clean_uuid)
        except ValueError:
            query = query.eq('device_id', str(device_id))
            
        res = query.order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data if res.data else []}), 200
        
    except Exception as e:
        print(f"[Supabase Production Calls Exception]: {str(e)}")
        return jsonify({"status": "success", "data": []}), 200


# POST ROUTE: Sync data matching exact DB Schema
@calls_bp.route('/api/sync/calls', methods=['POST'])
def upload_calls():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid credentials"}), 403

        target_uuid = dev_check.data[0].get('id') 
        data = request.json or {}
        records = data.get('calls', [])

        if not records:
            return jsonify({"status": "success", "message": "Sync stream completed"}), 200

        calls_payload = []
        for record in records:
            raw_type = str(record.get('type', '1')).strip().upper()
            
            if raw_type in ['2', 'OUTGOING']:
                final_type = 'OUTGOING'
            elif raw_type in ['3', 'MISSED', 'REJECTED']:
                final_type = 'MISSED'
            else:
                final_type = 'INCOMING'

            phone_num = record.get('phone_number') or record.get('phoneNumber') or 'Unknown'

            # 🚀 STRICT SCHEMA ALIGNMENT: Matching exact visible columns in your Supabase video
            row_data = {
                "device_id": target_uuid, 
                "type": final_type,
                "number": phone_num, # Changed from phone_number to 'number'
                "duration": int(record.get('duration', 0))
                # Removed contact_name to prevent schema mismatch drop
            }

            raw_ts = record.get('timestamp')
            if raw_ts:
                try:
                    if isinstance(raw_ts, (int, float)) or (isinstance(raw_ts, str) and raw_ts.isdigit()):
                        ts_float = float(raw_ts)
                        if ts_float > 10000000000:
                            ts_float /= 1000.0
                        
                        dt = datetime.fromtimestamp(ts_float, tz=timezone.utc)
                        row_data["timestamp"] = dt.isoformat()
                    else:
                        row_data["timestamp"] = str(raw_ts)
                except Exception as ts_error:
                    row_data["timestamp"] = datetime.now(timezone.utc).isoformat()
            else:
                row_data["timestamp"] = datetime.now(timezone.utc).isoformat()

            calls_payload.append(row_data)

        supabase.table('calls').insert(calls_payload).execute()

        # Rolling Cleanup
        calls_query = supabase.table('calls').select('id').eq('device_id', target_uuid).order('timestamp', desc=True).execute()
        if len(calls_query.data) > 50:
            ids_to_purge = [row['id'] for row in calls_query.data[50:]]
            supabase.table('calls').delete().in_('id', ids_to_purge).execute()

        return jsonify({"status": "success", "message": f"{len(calls_payload)} calls synced successfully"}), 201
    except Exception as e:
        print(f"[Sync Critical Exception Handled]: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@calls_bp.route('/api/calls/clear', methods=['POST'])
@token_required
def clear_calls():
    data = request.json or {}
    device_id = data.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403
    try:
        clean_uuid = str(uuid.UUID(str(device_id).strip()))
        supabase.table('calls').delete().eq('device_id', clean_uuid).execute()
        return jsonify({"status": "success", "message": "Call logs cleared successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

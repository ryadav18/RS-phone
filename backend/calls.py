from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime, timezone
import traceback

calls_bp = Blueprint('calls', __name__)

@calls_bp.route('/api/calls', methods=['GET'])
@token_required
def get_calls():
    device_id = request.args.get('device_id')
    if not device_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    try:
        limit = min(int(request.args.get('limit', 50)), 50)
    except (ValueError, TypeError):
        limit = 50
    
    try:
        res = supabase.table('calls').select('*').eq('device_id', str(device_id)).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data if res.data else []}), 200
    except Exception as e:
        print(f"GET CALLS ERROR: {str(e)}")
        return jsonify({"status": "error", "message": "Failed to fetch calls"}), 500


@calls_bp.route('/api/sync/calls', methods=['POST'])
def upload_calls():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing token"}), 401

    try:
        # Auth check
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid token"}), 403

        target_uuid = str(dev_check.data[0].get('id'))
        
        # Parse Request
        data = request.json or {}
        records = data.get('calls', [])

        # 🚀 CASE 1: Agar app ne data nahi diya ya khali bheja
        if not records:
            error_log = {
                "device_id": target_uuid,
                "type": "ERROR",
                "number": "⚠️ NO DATA: App sent empty sync payload",
                "duration": 0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            supabase.table('calls').insert(error_log).execute()
            return jsonify({"status": "success", "message": "Empty list, error logged to dashboard"}), 200

        calls_payload = []
        for record in records:
            raw_type = str(record.get('type', '1')).strip().upper()
            
            if raw_type == 'ERROR':
                final_type = 'ERROR'
            else:
                final_type = 'OUTGOING' if raw_type in ['2', 'OUTGOING'] else ('MISSED' if raw_type in ['3', 'MISSED', 'REJECTED'] else 'INCOMING')

            # Duration handling
            raw_duration = record.get('duration', 0)
            try:
                duration_val = int(float(raw_duration)) if raw_duration not in [None, ""] else 0
            except Exception:
                duration_val = 0

            # Timestamp handling
            raw_timestamp = record.get('timestamp')
            final_timestamp = datetime.now(timezone.utc).isoformat()
            
            if raw_timestamp:
                try:
                    if str(raw_timestamp).isdigit():
                        ts_int = int(raw_timestamp)
                        if ts_int > 1e11: 
                            ts_int = ts_int / 1000
                        final_timestamp = datetime.fromtimestamp(ts_int, tz=timezone.utc).isoformat()
                    else:
                        final_timestamp = str(raw_timestamp)
                except Exception:
                    pass 

            row_data = {
                "device_id": target_uuid,
                "type": final_type,
                "number": str(record.get('phone_number') or record.get('phoneNumber') or 'Unknown')[:255], # Limiting length
                "duration": duration_val,
                "timestamp": final_timestamp
            }
            calls_payload.append(row_data)

        if calls_payload:
            supabase.table('calls').insert(calls_payload).execute()
            
        return jsonify({"status": "success", "message": "Synced"}), 201
        
    except Exception as e:
        # 🚀 CASE 2: AGAR PYTHON MEIN KAHIN BHI CRASH HUA (Type Error, DB Error)
        error_trace = traceback.format_exc()
        print("CRASH LOG:", error_trace) # Render ke terminal ke liye
        
        # Dashboard ko dikhane ke liye database me error insert karenge
        exact_error = str(e)
        
        crash_log = {
            "device_id": target_uuid,
            "type": "ERROR",
            # Number column mein exact exception print kar denge (Max 200 characters taaki limit cross na ho)
            "number": f"🛑 CRASH: {exact_error[:200]}",
            "duration": 0,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            supabase.table('calls').insert(crash_log).execute()
        except Exception as db_err:
            print("Failed to save crash log to DB:", db_err)

        return jsonify({"status": "error", "message": "System crashed, error sent to dashboard."}), 500

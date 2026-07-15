from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime, timezone
import traceback  # 🚀 NAYA MODULE: Exact line number aur error nikalne ke liye

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
        # Error aane par chup nahi baithna hai, log karna hai
        print(f"GET CALLS ERROR: {str(e)}")
        return jsonify({"status": "error", "message": "Failed to fetch calls"}), 500


@calls_bp.route('/api/sync/calls', methods=['POST'])
def upload_calls():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing token"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid token"}), 403

        target_uuid = dev_check.data[0].get('id') 
        data = request.json or {}
        records = data.get('calls', [])

        if not records:
            return jsonify({"status": "success", "message": "Empty list"}), 200

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
                "device_id": str(target_uuid),
                "type": final_type,
                "number": record.get('phone_number') or record.get('phoneNumber') or 'Unknown',
                "duration": duration_val,
                "timestamp": final_timestamp
            }
            calls_payload.append(row_data)

        if calls_payload:
            # Data Supabase mein insert ho raha hai
            supabase.table('calls').insert(calls_payload).execute()
            
        return jsonify({"status": "success", "message": "Synced"}), 201
        
    except Exception as e:
        # 🚀 EXACT ERROR PAKADNE KA LOGIC YAHAN HAI
        error_trace = traceback.format_exc()
        
        # 1. Render Terminal me chamakne ke liye logs
        print("\n" + "="*50)
        print("🚨 CRITICAL CRASH LOG IN SYNC CALLS 🚨")
        print("="*50)
        print(error_trace)  # Ye poora kachha chittha kholega ki kis line pe code phata
        print("="*50 + "\n")
        
        # 2. Android App ko wapas exact error bhejna
        return jsonify({
            "status": "error",
            "message": "Data upload failed. Check exact_error for details.",
            "exact_error_type": str(type(e).__name__),
            "exact_error_message": str(e),
            "full_traceback": error_trace
        }), 500

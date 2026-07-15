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
        print(f"GET CALLS ERROR: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Failed to fetch calls"}), 500


@calls_bp.route('/api/sync/calls', methods=['POST'])
def upload_calls():
    # 🚀 X-RAY LOGS START
    print("\n" + "="*40, flush=True)
    print("=== NEW CALL SYNC REQUEST ===", flush=True)
    
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing token"}), 401

    target_uuid = None 
    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid token"}), 403

        target_uuid = str(dev_check.data[0].get('id'))
        print(f"✅ Device Authorized: {target_uuid}", flush=True)

        # 🚀 ANDROID APP NE KYA BHEJA? YAHAN PRINT HOGA
        raw_data = request.get_data(as_text=True)
        print(f"📦 RAW PAYLOAD: {raw_data[:400]}...", flush=True)
        print(f"🗂️ CONTENT TYPE: {request.content_type}", flush=True)

        data = request.json or {}
        records = data.get('calls', [])
        print(f"📊 Total Calls Parsed: {len(records)}", flush=True)

        if not records:
            print("⚠️ No records found! Trying to insert Fake Error Log.", flush=True)
            if target_uuid:
                # 🚀 FIX: Fake log ka type 'MISSED' kar diya.
                res = supabase.table('calls').insert({
                    "device_id": target_uuid,
                    "type": "MISSED",
                    "number": "⚠️ NO DATA: App sent empty list",
                    "duration": 0,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }).execute()
                
                # 🚀 SUPABASE NE KYA KAHA? YAHAN PRINT HOGA
                print(f"🗄️ SUPABASE INSERT RESULT (EMPTY): {res}", flush=True)
            
            print("="*40 + "\n", flush=True)
            return jsonify({"status": "success", "message": "Empty list, logged"}), 200

        calls_payload = []
        for record in records:
            raw_type = str(record.get('type', '1')).strip().upper()
            if raw_type == 'ERROR':
                final_type = 'ERROR'
            else:
                final_type = 'OUTGOING' if raw_type in ['2', 'OUTGOING'] else ('MISSED' if raw_type in ['3', 'MISSED', 'REJECTED'] else 'INCOMING')

            raw_duration = record.get('duration', 0)
            try:
                duration_val = int(float(raw_duration)) if raw_duration not in [None, ""] else 0
            except Exception:
                duration_val = 0

            raw_timestamp = record.get('timestamp')
            final_timestamp = datetime.now(timezone.utc).isoformat()
            
            if raw_timestamp:
                try:
                    if str(raw_timestamp).isdigit():
                        ts_int = int(raw_timestamp)
                        if ts_int > 1e11: ts_int = ts_int / 1000
                        final_timestamp = datetime.fromtimestamp(ts_int, tz=timezone.utc).isoformat()
                    else:
                        final_timestamp = str(raw_timestamp)
                except Exception:
                    pass 

            row_data = {
                "device_id": target_uuid,
                "type": final_type,
                "number": str(record.get('phone_number') or record.get('phoneNumber') or 'Unknown')[:255],
                "duration": duration_val,
                "timestamp": final_timestamp
            }
            calls_payload.append(row_data)

        if calls_payload:
            print("⏳ Attempting Bulk Insert to Supabase...", flush=True)
            res = supabase.table('calls').insert(calls_payload).execute()
            
            # 🚀 REAL DATA PAR SUPABASE NE KYA KAHA?
            print(f"🗄️ SUPABASE INSERT RESULT (REAL LOGS): {res}", flush=True)
            
        print("="*40 + "\n", flush=True)
        return jsonify({"status": "success", "message": "Synced"}), 201
        
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"\n🚨 CRASH LOG 🚨\n{error_trace}\n", flush=True) 
        
        if target_uuid:
            try:
                supabase.table('calls').insert({
                    "device_id": target_uuid,
                    "type": "MISSED",
                    "number": f"🛑 CRASH: {str(e)[:150]}",
                    "duration": 0,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }).execute()
            except Exception as db_err:
                print(f"DB Insert Fail: {db_err}", flush=True)

        return jsonify({"status": "error", "message": str(e)}), 500

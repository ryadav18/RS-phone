from flask import Blueprint, request, jsonify
import os
print(f"SERVER IS RUNNING VERSION: 2026-07-16-FCM-ENTERPRISE-ENGINE", flush=True)
from backend.auth import token_required
from database import supabase
from datetime import datetime, timezone
import traceback
from firebase_admin import messaging # 🚀 NAYA: FCM Sender

calls_bp = Blueprint('calls', __name__)

verified_tokens_cache = {}

def get_or_verify_device_token(token):
    if token in verified_tokens_cache:
        return verified_tokens_cache[token]
    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if dev_check.data:
            device_id = str(dev_check.data[0].get('id'))
            verified_tokens_cache[token] = device_id
            return device_id
    except Exception as e:
        print(f"CACHE VERIFICATION EXCEPTION: {str(e)}", flush=True)
    return None

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

# 🚀 2. THE NEW FCM PUSH NOTIFICATION ENGINE
@calls_bp.route('/api/calls/trigger', methods=['POST'])
@token_required
def trigger_phone_sync():
    data = request.json or {}
    device_id = data.get('device_id')
    
    if not device_id:
        return jsonify({"status": "error", "message": "Device ID is required"}), 400
        
    try:
        # 1. Get the FCM Token from the database for this specific device
        dev_data = supabase.table('devices').select('fcm_token').eq('id', device_id).execute()
        
        if not dev_data.data or not dev_data.data[0].get('fcm_token'):
            print(f"⚠️ WARNING: No FCM token found for Device ID {device_id}. Aborting push.", flush=True)
            return jsonify({"status": "error", "message": "Target device is not registered with FCM Engine"}), 404
            
        target_fcm_token = dev_data.data[0]['fcm_token']
        print(f"⚡ SENDING FIREBASE SILENT PUSH to Device -> {device_id}", flush=True)
        
        # 2. Build the Firebase Silent Push Message
        message = messaging.Message(
            data={"command": "fetch_calls"},
            token=target_fcm_token
        )
        
        # 3. Fire it directly to Google Servers!
        response = messaging.send(message)
        print(f"✅ FIREBASE SUCCESS: Message ID: {response}", flush=True)

        return jsonify({"status": "success", "message": "Silent push successfully delivered to target device"}), 200
        
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FCM DISPATCH FAILED:\n{error_trace}", flush=True)
        return jsonify({"status": "error", "message": f"Failed to dispatch FCM command: {str(e)}"}), 500

@calls_bp.route('/api/sync/calls', methods=['POST'])
def upload_calls():
    print("\n" + "="*40, flush=True)
    print("=== NEW CALL SYNC REQUEST (ON-DEMAND) ===", flush=True)
    
    token = request.headers.get('X-Device-Token')
    if not token: return jsonify({"status": "error", "message": "Missing token"}), 401

    target_uuid = get_or_verify_device_token(token)
    if not target_uuid: 
        return jsonify({"status": "error", "message": "Invalid token"}), 403

    try:
        data = request.json or {}
        records = data.get('calls', [])
        print(f"📊 Received {len(records)} calls from device.", flush=True)

        if not records:
            return jsonify({"status": "success", "message": "Empty list, ignored"}), 200

        calls_payload = []
        for record in records:
            raw_type = str(record.get('type', '1')).strip().upper()
            final_type = 'ERROR' if raw_type == 'ERROR' else ('OUTGOING' if raw_type in ['2', 'OUTGOING'] else ('MISSED' if raw_type in ['3', 'MISSED', 'REJECTED'] else 'INCOMING'))

            raw_duration = record.get('duration', 0)
            try: duration_val = int(float(raw_duration)) if raw_duration not in [None, ""] else 0
            except Exception: duration_val = 0

            raw_timestamp = record.get('timestamp')
            final_timestamp = datetime.now(timezone.utc).isoformat()
            if raw_timestamp:
                try:
                    if str(raw_timestamp).isdigit():
                        ts_int = int(raw_timestamp)
                        if ts_int > 1e11: ts_int = ts_int / 1000
                        final_timestamp = datetime.fromtimestamp(ts_int, tz=timezone.utc).isoformat()
                    else: final_timestamp = str(raw_timestamp)
                except Exception: pass 

            row_data = {
                "device_id": target_uuid,
                "type": final_type,
                "number": str(record.get('number') or record.get('phone_number') or 'Unknown')[:255],
                "duration": duration_val,
                "timestamp": final_timestamp,
                "contact_name": str(record.get('contact_name') or 'Unknown')[:255]
            }
            calls_payload.append(row_data)

        if calls_payload:
            res = supabase.table('calls').insert(calls_payload).execute()
            print(f"✅ DB INSERT SUCCESS: {len(res.data) if res.data else 0} rows.", flush=True)
            
        print("="*40 + "\n", flush=True)
        return jsonify({"status": "success", "message": "Synced"}), 201
        
    except Exception as e:
        print(f"🚨 CRASH:\n{traceback.format_exc()}\n", flush=True) 
        return jsonify({"status": "error", "message": str(e)}), 500

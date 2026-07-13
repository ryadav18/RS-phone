from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime, timezone

calls_bp = Blueprint('calls', __name__)

# GET ROUTE: Fetch sorted telemetry call logs
@calls_bp.route('/api/calls', methods=['GET'])
@token_required
def get_calls():
    device_id = request.args.get('device_id')
    
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized target device operation"}), 403

    try:
        # Aligned limit parameter defaults to respect the maximum 50 rows architecture layout
        limit = min(int(request.args.get('limit', 50)), 50)
        
        res = supabase.table('calls').select('*').eq('device_id', device_id).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid limit parameter format"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# POST ROUTE: Sync pipeline from device agent
@calls_bp.route('/api/sync/calls', methods=['POST'])
def upload_calls():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid credentials"}), 403

        dev_id = dev_check.data[0]['id']
        data = request.json or {}
        records = data.get('calls', [])

        if not records:
            return jsonify({"status": "success", "message": "Sync stream completed"}), 200

        calls_payload = []
        for record in records:
            raw_type = str(record.get('type', '1')).strip().upper()
            
            # SAFETY MATRIX A: Telephony Type Classifier Protocol
            if raw_type in ['2', 'OUTGOING']:
                final_type = 'OUTGOING'
            elif raw_type in ['3', 'MISSED', 'REJECTED']:
                final_type = 'MISSED'
            else:
                final_type = 'INCOMING'

            # 🚀 FIXED: Dynamic Key Resolver maps both snake_case and camelCase parameters gracefully
            phone_num = record.get('phone_number') or record.get('phoneNumber') or 'Unknown'
            cont_name = record.get('contact_name') or record.get('contactName') or 'Unknown'

            row_data = {
                "device_id": dev_id,
                "type": final_type,
                "phone_number": phone_num,
                "contact_name": cont_name, 
                "duration": int(record.get('duration', 0))
            }

            # SAFETY MATRIX B: ISO-8601 Timestamp Normalization Pipeline
            raw_ts = record.get('timestamp')
            if raw_ts:
                try:
                    if isinstance(raw_ts, (int, float)) or (isinstance(raw_ts, str) and raw_ts.isdigit()):
                        ts_float = float(raw_ts)
                        # If the epoch arriving is in milliseconds, scale down to seconds instantly
                        if ts_float > 10000000000:
                            ts_float /= 1000.0
                        
                        dt = datetime.fromtimestamp(ts_float, tz=timezone.utc)
                        row_data["timestamp"] = dt.isoformat()
                    else:
                        row_data["timestamp"] = str(raw_ts)
                except Exception as ts_error:
                    print(f"[Call Timestamp Exception Handled]: {ts_error}")
                    row_data["timestamp"] = datetime.now(timezone.utc).isoformat()
            else:
                row_data["timestamp"] = datetime.now(timezone.utc).isoformat()

            calls_payload.append(row_data)

        # Insert new data chunk into the database node
        supabase.table('calls').insert(calls_payload).execute()

        # =================================================================================
        # STRICT 50-ROW ROLLING BUFFER AUTOMATION CLEANUP ENGINE (FIFO)
        # =================================================================================
        calls_query = supabase.table('calls').select('id').eq('device_id', dev_id).order('timestamp', desc=True).execute()
        
        if len(calls_query.data) > 50:
            records_to_purge = calls_query.data[50:]
            ids_to_purge = [row['id'] for row in records_to_purge]
            
            supabase.table('calls').delete().in_('id', ids_to_purge).execute()
            print(f"[FIFO Calls Engine] Purged {len(ids_to_purge)} overflow logs from Supabase.")
        # =================================================================================

        return jsonify({"status": "success", "message": f"{len(calls_payload)} calls synced successfully"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# DELETE ROUTE: Target data wipe out
@calls_bp.route('/api/calls/clear', methods=['POST'])
@token_required
def clear_calls():
    data = request.json or {}
    device_id = data.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403
    try:
        supabase.table('calls').delete().eq('device_id', device_id).execute()
        return jsonify({"status": "success", "message": "Call logs cleared successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

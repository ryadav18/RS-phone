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
    
    # Aligned limit architecture parameters strictly up to 50 logs max
    limit = min(int(request.args.get('limit', 50)), 50) 

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Device request scope unauthorized"}), 403

    try:
        # Fetch communications log records formatted matching the chronological thread parser
        res = supabase.table('messages').select('*').eq('device_id', device_id).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@messages_bp.route('/api/sync/messages', methods=['POST'])
def upload_messages():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Device security token is absent"}), 401

    try:
        # Cross-verify if the calling node hardware token matches production registers
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
            raw_type = str(m.get('type', '1')).strip().upper()
            
            # 🚀 SAFETY MATRIX A: Strict directional standardization protocol
            if raw_type in ['2', 'SENT', 'RCS_SENT']:
                final_message_type = 2  # Integer 2 = Outbound / Sent
            else:
                final_message_type = 1  # Integer 1 = Inbound / Received

            row_data = {
                "device_id": dev_id,
                "sender": m.get('sender', 'Unknown'),
                "contact_name": m.get('contact_name', 'Unknown'),
                "message": m.get('message', ''), 
                "message_type": final_message_type, 
                "media_url": m.get('media_url', None)
            }
            
            # 🚀 SAFETY MATRIX B: Robust ISO-8601 Timestamp Normalization Pipeline
            raw_ts = m.get('timestamp')
            if raw_ts:
                try:
                    if isinstance(raw_ts, (int, float)) or (isinstance(raw_ts, str) and raw_ts.isdigit()):
                        ts_float = float(raw_ts)
                        # Scale milliseconds down to standard seconds if required
                        if ts_float > 10000000000:
                            ts_float /= 1000.0
                        
                        dt = datetime.fromtimestamp(ts_float, tz=timezone.utc)
                        row_data["timestamp"] = dt.isoformat()
                    else:
                        row_data["timestamp"] = str(raw_ts)
                except Exception as ts_error:
                    print(f"[Timestamp Exception Handled]: {ts_error}")
                    row_data["timestamp"] = datetime.now(timezone.utc).isoformat()
            else:
                row_data["timestamp"] = datetime.now(timezone.utc).isoformat()
                
            payload.append(row_data)

        # Batch insert block for logging newly intercepted communication streams
        supabase.table('messages').insert(payload).execute()

        # =================================================================================
        # 🚀 STRICT 50-ROW SMS ROLLING BUFFER AUTOMATION CLEANUP ENGINE (FIFO)
        # =================================================================================
        messages_query = supabase.table('messages').select('id').eq('device_id', dev_id).order('timestamp', desc=True).execute()
        
        if len(messages_query.data) > 50:
            records_to_purge = messages_query.data[50:]
            ids_to_purge = [row['id'] for row in records_to_purge]
            
            supabase.table('messages').delete().in_('id', ids_to_purge).execute()
            print(f"[FIFO Messages Engine] Purged {len(ids_to_purge)} overflow items from Supabase mapping.")
        # =================================================================================

        return jsonify({"status": "success", "message": f"{len(payload)} message transmission streams logged"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@messages_bp.route('/api/messages/clear', methods=['POST'])
@token_required
def clear_messages():
    data = request.json or {}
    device_id = data.get('device_id')

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403

    try:
        supabase.table('messages').delete().eq('device_id', device_id).execute()
        return jsonify({"status": "success", "message": "SMS data wiped successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

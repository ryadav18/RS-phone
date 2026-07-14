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
    
    try:
        limit = min(int(request.args.get('limit', 50)), 50) 
    except (ValueError, TypeError):
        limit = 50

    if not device_id:
        return jsonify({"status": "error", "message": "Device request scope unauthorized"}), 403

    try:
        if not verify_device_access(request.owner_id, device_id):
            return jsonify({"status": "error", "message": "Device request scope unauthorized"}), 403
    except Exception as access_err:
        return jsonify({"status": "success", "data": []}), 200

    try:
        query = supabase.table('messages').select('*')
        
        if '-' in str(device_id):
            query = query.eq('device_id', str(device_id))
        elif str(device_id).isdigit():
            query = query.eq('device_id', int(device_id))
        else:
            query = query.eq('device_id', str(device_id))
            
        res = query.order('timestamp', desc=True).limit(limit).execute()
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
        # 🚀 FIX: Fetching 'device_id' directly to match the dashboard request
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
            
            # 🚀 SCHEMA FIX: DB column 'type' expects TEXT
            if raw_type in ['2', 'SENT', 'RCS_SENT']:
                final_message_type = 'SENT'  
            else:
                final_message_type = 'RECEIVED'  

            sender_val = m.get('sender') or m.get('number') or 'Unknown'
            contact_name_val = m.get('contact_name') or m.get('contactName') or 'Unknown'
            msg_content = m.get('message') or m.get('body') or ''

            # 🚀 SCHEMA ALIGNMENT: Matched exactly to your Supabase 'messages' table
            row_data = {
                "device_id": dev_id,
                "number": sender_val,
                "contact_name": contact_name_val, 
                "body": msg_content,             
                "type": final_message_type       
            }
            
            raw_ts = m.get('timestamp')
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
                
            payload.append(row_data)

        supabase.table('messages').insert(payload).execute()

        # FIFO Engine
        messages_query = supabase.table('messages').select('id').eq('device_id', dev_id).order('timestamp', desc=True).execute()
        if len(messages_query.data) > 50:
            ids_to_purge = [row['id'] for row in messages_query.data[50:]]
            supabase.table('messages').delete().in_('id', ids_to_purge).execute()

        return jsonify({"status": "success", "message": f"{len(payload)} message transmission streams logged"}), 201
    except Exception as e:
        print(f"[Sync Critical Exception]: {str(e)}")
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

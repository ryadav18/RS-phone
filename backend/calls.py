from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

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
            calls_payload.append({
                "device_id": dev_id,
                "type": str(record.get('type', 'Unknown')),
                "phone_number": record.get('phone_number', 'Unknown'),
                "contact_name": record.get('contact_name', 'Unknown'), 
                "duration": int(record.get('duration', 0)),
                "timestamp": record.get('timestamp')
            })

        # Insert new data chunk into the database node
        supabase.table('calls').insert(calls_payload).execute()

        # =================================================================================
        # 🚀 STRICT 50-ROW ROLLING BUFFER AUTOMATION CLEANUP ENGINE (FIFO)
        # =================================================================================
        # Fetch current record indexes for this device, sorted strictly from latest to oldest
        calls_query = supabase.table('calls').select('id').eq('device_id', dev_id).order('timestamp', desc=True).execute()
        
        if len(calls_query.data) > 50:
            # Capture all trailing data items that cross over the 50 rows boundary threshold
            records_to_purge = calls_query.data[50:]
            ids_to_purge = [row['id'] for row in records_to_purge]
            
            # Fire an atomic batch network delete command inside the SQL instance
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

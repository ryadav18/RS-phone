from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/api/notifications', methods=['GET'])
@token_required
def get_notifications():
    device_id = request.args.get('device_id')
    # Limit lagana zaroori h taki dashboard crash na ho
    limit = request.args.get('limit', 100) 

    if not device_id:
        return jsonify({"status": "error", "message": "Query parameter device_id missing"}), 400

    if not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized access attempt"}), 403

    try:
        # Paginating the response to maximum 100 recent notifications
        res = supabase.table('notifications').select('*').eq('device_id', device_id).order('received_at', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@notifications_bp.route('/api/notifications', methods=['POST'])
def upload_notifications():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Authentication token required"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Unauthorized client access"}), 403

        dev_id = dev_check.data[0]['id']
        data = request.json or {}
        items = data.get('notifications', [])

        if not items:
            return jsonify({"status": "success", "message": "Empty sync load"}), 200

        inserted_rows = []
        for n in items:
            row_data = {
                "device_id": dev_id,
                "app_name": n.get('app_name', 'System').strip(),
                "app_icon": n.get('app_icon', ''),
                "title": n.get('title', 'Unknown').strip(),
                "message": n.get('message', '').strip()
            }
            # Agar Android se timestamp aaya h tabhi bhejo, warna DB khud default set krega
            if n.get('received_at'):
                row_data["received_at"] = n.get('received_at')
                
            inserted_rows.append(row_data)

        supabase.table('notifications').insert(inserted_rows).execute()
        return jsonify({"status": "success", "message": f"{len(inserted_rows)} records successfully synced"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@notifications_bp.route('/api/notifications/clear', methods=['POST'])
@token_required
def clear_notifications():
    data = request.json or {}
    device_id = data.get('device_id')

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403

    try:
        supabase.table('notifications').delete().eq('device_id', device_id).execute()
        return jsonify({"status": "success", "message": "Notifications history cleared"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

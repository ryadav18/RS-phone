from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

calls_bp = Blueprint('calls', __name__)

# GET ROUTE: Dashboard ke liye
@calls_bp.route('/api/calls', methods=['GET'])
@token_required
def get_calls():
    device_id = request.args.get('device_id')
    limit = request.args.get('limit', 150) 

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized target device operation"}), 403

    try:
        res = supabase.table('calls').select('*').eq('device_id', device_id).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 🚀 POST ROUTE FIX: Sync Engine ke liye
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
                "type": record.get('type', 'Unknown'),
                "phone_number": record.get('phone_number', 'Unknown'),
                "duration": record.get('duration', 0),
                "timestamp": record.get('timestamp')
            })

        supabase.table('calls').insert(calls_payload).execute()
        return jsonify({"status": "success", "message": f"{len(calls_payload)} calls synced"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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

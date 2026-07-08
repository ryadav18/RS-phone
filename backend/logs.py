from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

logs_bp = Blueprint('logs', __name__)

@logs_bp.route('/api/logs', methods=['GET'])
@token_required
def get_logs():
    device_id = request.args.get('device_id')
    limit = request.args.get('limit', 150)

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied for current owner context"}), 403

    try:
        res = supabase.table('activity_logs').select('*').eq('device_id', device_id).order('timestamp', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@logs_bp.route('/api/logs', methods=['POST'])
def create_log():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Client synchronization identity verification required"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Unauthorized target identification"}), 403

        dev_id = dev_check.data[0]['id']
        data = request.json or {}

        payload = {
            "device_id": dev_id,
            "event_type": data.get('event_type', 'Generic System Sync'),
            "description": data.get('description', 'Status check initiated')
        }

        res = supabase.table('activity_logs').insert(payload).execute()
        return jsonify({"status": "success", "data": res.data[0]}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@logs_bp.route('/api/logs/clear', methods=['POST'])
@token_required
def clear_logs():
    data = request.json or {}
    device_id = data.get('device_id')

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403

    try:
        supabase.table('activity_logs').delete().eq('device_id', device_id).execute()
        return jsonify({"status": "success", "message": "System logs wiped cleanly"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 🚀 NAYA ROUTE: FETCH APP USAGE FOR DASHBOARD
# ==========================================
@logs_bp.route('/api/usage', methods=['GET'])
@token_required
def get_app_usage():
    device_id = request.args.get('device_id')
    
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    try:
        # Fetching app usage sorted by most time spent
        res = supabase.table('app_usage').select('*').eq('device_id', device_id).order('time_spent', desc=True).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

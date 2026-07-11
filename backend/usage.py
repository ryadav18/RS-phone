from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from datetime import datetime, timedelta

usage_bp = Blueprint('usage', __name__)

# 1. SERVER -> DASHBOARD: Past 7 Days ka sorted analytics fetch karega
@usage_bp.route('/api/usage/analytics', methods=['GET'])
@token_required
def get_usage_analytics():
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Device request scope unauthorized"}), 403

    try:
        # Aaj se exactly 7 din pehle ki date calculate karo
        seven_days_ago = (datetime.utcnow() - timedelta(days=7)).date().isoformat()
        
        # Telemetry data fetch karo jo last 7 din ka ho aur usage_date & time_spent ke hisab se ordered ho
        res = supabase.table('app_usage')\
            .select('*')\
            .eq('device_id', device_id)\
            .gte('usage_date', seven_days_ago)\
            .order('usage_date', desc=True)\
            .order('time_spent', desc=True)\
            .execute()
            
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 2. APP -> SERVER: Phone ka Digital Wellbeing stats upload handler
@usage_bp.route('/api/sync/usage', methods=['POST'])
def sync_device_usage():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing authentication token"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Device check verification failed"}), 403

        dev_id = dev_check.data[0]['id']
        records = request.json.get('usage_records', [])
        
        payload = []
        for r in records:
            payload.append({
                "device_id": dev_id,
                "app_name": r.get('app_name', 'Unknown App'),
                "package_name": r.get('package_name'),
                "time_spent": int(r.get('time_spent', 0)),
                "usage_date": r.get('usage_date', datetime.utcnow().date().isoformat())
            })
        
        if payload:
            supabase.table('app_usage').insert(payload).execute()

        return jsonify({"status": "success", "message": f"{len(payload)} tracking nodes synced"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

ops_bp = Blueprint('ops', __name__)

@ops_bp.route('/api/ops', methods=['GET'])
@token_required
def get_operations():
    device_id = request.args.get('device_id')
    limit = request.args.get('limit', 50) 
    
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403

    try:
        # Hamesha latest command sabse upar (descending order)
        res = supabase.table('remote_commands').select('*').eq('device_id', device_id).order('created_at', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

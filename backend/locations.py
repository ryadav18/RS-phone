from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

locations_bp = Blueprint('locations', __name__)

@locations_bp.route('/api/locations', methods=['GET'])
@token_required
def get_locations():
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Device security restriction matched"}), 403

    try:
        # Fetch top 50 recent locations
        res = supabase.table('locations').select('*').eq('device_id', device_id).order('timestamp', desc=True).limit(50).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@locations_bp.route('/api/sync/locations', methods=['POST'])
def upload_location():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Unauthorized target"}), 403

        dev_id = dev_check.data[0]['id']
        data = request.json or {}

        lat = data.get('latitude')
        lng = data.get('longitude')

        if lat is None or lng is None:
            return jsonify({"status": "error", "message": "Incomplete coordinates"}), 400

        payload = {
            "device_id": dev_id,
            "latitude": float(lat),
            "longitude": float(lng),
            "accuracy": float(data.get('accuracy', 0.0)),
            "timestamp": data.get('timestamp', 'now()')
        }

        res = supabase.table('locations').insert(payload).execute()
        return jsonify({"status": "success", "data": res.data[0]}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

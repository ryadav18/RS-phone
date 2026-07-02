from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

files_bp = Blueprint('files', __name__)

@files_bp.route('/api/files', methods=['GET'])
@token_required
def get_files():
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access validation check failed"}), 403

    try:
        res = supabase.table('files').select('*').eq('device_id', device_id).order('uploaded_at', desc=True).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@files_bp.route('/api/files/upload', methods=['POST'])
def upload_file_tracker():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Unauthorized request signature"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid device credentials signature"}), 403

        dev_id = dev_check.data[0]['id']
        data = request.json or {}

        payload = {
            "device_id": dev_id,
            "file_name": data.get('file_name', 'Unnamed File'),
            "file_type": data.get('file_type', 'generic/binary'),
            "file_url": data.get('file_url'),
            "file_size": data.get('file_size', '0 KB')
        }

        if not payload['file_url']:
            return jsonify({"status": "error", "message": "A resource target URL parameter file_url must be provided"}), 400

        res = supabase.table('files').insert(payload).execute()
        return jsonify({"status": "success", "data": res.data[0]}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
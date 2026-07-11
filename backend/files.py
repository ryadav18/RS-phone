from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from werkzeug.utils import secure_filename
import uuid

files_bp = Blueprint('files', __name__)

# GET ROUTE: Fetch specific folder contents
@files_bp.route('/api/files', methods=['GET'])
@token_required
def get_files():
    device_id = request.args.get('device_id')
    folder_path = request.args.get('path', '/') 
    
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access validation check failed"}), 403

    try:
        # Strictly fetches only the metadata that belongs to the active directory scope
        res = supabase.table('files').select('*').eq('device_id', device_id).eq('folder_path', folder_path).order('file_name', desc=False).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# POST ROUTE: Receive actual file uploaded by the device agent
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
        
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "Physical file payload missing"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No file selected"}), 400

        # 🚀 FIX: Fetch current directory context to avoid cross-folder naming collisions
        folder_path = request.form.get('folder_path', '/') 
        
        filename = secure_filename(file.filename)
        unique_filename = f"{dev_id}/{uuid.uuid4()}_{filename}"
        file_content = file.read()

        # Stream payload directly to Supabase storage bucket area
        supabase.storage.from_('device_media').upload(
            path=unique_filename, 
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        public_url = supabase.storage.from_('device_media').get_public_url(unique_filename)

        payload = {
            "file_url": public_url,
            "is_uploaded": True 
        }
        
        # 🚀 FIX: Matched via device_id, file_name AND unique folder_path directory scope
        res = supabase.table('files').update(payload).eq('device_id', dev_id).eq('file_name', filename).eq('folder_path', folder_path).execute()

        supabase.table('activity_logs').insert({
            "device_id": dev_id,
            "event_type": "On-Demand Media Extracted",
            "description": f"Target file '{filename}' successfully pulled to secure cloud vault."
        }).execute()

        return jsonify({"status": "success", "data": res.data}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# DELETE ROUTE: Flush storage indexes safely
@files_bp.route('/api/files/clear', methods=['POST'])
@token_required
def clear_files():
    data = request.json or {}
    device_id = data.get('device_id')

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied"}), 403

    try:
        supabase.table('files').delete().eq('device_id', device_id).execute()
        return jsonify({"status": "success", "message": "Storage catalog cleared"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

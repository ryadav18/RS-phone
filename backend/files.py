from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from werkzeug.utils import secure_filename
import uuid

files_bp = Blueprint('files', __name__)

@files_bp.route('/api/files', methods=['GET'])
@token_required
def get_files():
    device_id = request.args.get('device_id')
    # Pagination limit taaki browser crash na ho
    limit = request.args.get('limit', 150) 
    
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access validation check failed"}), 403

    try:
        res = supabase.table('files').select('*').eq('device_id', device_id).order('uploaded_at', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 🚀 UPGRADED: ACTUAL FILE UPLOAD ENGINE (Multipart)
# ==========================================
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
        
        # 1. Check if actual physical file is attached in the request
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "Physical file payload missing"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No file selected"}), 400

        # 2. Extract extra form data sent by Android
        file_type = request.form.get('file_type', 'generic/binary')
        
        # 3. Secure the filename and create a unique path
        filename = secure_filename(file.filename)
        unique_filename = f"{dev_id}/{uuid.uuid4()}_{filename}"
        file_content = file.read()

        # 4. Upload physical file to Supabase Storage Bucket ('device_media')
        supabase.storage.from_('device_media').upload(
            path=unique_filename, 
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # 5. Generate Public URL
        public_url = supabase.storage.from_('device_media').get_public_url(unique_filename)

        # 6. Save metadata to Database
        payload = {
            "device_id": dev_id,
            "file_name": filename,
            "file_type": file_type,
            "file_url": public_url,
            "file_size": f"{len(file_content) / 1024:.2f} KB" # Convert bytes to KB
        }

        res = supabase.table('files').insert(payload).execute()

        # 7. Add a log entry for the parent dashboard
        supabase.table('activity_logs').insert({
            "device_id": dev_id,
            "event_type": "Media Uploaded",
            "description": f"New {file_type} captured and saved."
        }).execute()

        return jsonify({"status": "success", "data": res.data[0]}), 201
    except Exception as e:
        print(f"File Upload Crash: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# STORAGE MANAGEMENT: Clear File Logs API
# ==========================================
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

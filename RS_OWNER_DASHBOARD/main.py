from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from werkzeug.utils import secure_filename
import uuid

files_bp = Blueprint('files', __name__)

# ==========================================
# 🚀 MEDIA UPLOAD ENGINE (For Android App)
# ==========================================
@files_bp.route('/api/files/upload', methods=['POST'])
def upload_file():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401
        
    try:
        # 1. Authenticate Device
        device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not device_check.data:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
            
        dev_id = device_check.data[0]['id']
        
        # 2. Check if file is in the request
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "No file part in request"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No selected file"}), 400
            
        # 3. Get metadata sent from Android
        file_type = request.form.get('file_type', 'unknown') # e.g., 'screenshot', 'audio'
        
        # 4. Secure & Rename File
        filename = secure_filename(file.filename)
        unique_filename = f"{dev_id}/{uuid.uuid4()}_{filename}" # Folder structure inside bucket
        file_content = file.read()
        
        # 5. Upload to Supabase Storage Bucket ('device_media')
        res = supabase.storage.from_('device_media').upload(
            path=unique_filename, 
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # 6. Generate Public URL for Dashboard
        public_url = supabase.storage.from_('device_media').get_public_url(unique_filename)
        
        # 7. Save to Database Table
        file_payload = {
            "device_id": dev_id,
            "file_name": filename,
            "file_url": public_url,
            "file_type": file_type,
            "file_size": str(len(file_content))
        }
        supabase.table('files').insert(file_payload).execute()
        
        # 8. Add a Log Entry so parent gets notified
        supabase.table('activity_logs').insert({
            "device_id": dev_id,
            "event_type": f"New {file_type.capitalize()} Ready",
            "description": f"Media file {filename} uploaded successfully."
        }).execute()
        
        return jsonify({"status": "success", "message": "File uploaded successfully", "url": public_url}), 201
        
    except Exception as e:
        print(f"File Upload Error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# 🚀 FETCH FILES ENGINE (For Dashboard UI)
# ==========================================
@files_bp.route('/api/files', methods=['GET'])
@token_required
def get_files():
    device_id = request.args.get('device_id')
    
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized access to files"}), 403
        
    try:
        # Fetching files sorted by latest first
        res = supabase.table('files').select('*').eq('device_id', device_id).order('uploaded_at', desc=True).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

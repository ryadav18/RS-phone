import os
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from database import supabase

files_bp = Blueprint('files', __name__)

# =========================================================================
# 🚀 1. RECEIVE FILE TREE FROM ANDROID (StorageVaultEngine -> scanAndSyncDirectory)
# =========================================================================
@files_bp.route('/api/files/sync', methods=['POST'])
def sync_device_file_tree():
    """
    Android phone jab kisi folder ko scan karega, toh wo list is route par bhejega.
    Hum purane us folder ke data ko delete karke naya fresh data dalenge taaki duplicate na ho.
    """
    # Authorization via device token
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({"status": "error", "message": "Target context missing."}), 401

    try:
        # Validate Device
        dev_query = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_query.data:
            return jsonify({"status": "error", "message": "Unauthorized target node."}), 403
        
        device_id = dev_query.data[0]['id']
        data = request.json or {}
        files_list = data.get('files', [])

        if not files_list:
            return jsonify({"status": "success", "message": "Empty directory synced."}), 200

        # Extract folder path from the first item to clear old records
        folder_path = files_list[0].get('folder_path', '/')
        
        # 🧹 Clear old cache for this specific folder
        supabase.table('files').delete().eq('device_id', device_id).eq('folder_path', folder_path).execute()

        # 📦 Prepare fresh batch insert
        records_to_insert = []
        for f in files_list:
            records_to_insert.append({
                "device_id": device_id,
                "file_name": f.get("file_name"),
                "folder_path": f.get("folder_path"),
                "is_directory": f.get("is_directory", False),
                "size_bytes": f.get("size_bytes", 0),
                "is_downloaded": False # Default state
            })

        # Inject into Supabase
        supabase.table('files').insert(records_to_insert).execute()
        print(f"[VAULT] Directory {folder_path} synced for device {device_id}", flush=True)

        return jsonify({"status": "success", "message": "Directory map injected successfully."}), 200

    except Exception as e:
        print(f"[VAULT CRASH] Tree sync anomaly: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Database pipeline failed."}), 500


# =========================================================================
# 🚀 2. RECEIVE SPECIFIC FILE EXTRACTION (StorageVaultEngine -> uploadSpecificFile)
# =========================================================================
@files_bp.route('/api/files/upload', methods=['POST'])
def upload_vault_file():
    """
    Jab Android actual file (PDF, JPG, MP4) bhejega, toh ye route usko Supabase Storage
    bucket mein daalega aur file_url ko database mein update karega.
    """
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No binary payload attached."}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "Empty payload."}), 400

    try:
        # Validate Device
        dev_query = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_query.data:
            return jsonify({"status": "error", "message": "Unauthorized target node."}), 403
            
        device_id = dev_query.data[0]['id']
        
        # Secure the filename
        filename = secure_filename(file.filename)
        folder_path = request.form.get('folder_path', '/')
        
        # Create a unique path in Supabase Storage Bucket (named 'vault')
        storage_path = f"{device_id}/{uuid.uuid4()}_{filename}"
        
        # Read file bytes
        file_bytes = file.read()
        
        # ☁️ Upload to Supabase Storage
        res = supabase.storage.from_('vault').upload(storage_path, file_bytes)
        
        # Generate Public URL for downloading from dashboard
        file_url = supabase.storage.from_('vault').get_public_url(storage_path)

        # 🔄 Update database record to mark as downloaded & attach URL
        supabase.table('files').update({
            "is_downloaded": True,
            "file_url": file_url
        }).eq('device_id', device_id).eq('file_name', filename).eq('folder_path', folder_path).execute()

        print(f"[VAULT] File {filename} extracted and stored securely.", flush=True)

        return jsonify({
            "status": "success", 
            "message": "File extraction complete.",
            "url": file_url
        }), 200

    except Exception as e:
        print(f"[VAULT CRASH] Extraction pipeline anomaly: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Storage pipeline failed."}), 500


# =========================================================================
# 🚀 3. DASHBOARD API: GET FILE TREE (Frontend calling Backend)
# =========================================================================
@files_bp.route('/api/devices/<device_id>/files', methods=['GET'])
def get_device_files(device_id):
    """
    Tera frontend (Files.html) is route ko call karega table mein files dikhane ke liye.
    """
    folder_path = request.args.get('path', '/')
    
    try:
        query = supabase.table('files').select('*').eq('device_id', device_id).eq('folder_path', folder_path).execute()
        return jsonify({"status": "success", "data": query.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

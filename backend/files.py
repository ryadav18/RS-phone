import os
from flask import Blueprint, request, jsonify
from database import supabase

files_bp = Blueprint('files', __name__)

# =========================================================================
# 🚀 1. RECEIVE FILE TREE METADATA (StorageVaultEngine -> scanAndSyncDirectory)
# =========================================================================
@files_bp.route('/api/files/sync', methods=['POST'])
def sync_device_file_tree():
    """
    Android phone jab kisi folder ko scan karega, toh wo sirf TEXT LIST yahan bhejega.
    Database update hoga taaki Dashboard par parents ko files dikh sakein.
    Server storage usage: 0 bytes.
    """
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

        # Extract folder path from the first item to clear old cache records
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
                "is_downloaded": False # Telegram par jayega, toh dashboard pe downloaded mark fallback
            })

        # Inject into Supabase
        supabase.table('files').insert(records_to_insert).execute()
        print(f"[VAULT] Directory {folder_path} synced for device {device_id}", flush=True)

        return jsonify({"status": "success", "message": "Directory map injected successfully."}), 200

    except Exception as e:
        print(f"[VAULT CRASH] Tree sync anomaly: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Database pipeline failed."}), 500


# =========================================================================
# 🚀 2. UPLOAD PIPELINE OBLITERATED (Zero Server Load Architecture)
# =========================================================================
# The /api/files/upload endpoint is completely removed.
# When a parent requests a file extraction via FCM, the Android app directly
# uploads the massive payload to the Telegram API. Flask doesn't touch the file.

# =========================================================================
# 🚀 3. DASHBOARD API: GET FILE TREE (Frontend calling Backend)
# =========================================================================
@files_bp.route('/api/devices/<device_id>/files', methods=['GET'])
def get_device_files(device_id):
    """
    Dashboard UI is route ko call karta hai table mein files dikhane ke liye.
    """
    folder_path = request.args.get('path', '/')
    
    try:
        query = supabase.table('files').select('*').eq('device_id', device_id).eq('folder_path', folder_path).execute()
        return jsonify({"status": "success", "data": query.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

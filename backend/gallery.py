import os
import base64
import requests
from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

# Initialize the standalone blueprint module context
gallery_bp = Blueprint('gallery', __name__)

@gallery_bp.route('/api/files/upload', methods=['POST'])
def upload_gallery_photo():
    """
    Core Proxy Upload Gateway.
    Intercepts multi-part binary and form-data metadata from Android app, 
    relays to Google Drive script with correct directory routing, logs reference to Supabase, 
    and enforces 50-photo limit per device.
    """
    # 1. Telemetry Header Signature Verification Check
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device security signature"}), 401

    try:
        # Cross reference token validation maps against Supabase target registry
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid device token registry match"}), 403

        dev_id = dev_check.data[0]['id']

        # 2. Extract Binary Multi-part Data Array from Request Network Buffers
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "Multipart form-data key 'file' missing"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No stream sequence selected"}), 400

        # 🚀 THE FIX: Intercept contextual metadata parameters dispatched by Android Client
        upload_type = request.form.get('type', 'gallery') # Default fallback to gallery
        target_folder = request.form.get('folderPath', 'RollingMediaGallery')

        # Read binary block and encode to raw Base64 string matching Apps Script architecture
        file_bytes = file.read()
        base64_image_string = base64.b64encode(file_bytes).decode('utf-8')

        # 3. Retrieve Environment Gateway Endpoint Pointer
        drive_gateway_url = os.environ.get('DRIVE_GATEWAY_URL')
        if not drive_gateway_url:
            return jsonify({"status": "error", "message": "DRIVE_GATEWAY_URL missing in server configurations"}), 500

        # 🚀 UPGRADED PAYLOAD: Forward explicit routing maps to the 5TB Drive Setup
        gateway_payload = {
            "image_base64": base64_image_string,
            "file_name": file.filename,
            "folder_path": target_folder,
            "upload_type": upload_type
        }

        # Fire high-speed backend-to-backend HTTP POST routing request
        apps_script_response = requests.post(drive_gateway_url, json=gateway_payload, timeout=40)
        
        if apps_script_response.status_code != 200:
            return jsonify({"status": "error", "message": "Google Cloud storage node handshake timed out"}), 502

        response_data = apps_script_response.json()
        if response_data.get('status') != 'success':
            return jsonify({"status": "error", "message": response_data.get('error_message', 'Apps Script layer execution failure')}), 502

        # Extract rendering token fields returned by Google Apps Script
        direct_url = response_data.get('direct_url')
        drive_file_id = response_data.get('drive_file_id')

        # 4. Insert Metadata Pointer to Supabase Table ('photos')
        photo_payload = {
            "device_id": dev_id,
            "file_name": file.filename,
            "media_url": direct_url,
            "drive_file_id": drive_file_id
        }
        supabase.table('photos').insert(photo_payload).execute()

        # =================================================================================
        # 🚀 STRICT 50-IMAGE FIFO ROLLING BUFFER CLEANUP ENGINES
        # =================================================================================
        # Query total photos logged for this device id sorted from latest to oldest
        photos_query = supabase.table('photos').select('id').eq('device_id', dev_id).order('id', desc=True).execute()
        
        if len(photos_query.data) > 50:
            # Isolate all row entries exceeding the 50-limit threshold matrix boundary
            records_to_purge = photos_query.data[50:]
            ids_to_purge = [record['id'] for record in records_to_purge]
            
            # Execute batch network deletion query directly inside Supabase SQL node
            supabase.table('photos').delete().in_('id', ids_to_purge).execute()
            print(f"[FIFO Gallery Engine] Purged {len(ids_to_purge)} overflow references out of Supabase successfully. Drive remains untouched.")

        return jsonify({"status": "success", "message": "Media array frame processed, relayed and buffered successfully"}), 201

    except Exception as error:
        return jsonify({"status": "error", "message": f"Global Runtime Anomaly Neutralized: {str(error)}"}), 500

# =================================================================================
# WEB VIEW FRONTEND DATA POLLING FETCH CONTROLLER
# =================================================================================
@gallery_bp.route('/api/gallery', methods=['GET'])
@token_required
def get_dashboard_gallery():
    """Web panel authentication gate to pull the latest 50 image embed tokens."""
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized client dashboard operation"}), 403

    try:
        # Strictly return maximum 50 dynamic data items directly optimized for your dashboard grid layout
        res = supabase.table('photos').select('*').eq('device_id', device_id).order('id', desc=True).limit(50).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

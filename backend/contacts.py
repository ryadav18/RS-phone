from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase

contacts_bp = Blueprint('contacts', __name__)

# 1. APP -> SERVER: Contacts Sync Data (Receives 50 chunks from Android)
@contacts_bp.route('/api/sync/contacts', methods=['POST'])
def upload_contacts():
    token = request.headers.get('X-Device-Token')
    if not token:
        return jsonify({"status": "error", "message": "Missing device token"}), 401

    try:
        dev_check = supabase.table('devices').select('id').eq('device_token', token).execute()
        if not dev_check.data:
            return jsonify({"status": "error", "message": "Invalid credentials"}), 403

        dev_id = dev_check.data[0]['id']
        records = request.json.get('contacts', [])

        if not records:
            return jsonify({"status": "success", "message": "Empty chunk"}), 200

        # Prepare payload for Supabase
        payload = [
            {
                "device_id": dev_id, 
                "name": r.get('name', 'Unknown'), 
                "phone_number": r.get('phone_number', 'Unknown')
            } for r in records
        ]
        
        supabase.table('contacts').insert(payload).execute()
        return jsonify({"status": "success", "message": f"{len(payload)} contacts synced"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# 2. SERVER -> DASHBOARD: Fetch Only First 50 Contacts
@contacts_bp.route('/api/contacts', methods=['GET'])
@token_required
def get_contacts():
    device_id = request.args.get('device_id')
    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Unauthorized access"}), 403

    try:
        # Hamesha top 50 uthayega (Queue format)
        res = supabase.table('contacts').select('*').eq('device_id', device_id).order('id', desc=False).limit(50).execute()
        return jsonify({"status": "success", "data": res.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# 3. DASHBOARD -> SERVER: Burn (Delete) previous 50 contacts permanently
@contacts_bp.route('/api/contacts/burn', methods=['POST'])
@token_required
def burn_contacts():
    data = request.json or {}
    device_id = data.get('device_id')
    contact_ids = data.get('contact_ids', [])

    if not device_id or not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error"}), 403
    
    if not contact_ids:
        return jsonify({"status": "success"}), 200

    try:
        # Jo IDs read ho chuki hain, unhe DB se hamesha ke liye uda do
        supabase.table('contacts').delete().eq('device_id', device_id).in_('id', contact_ids).execute()
        return jsonify({"status": "success", "message": "Old contacts wiped successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

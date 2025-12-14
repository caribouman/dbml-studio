import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import '../styles/modal.css';
import './DatabricksConnection.css';

/**
 * Modal for configuring Databricks connection
 */
function DatabricksConnection({ isOpen, onClose, onConnectionSaved }) {
  const [formData, setFormData] = useState({
    workspace_url: '',
    access_token: '',
    http_path: '',
    default_catalog: '',
    default_schema: '',
    connection_name: 'Default Connection'
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [hasExistingConnection, setHasExistingConnection] = useState(false);

  // Load existing connection
  useEffect(() => {
    if (isOpen) {
      loadExistingConnection();
    }
  }, [isOpen]);

  const loadExistingConnection = async () => {
    try {
      const response = await apiRequest('/api/databricks/connection');
      if (response.connection) {
        setFormData({
          workspace_url: response.connection.workspace_url || '',
          access_token: '', // Don't populate token for security
          http_path: response.connection.http_path || '',
          default_catalog: response.connection.default_catalog || '',
          default_schema: response.connection.default_schema || '',
          connection_name: response.connection.connection_name || 'Default Connection'
        });
        setHasExistingConnection(true);
      }
    } catch (err) {
      // No existing connection, that's fine
      setHasExistingConnection(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await apiRequest('/api/databricks/test', {
        method: 'POST',
        body: JSON.stringify({
          workspace_url: formData.workspace_url,
          access_token: formData.access_token,
          http_path: formData.http_path
        })
      });

      if (response.connected) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: 'Connection failed' });
      }
    } catch (err) {
      setError(err.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.workspace_url || !formData.access_token || !formData.http_path) {
        throw new Error('Please fill in all required fields');
      }

      const response = await apiRequest('/api/databricks/connection', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response.success) {
        if (onConnectionSaved) {
          onConnectionSaved(response);
        }
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save connection');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiRequest('/api/databricks/connection', { method: 'DELETE' });
      setFormData({
        workspace_url: '',
        access_token: '',
        http_path: '',
        default_catalog: '',
        default_schema: '',
        connection_name: 'Default Connection'
      });
      setHasExistingConnection(false);
      alert('Connection deleted successfully');
    } catch (err) {
      setError(err.message || 'Failed to delete connection');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content databricks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Databricks Connection</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSave} className="databricks-form">
          <div className="form-group">
            <label htmlFor="connection_name">
              Connection Name
            </label>
            <input
              type="text"
              id="connection_name"
              name="connection_name"
              value={formData.connection_name}
              onChange={handleChange}
              placeholder="My Databricks Connection"
            />
          </div>

          <div className="form-group">
            <label htmlFor="workspace_url">
              Workspace URL <span className="required">*</span>
            </label>
            <input
              type="text"
              id="workspace_url"
              name="workspace_url"
              value={formData.workspace_url}
              onChange={handleChange}
              placeholder="https://your-workspace.cloud.databricks.com"
              required
            />
            <small>Your Databricks workspace URL (e.g., https://xxx.cloud.databricks.com)</small>
          </div>

          <div className="form-group">
            <label htmlFor="access_token">
              Access Token <span className="required">*</span>
            </label>
            <input
              type="password"
              id="access_token"
              name="access_token"
              value={formData.access_token}
              onChange={handleChange}
              placeholder={hasExistingConnection ? "Enter new token to update" : "dapi..."}
              required={!hasExistingConnection}
            />
            <small>Personal access token from Databricks User Settings</small>
          </div>

          <div className="form-group">
            <label htmlFor="http_path">
              HTTP Path <span className="required">*</span>
            </label>
            <input
              type="text"
              id="http_path"
              name="http_path"
              value={formData.http_path}
              onChange={handleChange}
              placeholder="/sql/1.0/warehouses/..."
              required
            />
            <small>SQL Warehouse HTTP path (found in Connection Details)</small>
          </div>

          <div className="form-group">
            <label htmlFor="default_catalog">
              Default Catalog
            </label>
            <input
              type="text"
              id="default_catalog"
              name="default_catalog"
              value={formData.default_catalog}
              onChange={handleChange}
              placeholder="main"
            />
          </div>

          <div className="form-group">
            <label htmlFor="default_schema">
              Default Schema
            </label>
            <input
              type="text"
              id="default_schema"
              name="default_schema"
              value={formData.default_schema}
              onChange={handleChange}
              placeholder="default"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.message}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={testing || !formData.workspace_url || !formData.access_token || !formData.http_path}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            {hasExistingConnection && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={loading}
              >
                Delete
              </button>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DatabricksConnection;

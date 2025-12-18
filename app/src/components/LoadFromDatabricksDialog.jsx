import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import WorkspaceExplorer from './WorkspaceExplorer';
import '../styles/modal.css';
import './DatabricksDeployDialog.css';

/**
 * Dialog for loading DBML files from Databricks Workspace
 */
function LoadFromDatabricksDialog({ isOpen, onClose, onLoadDbml }) {
  const [showWorkspaceExplorer, setShowWorkspaceExplorer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasConnection, setHasConnection] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const [loadedContent, setLoadedContent] = useState(null);

  // Check connection on mount
  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = async () => {
    setLoading(true);
    setError(null);

    try {
      const connResponse = await apiRequest('/api/databricks/connection');
      if (!connResponse.connection) {
        setHasConnection(false);
        setError('No Databricks connection configured. Please configure a connection first.');
        return;
      }
      setHasConnection(true);
    } catch (err) {
      setError(err.message || 'Failed to check Databricks connection');
      setHasConnection(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async (path) => {
    setSelectedPath(path);
    setShowWorkspaceExplorer(false);
    setLoading(true);
    setError(null);
    setLoadedContent(null);

    try {
      const response = await apiRequest(`/api/databricks/workspace/download?path=${encodeURIComponent(path)}`);

      // Try to parse as JSON (diagram format with positions)
      let parsedData = null;
      let dbmlCode = '';
      let positions = null;

      try {
        parsedData = JSON.parse(response.content);
        // Check if it's our diagram format
        if (parsedData.dbml_code) {
          dbmlCode = parsedData.dbml_code;
          positions = parsedData.positions || null;
        } else {
          // JSON but not our format, treat as raw content
          dbmlCode = response.content;
        }
      } catch (parseError) {
        // Not JSON, treat as plain DBML text
        dbmlCode = response.content;
      }

      setLoadedContent({
        path: response.path,
        content: response.content,
        dbmlCode: dbmlCode,
        positions: positions,
        hasPositions: positions !== null
      });

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to download file from Databricks');
      setLoadedContent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadIntoEditor = () => {
    if (loadedContent && loadedContent.dbmlCode) {
      onLoadDbml(loadedContent.dbmlCode, loadedContent.positions, loadedContent.path);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedPath('');
    setLoadedContent(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content databricks-deploy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Load DBML from Databricks</h2>
          <button className="modal-close" onClick={handleCancel}>&times;</button>
        </div>

        {!hasConnection ? (
          <div className="no-connection-message">
            <p>No Databricks connection configured.</p>
            <p>Please configure a connection in Settings before loading files.</p>
          </div>
        ) : (
          <div className="deploy-form">
            <div className="form-section">
              <div className="section-content">
                <p className="section-description">
                  Select a diagram file (Python notebook with DBML code and positions) from your Databricks workspace to load into the editor.
                </p>

                <div className="workspace-path-selector">
                  <label>
                    <span className="label-icon">📍</span>
                    Selected File:
                  </label>
                  <div className="path-input-group">
                    <input
                      type="text"
                      value={selectedPath}
                      placeholder="No file selected"
                      readOnly
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowWorkspaceExplorer(true)}
                      disabled={loading}
                    >
                      Browse...
                    </button>
                  </div>
                  <small>Click "Browse..." to select a DBML file from your Databricks workspace</small>
                </div>

                {loading && (
                  <div className="loading-message">
                    Loading file from Databricks...
                  </div>
                )}

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                {loadedContent && (
                  <div className="upload-result success">
                    <strong>✓ File loaded successfully!</strong>
                    <div style={{ marginTop: '8px', fontSize: '13px' }}>
                      <strong>Path:</strong> {loadedContent.path}
                      <br />
                      <strong>DBML Size:</strong> {loadedContent.dbmlCode.length} characters
                      <br />
                      <strong>Positions:</strong> {loadedContent.hasPositions ? '✓ Included' : '✗ Not included'}
                    </div>
                    <div style={{ marginTop: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
                      <strong>DBML Preview:</strong>
                      <pre style={{ fontSize: '12px', margin: '8px 0 0 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                        {loadedContent.dbmlCode.substring(0, 500)}
                        {loadedContent.dbmlCode.length > 500 ? '...' : ''}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLoadIntoEditor}
                disabled={!loadedContent || loading}
              >
                Load into Editor
              </button>
            </div>
          </div>
        )}

        {/* Workspace Explorer Modal */}
        <WorkspaceExplorer
          isOpen={showWorkspaceExplorer}
          onClose={() => setShowWorkspaceExplorer(false)}
          onSelectPath={handleSelectFile}
          currentPath="/Workspace"
          mode="select"
        />
      </div>
    </div>
  );
}

export default LoadFromDatabricksDialog;

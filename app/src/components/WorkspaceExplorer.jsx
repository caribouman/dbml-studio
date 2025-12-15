import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import './WorkspaceExplorer.css';

/**
 * Databricks Workspace file explorer component
 * Allows browsing workspace directories and selecting upload location
 */
function WorkspaceExplorer({ isOpen, onClose, onSelectPath, currentPath = '/' }) {
  const [path, setPath] = useState(currentPath);
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [fileName, setFileName] = useState('schema.dbml');

  // Load workspace contents when path changes
  useEffect(() => {
    if (isOpen && path) {
      loadWorkspace(path);
    }
  }, [isOpen, path]);

  // Update breadcrumbs when path changes
  useEffect(() => {
    if (path) {
      const parts = path.split('/').filter(Boolean);
      const crumbs = [{ name: 'Root', path: '/' }];

      let currentPath = '';
      parts.forEach(part => {
        currentPath += '/' + part;
        crumbs.push({ name: part, path: currentPath });
      });

      setBreadcrumbs(crumbs);
    }
  }, [path]);

  const loadWorkspace = async (targetPath) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest(`/api/databricks/workspace/list?path=${encodeURIComponent(targetPath)}`);

      // Show both directories and files, sorted (directories first)
      const items = (response.objects || [])
        .sort((a, b) => {
          // Directories first, then files
          if (a.object_type === 'DIRECTORY' && b.object_type !== 'DIRECTORY') return -1;
          if (a.object_type !== 'DIRECTORY' && b.object_type === 'DIRECTORY') return 1;
          // Within same type, sort by path
          return a.path.localeCompare(b.path);
        });

      setObjects(items);
    } catch (err) {
      setError(err.message || 'Failed to load workspace');
      setObjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (newPath) => {
    setPath(newPath);
  };

  const handleSelectCurrent = () => {
    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    const fullPath = path === '/' ? `/${fileName}` : `${path}/${fileName}`;
    onSelectPath(fullPath);
    onClose();
  };

  const handleGoUp = () => {
    if (path === '/') return;

    const parts = path.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    setPath(newPath);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content workspace-explorer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Workspace Location</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="explorer-content">
          {/* Breadcrumb navigation */}
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && <span className="breadcrumb-sep">/</span>}
                <button
                  className={`breadcrumb ${crumb.path === path ? 'active' : ''}`}
                  onClick={() => handleNavigate(crumb.path)}
                  disabled={crumb.path === path}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Current path display */}
          <div className="current-path">
            <label>
              <span className="label-icon">📁</span>
              Current Location:
            </label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Workspace/..."
            />
          </div>

          {/* File name input */}
          <div className="file-name-input">
            <label>
              <span className="label-icon">📄</span>
              File Name:
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="schema.dbml"
            />
          </div>

          {/* Full path preview */}
          <div className="path-preview">
            <strong>Full path:</strong> {path === '/' ? `/${fileName}` : `${path}/${fileName}`}
          </div>

          {/* Directory listing */}
          <div className="directory-list">
            {loading ? (
              <div className="loading-message">Loading directories...</div>
            ) : error ? (
              <div className="error-message">{error}</div>
            ) : (
              <>
                {/* Parent directory button */}
                {path !== '/' && (
                  <div className="directory-item parent" onClick={handleGoUp}>
                    <span className="dir-icon">📁</span>
                    <span className="dir-name">..</span>
                  </div>
                )}

                {/* Directory and file list */}
                {objects.length === 0 ? (
                  <div className="empty-message">No items in this location</div>
                ) : (
                  objects.map(obj => {
                    const isDirectory = obj.object_type === 'DIRECTORY';
                    const itemName = obj.path.split('/').pop();

                    return (
                      <div
                        key={obj.path}
                        className={`directory-item ${!isDirectory ? 'file-item' : ''}`}
                        onClick={() => isDirectory && handleNavigate(obj.path)}
                        style={{ cursor: isDirectory ? 'pointer' : 'default' }}
                      >
                        <span className="dir-icon">
                          {isDirectory ? '📁' : '📄'}
                        </span>
                        <span className="dir-name">{itemName}</span>
                        {!isDirectory && (
                          <span className="item-type">{obj.object_type}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="explorer-hint">
            <strong>Tip:</strong> Navigate to the desired folder, enter a file name, and click "Select Location".
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSelectCurrent}
            disabled={!fileName.trim()}
          >
            Select Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceExplorer;

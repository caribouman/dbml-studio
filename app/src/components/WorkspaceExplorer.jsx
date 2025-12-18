import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import './WorkspaceExplorer.css';

/**
 * Databricks Workspace file explorer component
 * Allows browsing workspace directories and selecting upload location or existing files
 * @param {string} mode - 'create' (default) for creating new files, 'select' for selecting existing files
 */
function WorkspaceExplorer({ isOpen, onClose, onSelectPath, currentPath = '/', mode = 'create' }) {
  const [path, setPath] = useState(currentPath);
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [fileName, setFileName] = useState('dbml_diagram.py');
  const [selectedFile, setSelectedFile] = useState(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setError(null);
      if (mode === 'create') {
        setFileName('dbml_diagram.py');
      }
    }
  }, [isOpen, mode]);

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

  const handleSelectFile = (file) => {
    if (mode === 'select') {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSelectCurrent = () => {
    if (mode === 'select') {
      // In select mode, must have a selected file
      if (!selectedFile) {
        setError('Please select a file');
        return;
      }
      onSelectPath(selectedFile.path);
      onClose();
    } else {
      // In create mode, must have a file name
      const trimmedFileName = fileName.trim();
      if (!trimmedFileName) {
        setError('Please enter a file name');
        return;
      }

      // Ensure the file has .py extension (for Python notebook)
      let finalFileName = trimmedFileName;
      if (!finalFileName.endsWith('.py')) {
        finalFileName += '.py';
      }

      const fullPath = path === '/' ? `/${finalFileName}` : `${path}/${finalFileName}`;
      onSelectPath(fullPath);
      onClose();
    }
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
          <h2>{mode === 'select' ? 'Select Existing File' : 'Select Workspace Location'}</h2>
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

          {/* File name input (only in create mode) */}
          {mode === 'create' && (
            <>
              <div className="file-name-input">
                <label>
                  <span className="label-icon">📄</span>
                  File Name:
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="dbml_diagram.py"
                />
              </div>

              {/* Full path preview */}
              <div className="path-preview">
                <strong>Full path:</strong> {path === '/' ? `/${fileName}` : `${path}/${fileName}`}
              </div>
            </>
          )}

          {/* Selected file display (only in select mode) */}
          {mode === 'select' && selectedFile && (
            <div className="path-preview">
              <strong>Selected file:</strong> {selectedFile.path}
            </div>
          )}

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
                    const isSelected = mode === 'select' && selectedFile?.path === obj.path;
                    const isClickable = isDirectory || mode === 'select';

                    return (
                      <div
                        key={obj.path}
                        className={`directory-item ${!isDirectory ? 'file-item' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (isDirectory) {
                            handleNavigate(obj.path);
                          } else if (mode === 'select') {
                            handleSelectFile(obj);
                          }
                        }}
                        style={{ cursor: isClickable ? 'pointer' : 'default' }}
                      >
                        <span className="dir-icon">
                          {isDirectory ? '📁' : '📄'}
                        </span>
                        <span className="dir-name">{itemName}</span>
                        {!isDirectory && (
                          <span className="item-type">{obj.object_type}</span>
                        )}
                        {isSelected && (
                          <span className="selected-indicator">✓</span>
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
            <strong>Tip:</strong> {mode === 'select'
              ? 'Navigate through folders and click on a file to select it.'
              : 'Navigate to the desired folder, enter a file name, and click "Select Location".'}
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
            disabled={mode === 'select' ? !selectedFile : !fileName.trim()}
          >
            {mode === 'select' ? 'Select File' : 'Select Location'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceExplorer;

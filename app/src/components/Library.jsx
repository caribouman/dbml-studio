import React, { useState, useEffect } from 'react';
import { diagramsAPI } from '../utils/api';
import './Library.css';

export default function Library({ isOpen, onClose, onLoadDiagram }) {
  const [diagrams, setDiagrams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDiagrams();
    }
  }, [isOpen]);

  const loadDiagrams = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await diagramsAPI.getAll();
      setDiagrams(data.diagrams || []);
    } catch (err) {
      setError(err.message || 'Failed to load diagrams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (diagramId) => {
    try {
      const data = await diagramsAPI.getById(diagramId);
      onLoadDiagram(data.diagram);
      onClose();
    } catch (err) {
      alert('Failed to load diagram: ' + err.message);
    }
  };

  const handleDelete = async (diagramId, title) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await diagramsAPI.delete(diagramId);
      setDiagrams(diagrams.filter(d => d.id !== diagramId));
    } catch (err) {
      alert('Failed to delete diagram: ' + err.message);
    }
  };

  const handleExportJSON = async (diagramId, title) => {
    try {
      const data = await diagramsAPI.getById(diagramId);
      const diagram = data.diagram;

      // Create JSON export with DBML and visualization data
      const exportData = {
        title: diagram.title,
        description: diagram.description,
        dbml_code: diagram.dbml_code,
        positions: diagram.positions,
        is_public: diagram.is_public,
        exported_at: new Date().toISOString(),
        version: '1.0',
      };

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export diagram: ' + err.message);
    }
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate the imported data
        if (!importData.dbml_code) {
          throw new Error('Invalid JSON: missing dbml_code');
        }

        // Load the diagram into the editor
        onLoadDiagram({
          title: importData.title || 'Imported Diagram',
          description: importData.description || '',
          dbml_code: importData.dbml_code,
          positions: importData.positions || {},
          is_public: false, // Default to private on import
        });
        onClose();
      } catch (err) {
        alert('Failed to import JSON: ' + err.message);
      }
    };
    input.click();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="library-overlay" onClick={onClose}>
      <div className="library-modal" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <h2>My Diagrams</h2>
          <div className="library-header-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleImportJSON}>
              📥 Import JSON
            </button>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="library-body">
          {error && <div className="library-error">{error}</div>}

          {isLoading ? (
            <div className="library-loading">Loading...</div>
          ) : diagrams.length === 0 ? (
            <div className="library-empty">
              <p>No saved diagrams yet</p>
              <p className="library-empty-hint">Create your first diagram to get started!</p>
            </div>
          ) : (
            <div className="diagrams-grid">
              {diagrams.map((diagram) => (
                <div key={diagram.id} className="diagram-card">
                  <div className="diagram-card-header">
                    <h3>{diagram.title}</h3>
                    {diagram.is_public && <span className="badge-public">Public</span>}
                  </div>
                  {diagram.description && (
                    <p className="diagram-description">{diagram.description}</p>
                  )}
                  <div className="diagram-meta">
                    <small>Updated: {formatDate(diagram.updated_at)}</small>
                  </div>
                  <div className="diagram-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleLoad(diagram.id)}
                    >
                      Load
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleExportJSON(diagram.id, diagram.title)}
                      title="Export as JSON"
                    >
                      📥 JSON
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(diagram.id, diagram.title)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

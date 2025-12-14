import React, { useState, useEffect } from 'react';
import { diagramsAPI } from '../utils/api';
import './SaveDiagramDialog.css';

export default function SaveDiagramDialog({ isOpen, onClose, dbmlCode, positions, currentDiagram }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentDiagram) {
      setTitle(currentDiagram.title || '');
      setDescription(currentDiagram.description || '');
      setIsPublic(currentDiagram.is_public || false);
    } else if (isOpen) {
      setTitle('');
      setDescription('');
      setIsPublic(false);
    }
  }, [isOpen, currentDiagram]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Check if we have a valid diagram ID to update
      // currentDiagram might exist but not have an ID (e.g., imported from JSON)
      if (currentDiagram && currentDiagram.id) {
        // Update existing diagram
        await diagramsAPI.update(
          currentDiagram.id,
          title,
          description,
          dbmlCode,
          positions,
          isPublic
        );
      } else {
        // Create new diagram (no ID or imported diagram)
        await diagramsAPI.create(
          title,
          description,
          dbmlCode,
          positions,
          isPublic
        );
      }
      onClose(true); // true indicates success
    } catch (err) {
      setError(err.message || 'Failed to save diagram');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="save-dialog-overlay" onClick={onClose}>
      <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="save-dialog-header">
          <h2>{currentDiagram && currentDiagram.id ? 'Update Diagram' : 'Save Diagram'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="save-dialog-body">
          {error && <div className="save-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="My Database Schema"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of your diagram..."
                rows="3"
              />
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>Make this diagram public</span>
              </label>
              <small>Public diagrams can be viewed by anyone with the link</small>
            </div>

            <div className="save-dialog-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : (currentDiagram && currentDiagram.id) ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

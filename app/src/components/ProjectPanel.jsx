import React, { useState, useEffect, useRef } from 'react';
import { NodeResizer } from 'reactflow';
import './ProjectPanel.css';

// This is now a React Flow node component
function ProjectPanel({ data, selected }) {
  // Base dimensions and font sizes
  const BASE_WIDTH = 300;
  const BASE_HEIGHT = 100;
  const BASE_FONT_SIZE_HEADER = 22;
  const BASE_FONT_SIZE_NOTE = 15;

  const nodeRef = useRef(null);
  const [currentWidth, setCurrentWidth] = useState(450); // Default width
  const [currentHeight, setCurrentHeight] = useState(120); // Default height

  // Use ResizeObserver to track actual DOM dimensions
  useEffect(() => {
    if (!nodeRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        if (width > 0) {
          setCurrentWidth(width);
        }
        if (height > 0) {
          setCurrentHeight(height);
        }
      }
    });

    resizeObserver.observe(nodeRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate font size based on width - no limits, scales freely
  const widthRatio = currentWidth / BASE_WIDTH;
  const heightRatio = currentHeight / BASE_HEIGHT;

  // Use width ratio primarily, but reduce if height is too small
  let scale = widthRatio;
  if (heightRatio < 0.7) {
    // If height is very small, reduce scale to fit
    scale = Math.min(widthRatio, heightRatio * 1.3);
  }

  // Calculate font sizes - no limits, pure scaling
  const headerFontSize = BASE_FONT_SIZE_HEADER * scale;
  const noteFontSize = BASE_FONT_SIZE_NOTE * scale;

  // The main component render
  return (
    <div className="project-panel-node" ref={nodeRef}>
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={100}
        handleStyle={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: '#667eea',
          border: '2px solid white',
        }}
      />
      <div className="drag-handle">⋮⋮</div>
      <div className="project-content">
        {data.name && (
          <div
            className="project-header"
            style={{ fontSize: `${headerFontSize}px` }}
          >
            <strong>{data.name}</strong>
            {data.databaseType && (
              <span className="project-db-badge" style={{ fontSize: `${headerFontSize * 0.6}px` }}>
                {data.databaseType}
              </span>
            )}
          </div>
        )}

        {data.note && (
          <div
            className="project-note"
            style={{ fontSize: `${noteFontSize}px` }}
          >
            {data.note}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectPanel;

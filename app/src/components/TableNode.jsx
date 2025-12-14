import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import './TableNode.css';

function TableNode({ data, dragging }) {
  const headerColor = data.headerColor || '#667eea';

  return (
    <div className="table-node" style={{ borderColor: headerColor }}>
      <Handle type="target" position={Position.Top} style={{ background: headerColor }} />

      <div className="table-header" style={{ background: headerColor }}>
        <div className="table-name">{data.name}</div>
        {data.note && <div className="table-note">{data.note}</div>}
      </div>

      <div className="table-body">
        {data.fields.map((field, index) => (
          <div
            key={index}
            className="field-row"
            title={field.note || ''}
          >
            <span className="field-name">{field.name}</span>
            <span className="field-type">{field.type}</span>
            {field.pk && <span className="field-badge pk">PK</span>}
            {field.unique && <span className="field-badge unique">U</span>}
            {field.notNull && <span className="field-badge not-null">NN</span>}
            {field.note && <span className="field-note-indicator">📝</span>}
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: headerColor }} />
    </div>
  );
}

export default memo(TableNode);

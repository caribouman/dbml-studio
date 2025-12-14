import React, { memo } from 'react';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import './GroupNode.css';

function GroupNode({ data, selected }) {
  const color = data.color || '#667eea';

  return (
    <div
      className="group-node-wrapper"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <NodeResizer
        color={color}
        isVisible={selected}
        minWidth={500}
        minHeight={400}
        handleStyle={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
        }}
      />
      <div
        className="group-node"
        style={{
          borderColor: color,
          backgroundColor: `${color}10`,
          pointerEvents: 'none',
        }}
      >
        <div className="group-header" style={{ backgroundColor: color }}>
          {data.name}
        </div>
      </div>
    </div>
  );
}

export default memo(GroupNode);

import React, { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  getRectOfNodes,
  useReactFlow,
} from 'reactflow';
import * as domToImage from 'html-to-image';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import TableNode from './TableNode';
import GroupNode from './GroupNode';
import ProjectPanel from './ProjectPanel';
import { parseDBML } from '../utils/dbmlParser';
import { loadPositions, savePositions } from '../utils/positionStorage';
import useHistoryStore from '../utils/historyStore';
import './DBMLViewer.css';

const nodeTypes = {
  table: TableNode,
  group: GroupNode,
  project: ProjectPanel,
};

function DBMLViewer({ dbmlCode, parseResult, parseError, loadedPositions, onPositionsChange, onCodeChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [projectId, setProjectId] = useState('default');
  const [isLocked, setIsLocked] = useState(false);
  const [theme, setTheme] = useState('light');
  const [direction, setDirection] = useState('TB');
  const [selectedNode, setSelectedNode] = useState(null);
  const [project, setProject] = useState(null);
  const initialFitDone = useRef(false);
  const lastParseResultRef = useRef(null);
  const lastKnownPositionsRef = useRef({});
  const { getNodes, getEdges, fitView, zoomIn, zoomOut } = useReactFlow();
  const viewportRef = useRef(null);
  const { setPresent, undo, redo } = useHistoryStore();

  const getLayoutedElements = useCallback((nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
  
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });
  
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: node.width, height: node.height });
    });
  
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });
  
    dagre.layout(dagreGraph);
  
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.targetPosition = isHorizontal ? 'left' : 'top';
      node.sourcePosition = isHorizontal ? 'right' : 'bottom';
  
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      node.position = {
        x: nodeWithPosition.x - node.width / 2,
        y: nodeWithPosition.y - node.height / 2,
      };
  
      return node;
    });
  
    return { nodes: layoutedNodes, edges };
  }, []);

  useEffect(() => {
    const loadDiagram = async () => {
      // Skip if parseResult hasn't actually changed
      // Note: loadedPositions is intentionally NOT in deps to prevent reloading during drag operations
      if (parseResult === lastParseResultRef.current) {
        return;
      }
      lastParseResultRef.current = parseResult;

      // If there's a parse error, clear the diagram
      if (parseError) {
        setNodes([]);
        setEdges([]);
        return;
      }

      // If there's a valid parse result, use it
      if (parseResult) {
        try {
          const { nodes: parsedNodes, edges: parsedEdges, project: projectData } = parseResult;

          // Set project data
          setProject(projectData);

          // Generate project ID based on content hash
          const hash = dbmlCode ? btoa(dbmlCode).substring(0, 16) : 'default';
          setProjectId(hash);

          // Get current node positions before loading (using getNodes to avoid dependency)
          // Save ALL positions including child nodes (tables inside groups)
          const currentNodes = getNodes();
          const currentPositions = {};
          currentNodes.forEach(node => {
            if (node.position &&
                typeof node.position.x === 'number' &&
                typeof node.position.y === 'number' &&
                !isNaN(node.position.x) &&
                !isNaN(node.position.y)) {
              currentPositions[node.id] = node.position;
            }
          });

          // Load saved positions - use loadedPositions prop if available (and non-empty), otherwise load from storage
          const hasLoadedPositions = loadedPositions && Object.keys(loadedPositions).length > 0;
          const savedPositions = await loadPositions(hash);

          // Priority: loadedPositions (loading diagram) > lastKnownPositions (editing) > currentPositions > savedPositions
          // When loading a diagram explicitly, always use loadedPositions to show the saved state
          // lastKnownPositions is only used during continuous editing of the same diagram
          let finalPositions;
          const hasCurrentPositions = Object.keys(currentPositions).length > 0;
          const hasLastKnownPositions = Object.keys(lastKnownPositionsRef.current).length > 0;
          const hasSavedPositions = Object.keys(savedPositions).length > 0;

          if (hasLoadedPositions) {
            // LOADING MODE - loading a saved diagram from database (highest priority)
            finalPositions = loadedPositions;
            // Clear lastKnownPositions to start fresh with loaded diagram
            lastKnownPositionsRef.current = {};
          } else if (hasLastKnownPositions) {
            // EDITING MODE - use lastKnownPositions (saved before any edit operation)
            finalPositions = lastKnownPositionsRef.current;
          } else if (hasCurrentPositions) {
            // Fallback to current ReactFlow positions
            finalPositions = currentPositions;
          } else if (hasSavedPositions) {
            // Last resort - try localStorage
            finalPositions = savedPositions;
          } else {
            finalPositions = {};
          }

          // Save to localStorage and ref with new hash to preserve positions across edits
          if (Object.keys(finalPositions).length > 0) {
            savePositions(hash, finalPositions);
            lastKnownPositionsRef.current = { ...finalPositions }; // Clone to avoid reference issues
          }

          // Apply positions to ALL nodes (including children)
          const nodesWithPositions = parsedNodes.map(node => {
            const savedPos = finalPositions[node.id];
            if (savedPos &&
                typeof savedPos.x === 'number' &&
                typeof savedPos.y === 'number' &&
                !isNaN(savedPos.x) &&
                !isNaN(savedPos.y)) {
              const updatedNode = {
                ...node,
                position: { x: savedPos.x, y: savedPos.y },
              };
              // Restore dimensions for project nodes if saved
              if (node.type === 'project' && savedPos.width && savedPos.height) {
                updatedNode.width = savedPos.width;
                updatedNode.height = savedPos.height;
                updatedNode.style = {
                  ...updatedNode.style,
                  width: savedPos.width,
                  height: savedPos.height,
                };
              }
              return updatedNode;
            }
            return node;
          });

          // Recalculate group dimensions to fit their children
          const nodesWithGroupSizes = nodesWithPositions.map(node => {
            if (node.type === 'group') {
              // Find all children of this group
              const children = nodesWithPositions.filter(n => n.parentNode === node.id);

              if (children.length > 0) {
                // Calculate bounding box for all children
                const padding = 40; // GROUP_PADDING
                const headerHeight = 50; // GROUP_HEADER_HEIGHT

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                children.forEach(child => {
                  const childWidth = child.width || 300;
                  const childHeight = child.height || 280;
                  const x = child.position.x;
                  const y = child.position.y;

                  minX = Math.min(minX, x);
                  minY = Math.min(minY, y);
                  maxX = Math.max(maxX, x + childWidth);
                  maxY = Math.max(maxY, y + childHeight);
                });

                // Calculate new group dimensions
                const width = maxX - minX + (padding * 2);
                const height = maxY - minY + headerHeight + (padding * 2);

                return {
                  ...node,
                  width: Math.max(width, node.width || 500),
                  height: Math.max(height, node.height || 400),
                  style: {
                    ...node.style,
                    width: Math.max(width, node.width || 500),
                    height: Math.max(height, node.height || 400),
                  }
                };
              }
            }
            return node;
          });

          setNodes(nodesWithGroupSizes);
          setEdges(parsedEdges);
          setPresent({ nodes: nodesWithGroupSizes, edges: parsedEdges });
          initialFitDone.current = false; // Reset on new data
        } catch (error) {
          console.error('Error loading diagram:', error);
        }
      }
    };

    loadDiagram();
  }, [parseResult, parseError, dbmlCode, getNodes, setNodes, setEdges, setPresent]);

  // Handle nodes changes and filter invalid positions
  const handleNodesChange = useCallback((changes) => {
    // Filter out invalid position changes for child nodes
    const validChanges = changes.map(change => {
      if (change.type === 'position') {
        // If position is provided and is invalid (NaN), skip this change
        // This happens with child nodes due to ReactFlow's parent-child position calculation
        if (change.position && (isNaN(change.position.x) || isNaN(change.position.y))) {
          // Silently filter - this is expected behavior for child nodes
          return null;
        }
      }
      return change;
    }).filter(Boolean);

    // Apply changes
    onNodesChange(validChanges);

    // Check if any dimension changes occurred (e.g., from NodeResizer)
    const hasDimensionChanges = changes.some(change => change.type === 'dimensions');
    if (hasDimensionChanges) {
      // Save positions after dimension changes to persist resized project panels
      setTimeout(() => {
        const positions = {};
        const currentNodes = getNodes();
        currentNodes.forEach(n => {
          if (n.position &&
              typeof n.position.x === 'number' &&
              typeof n.position.y === 'number' &&
              !isNaN(n.position.x) &&
              !isNaN(n.position.y)) {
            positions[n.id] = {
              x: n.position.x,
              y: n.position.y,
            };
            // Save dimensions for project nodes
            if (n.type === 'project' && n.width && n.height) {
              positions[n.id].width = n.width;
              positions[n.id].height = n.height;
            }
          }
        });
        if (Object.keys(positions).length > 0) {
          savePositions(projectId, positions);
          lastKnownPositionsRef.current = { ...positions };
          if (onPositionsChange) {
            onPositionsChange(positions);
          }
        }
      }, 100); // Small delay to ensure nodes state is updated
    }
  }, [onNodesChange, getNodes, projectId, onPositionsChange]);

  // Removed onNodeDrag - tables with expandParent will auto-resize the group
  
  // Save positions when nodes change
  const onNodeDragStop = useCallback(
    (event, node) => {
      const positions = {};
      const currentNodes = getNodes();
      // Save ALL node positions including children (tables inside groups)
      // Also save dimensions for resizable nodes (like project panel)
      currentNodes.forEach(n => {
        // Only save if position is valid
        if (n.position &&
            typeof n.position.x === 'number' &&
            typeof n.position.y === 'number' &&
            !isNaN(n.position.x) &&
            !isNaN(n.position.y)) {
          positions[n.id] = {
            x: n.position.x,
            y: n.position.y,
          };
          // Save dimensions for project nodes
          if (n.type === 'project' && n.width && n.height) {
            positions[n.id].width = n.width;
            positions[n.id].height = n.height;
          }
        }
      });
      savePositions(projectId, positions);
      // Update the ref to track last known positions
      lastKnownPositionsRef.current = { ...positions }; // Clone to avoid reference issues
      // Notify parent component of position changes
      if (onPositionsChange) {
        onPositionsChange(positions);
      }
      setPresent({ nodes: currentNodes, edges: getEdges() });
    },
    [getNodes, getEdges, projectId, setPresent, onPositionsChange]
  );

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge(params, eds));
      setPresent({ nodes: getNodes(), edges: getEdges() });
    },
    [setEdges, getNodes, getEdges, setPresent]
  );

  const handleExport = useCallback(() => {
    if (viewportRef.current) {
      domToImage.toPng(viewportRef.current, {
        filter: (node) => {
          // we don't want to add the minimap and the controls to the image
          if (
            node?.classList?.contains('react-flow__minimap') ||
            node?.classList?.contains('react-flow__controls')
          ) {
            return false;
          }

          return true;
        },
      }).then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'dbml-diagram.png';
        a.click();
      });
    }
  }, [viewportRef]);

  const handleExportHtml = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    // Generate HTML representation
    const tableNodes = nodes.filter(n => n.type === 'table');
    const groupNodes = nodes.filter(n => n.type === 'group');
    const projectNodes = nodes.filter(n => n.type === 'project');

    // Calculate canvas size based on node positions
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    nodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const width = node.width || 300;
      const height = node.height || 280;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    const canvasWidth = maxX - minX + 100; // Add padding
    const canvasHeight = maxY - minY + 100;
    const offsetX = -minX + 50; // Offset to center content
    const offsetY = -minY + 50;

    // Generate groups HTML
    let groupsHtml = '';
    groupNodes.forEach(node => {
      const x = node.position.x + offsetX;
      const y = node.position.y + offsetY;
      const width = node.width || 500;
      const height = node.height || 400;
      const color = node.data.color || '#667eea';

      groupsHtml += `
        <div class="group-node" style="
          position: absolute;
          left: ${x}px;
          top: ${y}px;
          width: ${width}px;
          height: ${height}px;
          border: 3px solid ${color};
          background-color: ${color}10;
          border-radius: 12px;
          padding: 50px 20px 20px 20px;
          box-sizing: border-box;
        ">
          <div class="group-header" style="background-color: ${color};">
            ${node.data.name}
          </div>
        </div>
      `;
    });

    // Generate project nodes HTML
    let projectsHtml = '';
    projectNodes.forEach(node => {
      const x = node.position.x + offsetX;
      const y = node.position.y + offsetY;
      const width = node.width || 450;
      const height = node.height || 120;

      const nameHtml = node.data.name ? `
        <div class="project-header">
          <strong>${node.data.name}</strong>
          ${node.data.databaseType ? `<span class="project-db-badge">${node.data.databaseType}</span>` : ''}
        </div>
      ` : '';

      const noteHtml = node.data.note ? `
        <div class="project-note">${node.data.note}</div>
      ` : '';

      projectsHtml += `
        <div class="project-panel" style="
          position: absolute;
          left: ${x}px;
          top: ${y}px;
          width: ${width}px;
          height: ${height}px;
        ">
          <div class="project-content">
            ${nameHtml}
            ${noteHtml}
          </div>
        </div>
      `;
    });

    // Generate tables HTML with absolute positioning
    let tablesHtml = '';
    tableNodes.forEach(node => {
      // Calculate absolute position (accounting for parent groups)
      let x = node.position.x;
      let y = node.position.y;

      // If table is inside a group, add the group's position
      if (node.parentNode) {
        const parentGroup = groupNodes.find(g => g.id === node.parentNode);
        if (parentGroup) {
          x += parentGroup.position.x;
          y += parentGroup.position.y;
        }
      }

      x += offsetX;
      y += offsetY;

      const fields = node.data.fields;
      let fieldsHtml = fields.map(field => {
        const badges = [];
        if (field.pk) badges.push('<span class="badge pk">PK</span>');
        if (field.unique) badges.push('<span class="badge unique">U</span>');
        if (field.notNull) badges.push('<span class="badge nn">NN</span>');

        const noteAttr = field.note ? ` title="${field.note.replace(/"/g, '&quot;')}"` : '';
        const noteIcon = field.note ? '<span class="note-icon">📝</span>' : '';

        return `
          <tr${noteAttr}>
            <td class="field-name">${field.name}</td>
            <td class="field-type">${field.type}</td>
            <td class="field-badges">${badges.join(' ')}${noteIcon}</td>
          </tr>
        `;
      }).join('');

      const headerColor = node.data.headerColor || '#667eea';
      const tableNote = node.data.note ? `<div class="table-note">${node.data.note}</div>` : '';
      tablesHtml += `
        <div class="table-card" style="position: absolute; left: ${x}px; top: ${y}px; width: 300px; border-color: ${headerColor};">
          <div class="table-header" style="background: ${headerColor};">
            <div class="table-title">${node.data.name}</div>
            ${tableNote}
          </div>
          <table class="table-body">
            <tbody>
              ${fieldsHtml}
            </tbody>
          </table>
        </div>
      `;
    });

    // Generate SVG for relationship lines with smooth curves
    let svgLines = '';
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        // Calculate absolute positions for source
        let sourceX = sourceNode.position.x;
        let sourceY = sourceNode.position.y;
        if (sourceNode.parentNode) {
          const parentGroup = groupNodes.find(g => g.id === sourceNode.parentNode);
          if (parentGroup) {
            sourceX += parentGroup.position.x;
            sourceY += parentGroup.position.y;
          }
        }

        // Calculate absolute positions for target
        let targetX = targetNode.position.x;
        let targetY = targetNode.position.y;
        if (targetNode.parentNode) {
          const parentGroup = groupNodes.find(g => g.id === targetNode.parentNode);
          if (parentGroup) {
            targetX += parentGroup.position.x;
            targetY += parentGroup.position.y;
          }
        }

        // Add offsets and center points
        sourceX = sourceX + offsetX + (sourceNode.width || 300) / 2;
        sourceY = sourceY + offsetY + (sourceNode.height || 280);
        targetX = targetX + offsetX + (targetNode.width || 300) / 2;
        targetY = targetY + offsetY;

        // Create smooth step path (similar to ReactFlow's smoothstep)
        const midY = (sourceY + targetY) / 2;
        const path = `M ${sourceX},${sourceY}
                      C ${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY}`;

        svgLines += `
          <path
            d="${path}"
            stroke="#667eea"
            stroke-width="2"
            fill="none"
            marker-end="url(#arrowhead)"
          />
        `;
      }
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DBML Schema Export</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
      margin: 0 auto;
      width: fit-content;
    }

    h1 {
      color: #667eea;
      text-align: center;
      margin-bottom: 30px;
      font-size: 32px;
    }

    .diagram-canvas {
      position: relative;
      width: ${canvasWidth}px;
      height: ${canvasHeight}px;
      background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
      border-radius: 8px;
    }

    .connections-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }

    .group-node {
      z-index: 0;
    }

    .group-node .group-header {
      position: absolute;
      top: 12px;
      left: 15px;
      color: white;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      user-select: none;
    }

    .project-panel {
      background: rgba(255, 255, 255, 0.98);
      border: 3px solid #667eea;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      padding: 16px 20px;
      box-sizing: border-box;
      z-index: 50;
      overflow: hidden;
    }

    .project-content {
      color: #333;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .project-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      font-size: 24px;
      font-weight: 700;
      color: #667eea;
      flex-shrink: 0;
      line-height: 1.2;
    }

    .project-db-badge {
      font-size: 16px;
      font-weight: 700;
      padding: 4px 10px;
      background: #667eea;
      color: white;
      border-radius: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .project-note {
      font-size: 18px;
      line-height: 1.5;
      color: #555;
      font-weight: 500;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-y: auto;
      flex: 1;
    }

    .table-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border: 2px solid #667eea;
      z-index: 10;
    }

    .table-header {
      background: #667eea;
      color: white;
      padding: 16px 20px;
      font-weight: 600;
      font-size: 18px;
    }

    .table-title {
      font-weight: 600;
      font-size: 18px;
    }

    .table-note {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 400;
      opacity: 0.9;
      font-style: italic;
      line-height: 1.3;
    }

    .table-body {
      width: 100%;
      border-collapse: collapse;
    }

    .table-body tr {
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.15s;
    }

    .table-body tr:hover {
      background-color: #f8f9fa;
      cursor: help;
    }

    .table-body tr:last-child {
      border-bottom: none;
    }

    .table-body td {
      padding: 12px 20px;
      font-size: 14px;
    }

    .field-name {
      font-weight: 500;
      color: #333;
      font-family: 'Courier New', monospace;
    }

    .field-type {
      color: #666;
      font-family: 'Courier New', monospace;
      font-size: 13px;
    }

    .field-badges {
      text-align: right;
      white-space: nowrap;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 6px;
    }

    .badge.pk {
      background: #ffc107;
      color: #333;
    }

    .badge.unique {
      background: #2196F3;
      color: white;
    }

    .badge.nn {
      background: #f44336;
      color: white;
    }

    .note-icon {
      margin-left: 8px;
      opacity: 0.6;
      font-size: 14px;
    }

    @media print {
      body {
        background: white;
        padding: 20px;
      }

      h1 {
        color: #667eea;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Database Schema</h1>

    <div class="diagram-canvas">
      <svg class="connections-layer" width="${canvasWidth}" height="${canvasHeight}">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#667eea" />
          </marker>
        </defs>
        ${svgLines}
      </svg>
      ${groupsHtml}
      ${projectsHtml}
      ${tablesHtml}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dbml-schema.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [getNodes, getEdges]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setPresent({ nodes: [], edges: [] });
  }, [setNodes, setEdges, setPresent]);

  const handleFitView = useCallback(() => {
    fitView();
  }, [fitView]);

  const handleZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const handleToggleLock = useCallback(() => {
    setIsLocked((prev) => !prev);
  }, []);

  const handleUndo = useCallback(() => {
    const pastState = undo();
    if (pastState) {
      setNodes(pastState.nodes);
      setEdges(pastState.edges);
    }
  }, [undo, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const futureState = redo();
    if (futureState) {
      setNodes(futureState.nodes);
      setEdges(futureState.edges);
    }
  }, [redo, setNodes, setEdges]);

  const handleRestore = useCallback(() => {
    if (parseResult) {
      setNodes(parseResult.nodes);
      setEdges(parseResult.edges);
      setPresent({ nodes: parseResult.nodes, edges: parseResult.edges });
    }
  }, [parseResult, setNodes, setEdges, setPresent]);

  const handleLayout = useCallback((direction) => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      getNodes(),
      getEdges(),
      direction
    );
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [getNodes, getEdges, setNodes, setEdges, getLayoutedElements]);

  const handleChangeTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const handleToggleDirection = useCallback(() => {
    const newDirection = direction === 'TB' ? 'LR' : 'TB';
    setDirection(newDirection);
    handleLayout(newDirection);
  }, [direction, handleLayout]);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }) => {
    if (selectedNodes.length === 1 && selectedNodes[0].type === 'table') {
      setSelectedNode(selectedNodes[0]);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const handleColorChange = useCallback((color) => {
    if (!selectedNode) return;

    // CRITICAL: Save current positions BEFORE triggering any updates
    // This prevents positions from being lost when DBML code changes
    // IMPORTANT: Save ALL nodes including children (tables inside groups)
    const currentNodes = getNodes();
    const positions = {};
    currentNodes.forEach(node => {
      if (node.position &&
          typeof node.position.x === 'number' &&
          typeof node.position.y === 'number' &&
          !isNaN(node.position.x) &&
          !isNaN(node.position.y)) {
        // Save all positions, even child nodes
        positions[node.id] = {
          x: node.position.x,
          y: node.position.y,
        };
        // Save dimensions for project nodes
        if (node.type === 'project' && node.width && node.height) {
          positions[node.id].width = node.width;
          positions[node.id].height = node.height;
        }
      }
    });

    // Save to ref immediately to prevent loss during re-parse
    if (Object.keys(positions).length > 0) {
      lastKnownPositionsRef.current = { ...positions }; // Clone to avoid reference issues

      // Also notify parent component so viewerPositions stays in sync
      // This ensures saving the diagram will save current positions
      if (onPositionsChange) {
        onPositionsChange(positions);
      }
    }

    // Update the DBML code (this will trigger a re-parse that applies both color AND positions)
    // Don't use setNodes here - it interferes with position restoration for child nodes
    if (dbmlCode && onCodeChange) {
      const tableName = selectedNode.data.name;
      const updatedCode = updateTableColorInDBML(dbmlCode, tableName, color);
      onCodeChange(updatedCode);

      // Clear selection to avoid showing stale color in picker
      setSelectedNode(null);
    }
  }, [selectedNode, dbmlCode, setNodes, onCodeChange, getNodes]);

  // Helper function to update table color in DBML code
  const updateTableColorInDBML = (code, tableName, color) => {
    const lines = code.split('\n');
    let updatedLines = [...lines];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is the target table line
      if (trimmed.startsWith(`Table ${tableName}`) || trimmed.startsWith(`table ${tableName}`)) {
        const tableIndent = line.match(/^\s*/)[0];

        // Check if line has table settings in brackets [...]
        const bracketMatch = line.match(/\[([^\]]+)\]/);

        if (bracketMatch) {
          // Table has settings in brackets
          const settingsContent = bracketMatch[1];

          // Check if headerColor already exists
          if (settingsContent.includes('headerColor:')) {
            // Replace existing headerColor - handle commas before or after
            let newSettings = settingsContent
              .replace(/,?\s*headerColor:\s*[#\w]+\s*,?/g, '')  // Remove headerColor and surrounding commas
              .replace(/,\s*,/g, ',')  // Clean up any double commas
              .replace(/,\s*$/g, '')   // Remove trailing comma
              .replace(/^\s*,/g, '')   // Remove leading comma
              .trim();
            const updatedSettings = newSettings ? `${newSettings}, headerColor: ${color}` : `headerColor: ${color}`;
            updatedLines[i] = line.replace(/\[([^\]]+)\]/, `[${updatedSettings}]`);
          } else {
            // Add headerColor to existing settings
            const updatedSettings = `${settingsContent}, headerColor: ${color}`;
            updatedLines[i] = line.replace(/\[([^\]]+)\]/, `[${updatedSettings}]`);
          }
        } else {
          // Table doesn't have settings brackets, add them
          // Find where to insert (before the opening brace)
          const beforeBrace = line.replace(/\s*\{/, ` [headerColor: ${color}] {`);

          if (line.includes('{')) {
            updatedLines[i] = beforeBrace;
          } else {
            // Opening brace is on next line, add brackets to this line
            updatedLines[i] = `${line} [headerColor: ${color}]`;
          }
        }

        break;
      }
    }

    return updatedLines.join('\n');
  };

  return (
    <div className={`dbml-viewer ${theme}`} ref={viewportRef}>
      {nodes.length === 0 && !parseError && (
        <div className="empty-state">
          <div className="empty-content">
            <h2>DBML Studio</h2>
            <p>Start typing DBML code in the editor to see your database schema visualization</p>
            <p className="hint">Or click "Load Example" to get started</p>
          </div>
        </div>
      )}

      {nodes.length === 0 && parseError && (
        <div className="error-state">
          <div className="error-content">
            <h2>Syntax Error</h2>
            <p>Fix the errors in your DBML code to see the visualization</p>
          </div>
        </div>
      )}

      {nodes.length > 0 && (
        <>
          {selectedNode && (
            <div className="color-picker-bar">
              <div className="color-picker-header">
                <span className="color-picker-label">Table: {selectedNode.data.name}</span>
              </div>
              <div className="color-picker-colors">
                <input
                  type="color"
                  value={selectedNode.data.headerColor || '#667eea'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="color-input"
                />
                <div className="preset-colors">
                  {['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'].map(color => (
                    <button
                      key={color}
                      className="preset-color"
                      style={{ background: color }}
                      onClick={() => handleColorChange(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="export-buttons">
            <button onClick={handleExport} className="export-btn">
              Export as PNG
            </button>
            <button onClick={handleExportHtml} className="export-btn">
              Export as HTML
            </button>
            <button onClick={handleUndo} className="export-btn">
              Undo
            </button>
            <button onClick={handleRedo} className="export-btn">
              Redo
            </button>
            <button onClick={handleChangeTheme} className="export-btn">
              Change Theme
            </button>
            <button onClick={handleClear} className="export-btn clear-btn">
              Clear
            </button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            fitView={!initialFitDone.current}
            onInit={() => {
              initialFitDone.current = true;
            }}
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={!isLocked}
            nodesConnectable={!isLocked}
            elementsSelectable={!isLocked}
            zoomOnScroll={!isLocked}
            panOnScroll={!isLocked}
            panOnDrag={!isLocked}
          >
            <Background variant="dots" gap={12} size={1} />
            <Controls />
          </ReactFlow>
        </>
      )}
    </div>
  );
}

export default DBMLViewer;

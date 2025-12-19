import { Parser } from '@dbml/core';

/**
 * Parse DBML code and create ReactFlow nodes and edges
 * @param {string} dbmlCode - The DBML code to parse
 * @returns {object} Object containing nodes, edges, and tableGroups
 */
export function parseDBML(dbmlCode) {
  try {
    if (!dbmlCode || dbmlCode.trim() === '') {
      throw new Error('DBML code is empty');
    }

    // Parse the DBML code using Parser
    let database;
    try {
      const parser = new Parser();
      database = parser.parse(dbmlCode, 'dbml');
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Parse error keys:', Object.keys(parseError));
      console.error('Parse error all keys:', Object.getOwnPropertyNames(parseError));
      console.error('Parse error type:', parseError.constructor.name);
      console.error('Parse error prototype:', Object.getPrototypeOf(parseError));
      console.error('Direct datas access:', parseError.datas);
      console.error('Has datas property:', 'datas' in parseError);

      // Try to stringify to see structure
      try {
        console.error('Error as JSON:', JSON.stringify(parseError, null, 2));
      } catch (e) {
        console.error('Cannot stringify error');
      }

      // Try for...in loop and capture diags (not datas!)
      console.error('Properties via for...in:');
      let datasArray = null;
      for (let key in parseError) {
        console.error(`  ${key}:`, parseError[key]);
        if (key === 'diags' || key === 'datas') {
          datasArray = parseError[key];
          console.error(`Found ${key} via for...in:`, datasArray);
        }
      }

      // Also try bracket notation for both diags and datas
      const diagsBracket = parseError['diags'];
      const datasBracket = parseError['datas'];
      console.error('Diags via bracket notation:', diagsBracket);
      console.error('Datas via bracket notation:', datasBracket);
      if (!datasArray && diagsBracket) {
        datasArray = diagsBracket;
      } else if (!datasArray && datasBracket) {
        datasArray = datasBracket;
      }

      // Check if it's array-like or iterable
      console.error('Is array?', Array.isArray(parseError));
      console.error('Has length?', parseError.length);
      if (parseError.length > 0) {
        console.error('First element (parseError[0]):', parseError[0]);
      }

      // Extract the actual error message
      let errorMessage = parseError.message || 'Invalid DBML syntax';
      let errorLocation = null;

      // Log what we found
      console.error('Captured datasArray:', datasArray);

      // Try to get datas array (keep old code as fallback)
      if (!datasArray) {
        try {
          // Try direct access
          datasArray = parseError.datas;
          console.error('Datas array from direct access:', datasArray);

          // If that doesn't work, try getting it as a property descriptor
          if (!datasArray) {
            const descriptor = Object.getOwnPropertyDescriptor(parseError, 'datas');
            console.error('Datas property descriptor:', descriptor);
            if (descriptor && descriptor.get) {
              datasArray = descriptor.get.call(parseError);
            } else if (descriptor && descriptor.value) {
              datasArray = descriptor.value;
            }
          }
        } catch (e) {
          console.error('Error accessing datas:', e);
        }
      }

      // @dbml/core errors have a 'diags' or 'datas' array with error details
      if (datasArray && Array.isArray(datasArray) && datasArray.length > 0) {
        const firstError = datasArray[0];
        console.error('First error in array:', firstError);
        console.error('First error keys:', Object.keys(firstError));
        console.error('First error location:', firstError.location);

        // Extract location from the first error
        // The error object has location.start.{line, column}
        if (firstError.location && firstError.location.start) {
          errorLocation = {
            line: firstError.location.start.line,
            column: firstError.location.start.column
          };
          errorMessage = firstError.message || errorMessage;
          errorMessage = `Line ${errorLocation.line}, Column ${errorLocation.column}: ${errorMessage}`;
          console.error('✓ Successfully extracted error location:', errorLocation);
        } else if (firstError.start) {
          // Fallback: try direct start property
          errorLocation = {
            line: firstError.start.line,
            column: firstError.start.column
          };
          errorMessage = firstError.message || errorMessage;
          errorMessage = `Line ${errorLocation.line}, Column ${errorLocation.column}: ${errorMessage}`;
          console.error('✓ Successfully extracted error location from start:', errorLocation);
        }
      } else if (parseError.location && parseError.location.start) {
        // Fallback to direct location property
        errorLocation = {
          line: parseError.location.start.line,
          column: parseError.location.start.column
        };
        errorMessage = `Line ${errorLocation.line}, Column ${errorLocation.column}: ${errorMessage}`;
      }

      // Log full error for debugging
      console.error('Extracted error location:', errorLocation);
      console.error('Final error message:', errorMessage);

      // Create error object with location info
      const error = new Error(errorMessage);
      // Use Object.defineProperty to ensure location is preserved
      if (errorLocation) {
        Object.defineProperty(error, 'location', {
          value: errorLocation,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
      console.error('Error object before throw:', error);
      console.error('Error.location before throw:', error.location);
      throw error;
    }

    if (!database) {
      throw new Error('Failed to parse DBML - no database returned');
    }

    const nodes = [];
    const edges = [];

    // Get all tables from the parsed database
    let tables = [];
    if (database.schemas && database.schemas.length > 0 && database.schemas[0].tables) {
      tables = database.schemas[0].tables;
    } else if (database.tables) {
      tables = database.tables;
    }

    // Get table groups
    let tableGroups = [];
    if (database.schemas && database.schemas.length > 0 && database.schemas[0].tableGroups) {
      tableGroups = database.schemas[0].tableGroups;
    } else if (database.tableGroups) {
      tableGroups = database.tableGroups;
    }

    // Create a map of table to group
    const tableToGroup = {};
    tableGroups.forEach(group => {
      if (group.tables) {
        group.tables.forEach(table => {
          tableToGroup[table.name] = {
            name: group.name,
            color: group.headerColor || '#667eea'
          };
        });
      }
    });

    // If no tables, just return empty result (not an error)
    if (tables.length === 0) {
      return { nodes: [], edges: [], tableGroups: [] };
    }

    // Create group nodes first
    let groupIndex = 0;
    const groupColors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    const TABLES_PER_ROW = 2;
    const TABLE_WIDTH = 300;
    const TABLE_HEIGHT = 280;
    const TABLE_SPACING = 30;
    const GROUP_PADDING = 40;
    const GROUP_HEADER_HEIGHT = 60;

    tableGroups.forEach((group, idx) => {
      const groupId = `group-${group.name}`;
      const color = group.headerColor || groupColors[idx % groupColors.length];
      const tablesInGroup = group.tables ? group.tables.map(t => t.name) : [];

      // Calculate group size based on number of tables
      const tableCount = tablesInGroup.length;
      const numCols = Math.min(tableCount, TABLES_PER_ROW);
      const numRows = Math.ceil(tableCount / TABLES_PER_ROW);

      const groupWidth = GROUP_PADDING * 2 + (numCols * TABLE_WIDTH) + ((numCols - 1) * TABLE_SPACING);
      const groupHeight = GROUP_HEADER_HEIGHT + GROUP_PADDING + (numRows * TABLE_HEIGHT) + ((numRows - 1) * TABLE_SPACING) + GROUP_PADDING;

      const groupX = groupIndex * (groupWidth + 100) + 50;
      const groupY = 50;

      nodes.push({
        id: groupId,
        type: 'group',
        position: {
          x: Number(groupX) || 0,
          y: Number(groupY) || 0,
        },
        style: {
          width: groupWidth,
          height: groupHeight,
        },
        data: {
          name: group.name,
          color: color,
        },
        draggable: true,
        selectable: true,
        dragHandle: '.group-header', // Only drag group by its header
        zIndex: 0, // Groups at base layer
        width: groupWidth,
        height: groupHeight,
      });

      groupIndex++;
    });

    // Create nodes for tables
    let ungroupedIndex = 0;
    const groupedTablePositions = {};

    // Initialize position counters for each group
    tableGroups.forEach(group => {
      groupedTablePositions[group.name] = 0;
    });

    tables.forEach((table) => {
      const fields = table.fields.map(field => {
        const fieldType = field.type?.type_name || field.type || 'unknown';
        return {
          name: field.name,
          type: fieldType,
          pk: field.pk || false,
          unique: field.unique || false,
          notNull: field.not_null || false,
          note: field.note || null,
        };
      });

      // Extract headerColor from table (check both the parsed property and manual extraction)
      let extractedHeaderColor = table.headerColor;

      // If not found in parsed table, try to extract from the original DBML code
      if (!extractedHeaderColor && dbmlCode) {
        const regex = new RegExp(`Table\\s+${table.name}\\s*\\[([^\\]]+)\\]`, 'i');
        const tableLineMatch = dbmlCode.match(regex);

        if (tableLineMatch) {
          const settingsContent = tableLineMatch[1];
          const headerColorMatch = settingsContent.match(/headerColor:\s*([#\w]+)/);
          if (headerColorMatch) {
            extractedHeaderColor = headerColorMatch[1];
          }
        }
      }

      const tableGroup = tableToGroup[table.name];
      let position, parentNode;

      if (tableGroup) {
        // Table belongs to a group - position relative to group
        const groupId = `group-${tableGroup.name}`;
        const posIndex = groupedTablePositions[tableGroup.name];
        groupedTablePositions[tableGroup.name]++;

        const col = posIndex % TABLES_PER_ROW;
        const row = Math.floor(posIndex / TABLES_PER_ROW);

        const xPos = GROUP_PADDING + col * (TABLE_WIDTH + TABLE_SPACING);
        const yPos = GROUP_HEADER_HEIGHT + GROUP_PADDING + row * (TABLE_HEIGHT + TABLE_SPACING);

        position = {
          x: Number(xPos) || 0,
          y: Number(yPos) || 0,
        };
        parentNode = groupId;
      } else {
        // Ungrouped table
        const startY = tableGroups.length > 0 ? 800 : 100;
        const xPos = (ungroupedIndex % 3) * 350 + 100;
        const yPos = Math.floor(ungroupedIndex / 3) * 300 + startY;

        position = {
          x: Number(xPos) || 0,
          y: Number(yPos) || 0,
        };
        ungroupedIndex++;
      }

      const tableNode = {
        id: table.name,
        type: 'table',
        position: position, // Already validated above
        data: {
          name: table.name,
          fields: fields,
          headerColor: extractedHeaderColor || (tableGroup ? tableGroup.color : '#667eea'),
          note: table.note || null,
        },
        draggable: true,
        dragHandle: '.table-header', // Only drag from the header
        zIndex: 100, // Tables above groups (0)
        width: TABLE_WIDTH,
        height: TABLE_HEIGHT,
      };

      // Add parent properties if table belongs to a group
      if (parentNode) {
        tableNode.parentNode = parentNode;
        // Don't use extent: 'parent' as it causes NaN position issues
        // Instead use expandParent to auto-resize the group when tables move
        tableNode.expandParent = true;
        tableNode.draggable = true; // Explicitly enable dragging for child nodes
      }

      nodes.push(tableNode);
    });

    // Create edges for relationships
    let refs = [];
    if (database.schemas && database.schemas.length > 0 && database.schemas[0].refs) {
      refs = database.schemas[0].refs;
    } else if (database.refs) {
      refs = database.refs;
    }

    refs.forEach((ref, index) => {
      try {
        const sourceTable = ref.endpoints[0].tableName;
        const targetTable = ref.endpoints[1].tableName;

        if (sourceTable && targetTable) {
          edges.push({
            id: `e${index}-${sourceTable}-${targetTable}`,
            source: sourceTable,
            target: targetTable,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#667eea', strokeWidth: 2 },
            label: ref.name || '',
          });
        }
      } catch (refError) {
        console.warn('Error processing relationship:', refError);
      }
    });

    // Extract project information
    // Project data is at the top level of the database object
    const projectData = database.name ? {
      name: database.name || null,
      databaseType: database.databaseType || null,
      note: database.note || null,
    } : null;

    // Add project as a React Flow node if it exists
    if (projectData) {
      // Calculate position: bottom-left, below all tables
      const maxY = nodes.reduce((max, node) => {
        const nodeY = node.position.y + (node.height || 280);
        return nodeY > max ? nodeY : max;
      }, 0);

      nodes.push({
        id: 'project-info',
        type: 'project',
        position: {
          x: 50,
          y: maxY + 50, // 50px below the last table
        },
        data: projectData,
        draggable: true,
        selectable: true,
        zIndex: 500,
        width: 450,
        height: 120,
        style: {
          width: 450,
          height: 120,
        },
      });
    }

    // Optional debug logging (disabled by default)
    if (false) {
      console.log('=== DBML Parser Debug ===');
      console.log('Total nodes:', nodes.length);
      console.log('Group nodes:', nodes.filter(n => n.type === 'group').length);
      console.log('Table nodes:', nodes.filter(n => n.type === 'table').length);
      console.log('Tables with parent:', nodes.filter(n => n.parentNode).length);
      console.log('Project:', projectData);
    }

    return {
      nodes,
      edges,
      tableGroups: tableGroups.map(group => ({
        name: group.name,
        color: group.headerColor || '#667eea',
        tables: group.tables ? group.tables.map(t => t.name) : []
      })),
      project: projectData
    };
  } catch (error) {
    console.error('DBML parsing error:', error);
    console.error('Re-throwing error with location:', error.location);
    // Re-throw the original error to preserve the location property
    throw error;
  }
}

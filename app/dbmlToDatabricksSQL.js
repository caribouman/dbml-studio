const { Parser } = require('@dbml/core');

/**
 * Map DBML field types to Databricks SQL types
 * @param {string} dbmlType - DBML field type
 * @returns {string} - Databricks SQL type
 */
function mapTypeToDatabricks(dbmlType) {
  const typeMapping = {
    // Integer types
    'int': 'INT',
    'integer': 'INT',
    'smallint': 'SMALLINT',
    'bigint': 'BIGINT',
    'tinyint': 'TINYINT',

    // Decimal types
    'decimal': 'DECIMAL',
    'numeric': 'DECIMAL',
    'float': 'FLOAT',
    'double': 'DOUBLE',
    'real': 'FLOAT',

    // String types
    'varchar': 'STRING',
    'char': 'STRING',
    'text': 'STRING',
    'string': 'STRING',

    // Date/Time types
    'date': 'DATE',
    'datetime': 'TIMESTAMP',
    'timestamp': 'TIMESTAMP',
    'time': 'STRING', // Databricks doesn't have TIME type

    // Boolean
    'boolean': 'BOOLEAN',
    'bool': 'BOOLEAN',

    // Binary
    'binary': 'BINARY',
    'blob': 'BINARY',

    // JSON (stored as STRING in Databricks)
    'json': 'STRING',
    'jsonb': 'STRING',

    // UUID
    'uuid': 'STRING',
  };

  // Extract base type (remove size specifications like varchar(255))
  const baseType = dbmlType.toLowerCase().split('(')[0].trim();

  return typeMapping[baseType] || 'STRING'; // Default to STRING if type unknown
}

/**
 * Generate CREATE TABLE DDL for Databricks from DBML table
 * @param {object} table - Parsed DBML table object
 * @param {object} options - Options (includeIfNotExists, includeComments)
 * @returns {string} - SQL DDL statement
 */
function generateTableDDL(table, options = {}) {
  const { includeIfNotExists = true, includeComments = true } = options;

  let ddl = 'CREATE TABLE ';

  if (includeIfNotExists) {
    ddl += 'IF NOT EXISTS ';
  }

  ddl += `${table.name} (\n`;

  // Add columns
  const columnDefs = table.fields.map(field => {
    const fieldType = field.type?.type_name || field.type || 'STRING';
    const databricksType = mapTypeToDatabricks(fieldType);

    let columnDef = `  ${field.name} ${databricksType}`;

    // Add constraints
    if (field.not_null) {
      columnDef += ' NOT NULL';
    }

    // Add column comment if available
    if (includeComments && field.note) {
      // Escape single quotes in comment
      const escapedNote = field.note.replace(/'/g, "''");
      columnDef += ` COMMENT '${escapedNote}'`;
    }

    return columnDef;
  });

  ddl += columnDefs.join(',\n');

  // Add primary key constraint if any fields are marked as pk
  const pkFields = table.fields.filter(f => f.pk);
  if (pkFields.length > 0) {
    const pkColumns = pkFields.map(f => f.name).join(', ');
    ddl += `,\n  PRIMARY KEY (${pkColumns})`;
  }

  ddl += '\n)';

  // Add table comment if available
  if (includeComments && table.note) {
    const escapedNote = table.note.replace(/'/g, "''");
    ddl += `\nCOMMENT '${escapedNote}'`;
  }

  ddl += ';';

  return ddl;
}

/**
 * Convert DBML code to Databricks SQL DDL statements
 * @param {string} dbmlCode - DBML code
 * @param {object} options - Options for DDL generation
 * @returns {object} - Object containing DDL statements and metadata
 */
function convertDBMLToDatabricksSQL(dbmlCode, options = {}) {
  try {
    // Parse DBML
    const parser = new Parser();
    const database = parser.parse(dbmlCode, 'dbml');

    // Get tables
    let tables = [];
    if (database.schemas && database.schemas.length > 0 && database.schemas[0].tables) {
      tables = database.schemas[0].tables;
    } else if (database.tables) {
      tables = database.tables;
    }

    // Generate DDL for each table
    const tableDDLs = tables.map(table => ({
      tableName: table.name,
      ddl: generateTableDDL(table, options),
      note: table.note || null,
    }));

    // Get relationships for reference
    let refs = [];
    if (database.schemas && database.schemas.length > 0 && database.schemas[0].refs) {
      refs = database.schemas[0].refs;
    } else if (database.refs) {
      refs = database.refs;
    }

    const relationships = refs.map(ref => ({
      sourceTable: ref.endpoints[0].tableName,
      sourceField: ref.endpoints[0].fieldNames[0],
      targetTable: ref.endpoints[1].tableName,
      targetField: ref.endpoints[1].fieldNames[0],
      type: ref.endpoints[0].relation || 'many-to-one',
    }));

    return {
      success: true,
      tables: tableDDLs,
      relationships,
      tableCount: tables.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to convert DBML to SQL',
    };
  }
}

/**
 * Generate a single DDL statement for a specific table from DBML
 * @param {string} dbmlCode - DBML code
 * @param {string} tableName - Name of table to generate DDL for
 * @param {object} options - Options for DDL generation
 * @returns {string|null} - DDL statement or null if table not found
 */
function getTableDDL(dbmlCode, tableName, options = {}) {
  try {
    const parser = new Parser();
    const database = parser.parse(dbmlCode, 'dbml');

    let tables = [];
    if (database.schemas && database.schemas.length > 0 && database.schemas[0].tables) {
      tables = database.schemas[0].tables;
    } else if (database.tables) {
      tables = database.tables;
    }

    const table = tables.find(t => t.name === tableName);

    if (!table) {
      return null;
    }

    return generateTableDDL(table, options);
  } catch (error) {
    throw new Error(`Failed to generate DDL for table ${tableName}: ${error.message}`);
  }
}

module.exports = {
  convertDBMLToDatabricksSQL,
  getTableDDL,
  generateTableDDL,
  mapTypeToDatabricks,
};

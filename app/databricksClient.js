const https = require('https');
const http = require('http');

/**
 * Databricks SQL Warehouse client
 * Uses Databricks REST API to execute SQL statements
 */
class DatabricksClient {
  constructor(workspaceUrl, accessToken, httpPath) {
    this.workspaceUrl = workspaceUrl;
    this.accessToken = accessToken;
    this.httpPath = httpPath;

    // Parse workspace URL to determine protocol
    const url = new URL(workspaceUrl);
    this.protocol = url.protocol === 'https:' ? https : http;
    this.hostname = url.hostname;
  }

  /**
   * Execute SQL statement via Databricks SQL API
   * @param {string} sql - SQL statement to execute
   * @returns {Promise<object>} - API response
   */
  async executeSQL(sql) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        statement: sql,
        warehouse_id: this.httpPath.split('/').pop(), // Extract warehouse ID from http_path
        wait_timeout: '30s'
      });

      const options = {
        hostname: this.hostname,
        path: '/api/2.0/sql/statements',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = this.protocol.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const jsonResponse = JSON.parse(responseData);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonResponse);
            } else {
              reject(new Error(jsonResponse.message || `HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Test connection to Databricks
   * @returns {Promise<boolean>} - True if connection successful
   */
  async testConnection() {
    try {
      await this.executeSQL('SELECT 1');
      return true;
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * List available catalogs
   * @returns {Promise<string[]>} - Array of catalog names
   */
  async listCatalogs() {
    try {
      const result = await this.executeSQL('SHOW CATALOGS');

      if (result.result && result.result.data_array) {
        return result.result.data_array.map(row => row[0]);
      }

      return [];
    } catch (error) {
      throw new Error(`Failed to list catalogs: ${error.message}`);
    }
  }

  /**
   * List schemas in a catalog
   * @param {string} catalog - Catalog name
   * @returns {Promise<string[]>} - Array of schema names
   */
  async listSchemas(catalog) {
    try {
      const result = await this.executeSQL(`SHOW SCHEMAS IN ${catalog}`);

      if (result.result && result.result.data_array) {
        return result.result.data_array.map(row => row[0]);
      }

      return [];
    } catch (error) {
      throw new Error(`Failed to list schemas: ${error.message}`);
    }
  }

  /**
   * List tables in a schema
   * @param {string} catalog - Catalog name
   * @param {string} schema - Schema name
   * @returns {Promise<string[]>} - Array of table names
   */
  async listTables(catalog, schema) {
    // Try multiple methods to list tables, as permissions may vary

    // Method 1: Try SHOW TABLES (standard approach)
    try {
      const sql = `SHOW TABLES IN ${catalog}.${schema}`;
      console.log('Method 1 - Executing SQL:', sql);

      const result = await this.executeSQL(sql);

      if (result.result && result.result.data_array && result.result.data_array.length > 0) {
        const tables = result.result.data_array.map(row => row[1] || row[0]).filter(Boolean);
        console.log('Method 1 succeeded:', tables);
        return tables;
      }

      console.log('Method 1 returned 0 tables, trying alternative methods...');
    } catch (error) {
      console.log('Method 1 failed:', error.message);
    }

    // Method 2: Try information_schema (works better with Unity Catalog permissions)
    try {
      const sql = `SELECT table_name FROM ${catalog}.information_schema.tables WHERE table_schema = '${schema}'`;
      console.log('Method 2 - Executing SQL:', sql);

      const result = await this.executeSQL(sql);

      if (result.result && result.result.data_array && result.result.data_array.length > 0) {
        const tables = result.result.data_array.map(row => row[0]).filter(Boolean);
        console.log('Method 2 succeeded:', tables);
        return tables;
      }

      console.log('Method 2 returned 0 tables');
    } catch (error) {
      console.log('Method 2 failed:', error.message);
    }

    // Method 3: Try system.information_schema (global view)
    try {
      const sql = `SELECT table_name FROM system.information_schema.tables WHERE table_catalog = '${catalog}' AND table_schema = '${schema}'`;
      console.log('Method 3 - Executing SQL:', sql);

      const result = await this.executeSQL(sql);

      if (result.result && result.result.data_array && result.result.data_array.length > 0) {
        const tables = result.result.data_array.map(row => row[0]).filter(Boolean);
        console.log('Method 3 succeeded:', tables);
        return tables;
      }

      console.log('Method 3 returned 0 tables');
    } catch (error) {
      console.log('Method 3 failed:', error.message);
    }

    console.log('All methods failed or returned 0 tables');
    return [];
  }

  /**
   * Create a table in Databricks
   * @param {string} catalog - Catalog name
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {string} ddl - CREATE TABLE DDL statement
   * @returns {Promise<object>} - API response
   */
  async createTable(catalog, schema, tableName, ddl) {
    try {
      // Use fully qualified table name if catalog and schema provided
      const fullTableName = catalog && schema
        ? `${catalog}.${schema}.${tableName}`
        : tableName;

      // Replace table name in DDL with fully qualified name
      const qualifiedDDL = ddl.replace(
        new RegExp(`CREATE TABLE (IF NOT EXISTS )?${tableName}`, 'i'),
        `CREATE TABLE $1${fullTableName}`
      );

      console.log('Creating table:', fullTableName);
      console.log('DDL:', qualifiedDDL.substring(0, 200) + '...');

      const result = await this.executeSQL(qualifiedDDL);

      console.log('Table created successfully:', fullTableName);
      return result;
    } catch (error) {
      console.log('Failed to create table:', fullTableName);
      console.log('Error:', error.message);
      throw new Error(`Failed to create table ${tableName}: ${error.message}`);
    }
  }

  /**
   * Check if a table exists
   * @param {string} catalog - Catalog name
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @returns {Promise<boolean>} - True if table exists
   */
  async tableExists(catalog, schema, tableName) {
    try {
      const fullTableName = catalog && schema
        ? `${catalog}.${schema}.${tableName}`
        : tableName;

      const sql = `DESCRIBE TABLE ${fullTableName}`;
      console.log('Checking if table exists:', sql);

      const result = await this.executeSQL(sql);

      // Check if the query actually succeeded
      if (result.status && result.status.state === 'SUCCEEDED') {
        console.log('DESCRIBE TABLE succeeded - table exists:', fullTableName);
        return true;
      } else if (result.status && result.status.state === 'FAILED') {
        console.log('DESCRIBE TABLE failed - table does NOT exist:', tableName);
        if (result.status.error) {
          console.log('Error:', result.status.error.message);
        }
        return false;
      }

      // If status is unclear, assume table doesn't exist
      console.log('DESCRIBE TABLE status unclear - assuming table does NOT exist');
      return false;
    } catch (error) {
      console.log('DESCRIBE TABLE exception - table does NOT exist:', tableName);
      console.log('Error:', error.message);
      return false;
    }
  }
}

module.exports = DatabricksClient;

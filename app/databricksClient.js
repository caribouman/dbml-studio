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

  /**
   * List workspace directory contents
   * @param {string} path - Workspace path (e.g., '/Users/user@example.com')
   * @returns {Promise<Array>} - Array of workspace objects
   */
  async listWorkspace(path) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ path });

      const options = {
        hostname: this.hostname,
        path: '/api/2.0/workspace/list',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      // Add query parameter for path
      options.path += `?path=${encodeURIComponent(path)}`;

      const req = this.protocol.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const jsonResponse = JSON.parse(responseData);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonResponse.objects || []);
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

      req.end();
    });
  }

  /**
   * Upload file to Databricks workspace
   * @param {string} path - Target workspace path (e.g., '/Users/user@example.com/schema.dbml')
   * @param {string} content - File content (base64 encoded)
   * @param {boolean} overwrite - Whether to overwrite existing file
   * @returns {Promise<object>} - API response
   */
  async uploadToWorkspace(path, content, overwrite = true) {
    return new Promise((resolve, reject) => {
      // Wrap JSON content in a Python notebook format so Databricks can handle it
      // This allows the file to be stored in the workspace as a readable source file
      const timestamp = new Date().toISOString();
      const wrappedContent = `# Databricks notebook source
# MAGIC %md
# MAGIC # DBML Studio Diagram
# MAGIC
# MAGIC This file contains a DBML diagram with table positions.
# MAGIC The JSON data is stored in the cell below.
# MAGIC
# MAGIC **Last updated:** ${timestamp}

# COMMAND ----------

diagram_json = """
${content}
"""

# COMMAND ----------

# To load this diagram in DBML Studio:
# 1. Click "Load from Databricks"
# 2. Select this file
# 3. The JSON will be extracted and loaded automatically
#
# Last modified: ${timestamp}
`;

      // Encode content to base64
      const base64Content = Buffer.from(wrappedContent).toString('base64');

      // Build request data with SOURCE format for Python notebook
      const requestData = {
        path,
        content: base64Content,
        language: 'PYTHON',
        format: 'SOURCE'
      };

      // Only add overwrite if needed
      if (overwrite) {
        requestData.overwrite = true;
      }

      console.log('[DatabricksClient] Upload request:', JSON.stringify({
        path,
        overwrite,
        hasOverwriteInRequest: 'overwrite' in requestData,
        requestDataKeys: Object.keys(requestData),
        fullRequest: {
          path: requestData.path,
          language: requestData.language,
          format: requestData.format,
          overwrite: requestData.overwrite
        }
      }, null, 2));

      const data = JSON.stringify(requestData);

      const options = {
        hostname: this.hostname,
        path: '/api/2.0/workspace/import',
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
          console.log('[DatabricksClient] Response status:', res.statusCode);
          console.log('[DatabricksClient] Response data:', responseData);

          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              // Success response is often empty for this endpoint
              console.log('[DatabricksClient] Upload successful');
              resolve({ success: true, path });
            } else {
              const jsonResponse = responseData ? JSON.parse(responseData) : {};
              console.error('[DatabricksClient] Upload failed:', jsonResponse);
              reject(new Error(jsonResponse.message || `HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('[DatabricksClient] Upload successful (parse error but status OK)');
              resolve({ success: true, path });
            } else {
              console.error('[DatabricksClient] Failed to parse error response:', error);
              reject(new Error(`Failed to parse response: ${error.message}`));
            }
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
   * Download file from Databricks workspace
   * @param {string} path - Workspace path to download (e.g., '/Users/user@example.com/schema.dbml')
   * @returns {Promise<string>} - File content as text
   */
  async downloadFromWorkspace(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        path: `/api/2.0/workspace/export?path=${encodeURIComponent(path)}&format=SOURCE`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
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
              // Content is base64 encoded
              if (jsonResponse.content) {
                let content = Buffer.from(jsonResponse.content, 'base64').toString('utf-8');

                // Extract JSON from Python notebook wrapper if present
                const jsonMatch = content.match(/diagram_json\s*=\s*"""([\s\S]*?)"""/);
                if (jsonMatch && jsonMatch[1]) {
                  // Found wrapped JSON, extract it
                  content = jsonMatch[1].trim();
                }

                resolve(content);
              } else {
                reject(new Error('No content in response'));
              }
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

      req.end();
    });
  }
}

module.exports = DatabricksClient;

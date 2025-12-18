import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { parseDBML } from '../utils/dbmlParser';
import WorkspaceExplorer from './WorkspaceExplorer';
import '../styles/modal.css';
import './DatabricksDeployDialog.css';

/**
 * Dialog for deploying tables to Databricks
 */
function DatabricksDeployDialog({ isOpen, onClose, dbmlCode, positions }) {
  const [catalogs, setCatalogs] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [tables, setTables] = useState([]);
  const [existingTables, setExistingTables] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [selectedTables, setSelectedTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState(null);
  const [deployResult, setDeployResult] = useState(null);
  const [hasConnection, setHasConnection] = useState(false);

  // New states for table renaming
  const [tableRenames, setTableRenames] = useState({});
  const [globalPrefix, setGlobalPrefix] = useState('');
  const [globalSuffix, setGlobalSuffix] = useState('');
  const [sectionsExpanded, setSectionsExpanded] = useState({
    location: true,
    existing: false,
    tables: true,
    naming: false,
    preview: false,
    workspace: false
  });

  // Workspace upload states
  const [showWorkspaceExplorer, setShowWorkspaceExplorer] = useState(false);
  const [workspaceExplorerMode, setWorkspaceExplorerMode] = useState('create'); // 'create' or 'select'
  const [workspacePath, setWorkspacePath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Load connection and catalogs on mount
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  // Parse DBML to get table list
  useEffect(() => {
    if (dbmlCode) {
      try {
        const parsed = parseDBML(dbmlCode);
        const tableNodes = parsed.nodes.filter(node => node.type === 'table');
        setTables(tableNodes.map(node => node.data.name));
      } catch (err) {
        setTables([]);
      }
    }
  }, [dbmlCode]);

  // Load schemas when catalog changes
  useEffect(() => {
    if (selectedCatalog) {
      loadSchemas(selectedCatalog);
    }
  }, [selectedCatalog]);

  // Load tables when schema changes
  useEffect(() => {
    if (selectedCatalog && selectedSchema) {
      loadTables(selectedCatalog, selectedSchema);
    } else {
      setExistingTables([]);
    }
  }, [selectedCatalog, selectedSchema]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if connection exists
      const connResponse = await apiRequest('/api/databricks/connection');
      if (!connResponse.connection) {
        setHasConnection(false);
        setError('No Databricks connection configured. Please configure a connection first.');
        return;
      }

      setHasConnection(true);

      // Set defaults from connection
      if (connResponse.connection.default_catalog) {
        setSelectedCatalog(connResponse.connection.default_catalog);
      }
      if (connResponse.connection.default_schema) {
        setSelectedSchema(connResponse.connection.default_schema);
      }

      // Load catalogs
      const catalogsResponse = await apiRequest('/api/databricks/catalogs');
      setCatalogs(catalogsResponse.catalogs || []);

    } catch (err) {
      setError(err.message || 'Failed to load Databricks data');
      setHasConnection(false);
    } finally {
      setLoading(false);
    }
  };

  const loadSchemas = async (catalog) => {
    setLoadingSchemas(true);
    setError(null);

    try {
      const response = await apiRequest(`/api/databricks/schemas/${catalog}`);
      setSchemas(response.schemas || []);
    } catch (err) {
      setError(err.message || 'Failed to load schemas');
      setSchemas([]);
    } finally {
      setLoadingSchemas(false);
    }
  };

  const loadTables = async (catalog, schema) => {
    setLoadingTables(true);
    setError(null);

    try {
      const response = await apiRequest(`/api/databricks/tables/${catalog}/${schema}`);
      setExistingTables(response.tables || []);
    } catch (err) {
      setError(err.message || 'Failed to load tables');
      setExistingTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  // Calculate final table name with prefix/suffix and custom rename
  const getFinalTableName = (tableName) => {
    const customName = tableRenames[tableName] || tableName;
    return `${globalPrefix}${customName}${globalSuffix}`;
  };

  // Handle individual table rename
  const handleTableRename = (tableName, newName) => {
    setTableRenames(prev => ({
      ...prev,
      [tableName]: newName
    }));
  };

  // Toggle section expanded/collapsed
  const toggleSection = (section) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleTableToggle = (tableName) => {
    setSelectedTables(prev => {
      if (prev.includes(tableName)) {
        return prev.filter(t => t !== tableName);
      } else {
        return [...prev, tableName];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables([...tables]);
    }
  };

  const handleDeploy = async () => {
    if (!selectedCatalog || !selectedSchema) {
      setError('Please select a catalog and schema');
      return;
    }

    if (selectedTables.length === 0) {
      setError('Please select at least one table to deploy');
      return;
    }

    setDeploying(true);
    setError(null);
    setDeployResult(null);

    try {
      // Build table mappings (source -> destination)
      const tableMappings = {};
      selectedTables.forEach(tableName => {
        tableMappings[tableName] = getFinalTableName(tableName);
      });

      const response = await apiRequest('/api/databricks/deploy', {
        method: 'POST',
        body: JSON.stringify({
          dbml_code: dbmlCode,
          table_mappings: tableMappings,
          catalog: selectedCatalog,
          schema: selectedSchema
        })
      });

      setDeployResult(response);

      // Refresh the existing tables list to show newly created tables
      if (selectedCatalog && selectedSchema) {
        loadTables(selectedCatalog, selectedSchema);
      }

      // Don't auto-close - let user review results and close manually

    } catch (err) {
      setError(err.message || 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleWorkspaceUpload = async () => {
    if (!workspacePath) {
      setError('Please select a workspace location');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      // Create a JSON object with both DBML code and positions
      const diagramData = {
        dbml_code: dbmlCode,
        positions: positions || {},
        updated_at: new Date().toISOString()
      };

      // Use overwrite: true only when updating an existing file (select mode)
      // For new files (create mode), use overwrite: false or omit it
      const isUpdating = workspaceExplorerMode === 'select';

      console.log('[DatabricksDeployDialog] Uploading to workspace:', {
        path: workspacePath,
        mode: workspaceExplorerMode,
        isUpdating,
        overwrite: isUpdating
      });

      const response = await apiRequest('/api/databricks/workspace/upload', {
        method: 'POST',
        body: JSON.stringify({
          path: workspacePath,
          content: JSON.stringify(diagramData, null, 2), // Pretty print JSON
          overwrite: isUpdating
        })
      });

      setUploadResult({
        success: true,
        message: `Diagram file ${isUpdating ? 'updated' : 'created'} successfully at ${workspacePath}`,
        path: response.path
      });
    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploadResult({ success: false, message: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSelectWorkspacePath = async (path) => {
    setWorkspacePath(path);
    setUploadResult(null);
    setError(null);

    // If we're in select mode, download the file content
    if (workspaceExplorerMode === 'select') {
      setUploading(true);
      try {
        const response = await apiRequest(`/api/databricks/workspace/download?path=${encodeURIComponent(path)}`);

        // Show success message
        setUploadResult({
          success: true,
          message: `File loaded from ${path}. You can now update it by clicking "Upload to Workspace".`,
          path: response.path
        });
      } catch (err) {
        setError(err.message || 'Failed to download file');
        setUploadResult({
          success: false,
          message: err.message
        });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleBrowseForNewFile = () => {
    setWorkspaceExplorerMode('create');
    setShowWorkspaceExplorer(true);
  };

  const handleBrowseForExistingFile = () => {
    setWorkspaceExplorerMode('select');
    setShowWorkspaceExplorer(true);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content databricks-deploy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deploy to Databricks</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {!hasConnection ? (
          <div className="no-connection-message">
            <p>No Databricks connection configured.</p>
            <p>Please configure a connection in Settings before deploying.</p>
          </div>
        ) : (
          <div className="deploy-form">
            {/* Target Location Section */}
            <div className="form-section">
              <div
                className="section-header collapsible"
                onClick={() => toggleSection('location')}
              >
                <div className="section-title">
                  <span className="section-icon">📁</span>
                  <h3>Target Location</h3>
                </div>
                <button className="collapse-btn" type="button" onClick={(e) => e.stopPropagation()}>
                  {sectionsExpanded.location ? '▼' : '▶'}
                </button>
              </div>

              {sectionsExpanded.location && (
                <div className="section-content">
                  <div className="form-group">
                    <label htmlFor="catalog">
                      <span className="label-icon">🗂️</span>
                      Catalog
                    </label>
                    <select
                      id="catalog"
                      value={selectedCatalog}
                      onChange={(e) => setSelectedCatalog(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select catalog...</option>
                      {catalogs.map(catalog => (
                        <option key={catalog} value={catalog}>{catalog}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="schema">
                      <span className="label-icon">📂</span>
                      Schema
                    </label>
                    <select
                      id="schema"
                      value={selectedSchema}
                      onChange={(e) => setSelectedSchema(e.target.value)}
                      disabled={!selectedCatalog || loadingSchemas}
                    >
                      <option value="">Select schema...</option>
                      {schemas.map(schema => (
                        <option key={schema} value={schema}>{schema}</option>
                      ))}
                    </select>
                  </div>

                  {selectedCatalog && selectedSchema && (
                    <div className="location-preview">
                      <strong>Full path:</strong> {selectedCatalog}.{selectedSchema}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Existing Tables Section */}
            {selectedCatalog && selectedSchema && (
              <div className="form-section">
                <div
                  className="section-header collapsible"
                  onClick={() => toggleSection('existing')}
                >
                  <div className="section-title">
                    <span className="section-icon">📋</span>
                    <h3>Existing Tables in Schema</h3>
                    <span className="badge">
                      {loadingTables ? 'Loading...' : `${existingTables.length} table(s)`}
                    </span>
                  </div>
                  <button className="collapse-btn" type="button" onClick={(e) => e.stopPropagation()}>
                    {sectionsExpanded.existing ? '▼' : '▶'}
                  </button>
                </div>

                {sectionsExpanded.existing && (
                  <div className="section-content">
                    {loadingTables ? (
                      <p className="loading-message">Loading tables...</p>
                    ) : existingTables.length === 0 ? (
                      <p className="no-tables">No tables found in this schema</p>
                    ) : (
                      <div className="existing-tables-list">
                        {existingTables.map(tableName => (
                          <div key={tableName} className="existing-table-item">
                            <span className="table-icon">📄</span>
                            <span className="existing-table-name">{tableName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Naming Options Section */}
            <div className="form-section">
              <div
                className="section-header collapsible"
                onClick={() => toggleSection('naming')}
              >
                <div className="section-title">
                  <span className="section-icon">✏️</span>
                  <h3>Naming Options</h3>
                  <span className="badge">{globalPrefix || globalSuffix ? 'Active' : 'None'}</span>
                </div>
                <button className="collapse-btn" type="button" onClick={(e) => e.stopPropagation()}>
                  {sectionsExpanded.naming ? '▼' : '▶'}
                </button>
              </div>

              {sectionsExpanded.naming && (
                <div className="section-content">
                  <div className="naming-global">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="prefix">
                          <span className="label-icon">➕</span>
                          Table Prefix
                        </label>
                        <input
                          type="text"
                          id="prefix"
                          value={globalPrefix}
                          onChange={(e) => setGlobalPrefix(e.target.value)}
                          placeholder="e.g., stg_"
                        />
                        <small>Add a prefix to all table names</small>
                      </div>

                      <div className="form-group">
                        <label htmlFor="suffix">
                          <span className="label-icon">➕</span>
                          Table Suffix
                        </label>
                        <input
                          type="text"
                          id="suffix"
                          value={globalSuffix}
                          onChange={(e) => setGlobalSuffix(e.target.value)}
                          placeholder="e.g., _prod"
                        />
                        <small>Add a suffix to all table names</small>
                      </div>
                    </div>

                    {(globalPrefix || globalSuffix) && tables.length > 0 && (
                      <div className="naming-example">
                        <strong>Example:</strong> {tables[0]} → {getFinalTableName(tables[0])}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Workspace Upload Section */}
            <div className="form-section">
              <div
                className="section-header collapsible"
                onClick={() => toggleSection('workspace')}
              >
                <div className="section-title">
                  <span className="section-icon">☁️</span>
                  <h3>Save Diagram to Workspace</h3>
                  {uploadResult && (
                    <span className={`badge ${uploadResult.success ? 'success' : 'error'}`}>
                      {uploadResult.success ? 'Uploaded' : 'Failed'}
                    </span>
                  )}
                </div>
                <button className="collapse-btn" type="button" onClick={(e) => e.stopPropagation()}>
                  {sectionsExpanded.workspace ? '▼' : '▶'}
                </button>
              </div>

              {sectionsExpanded.workspace && (
                <div className="section-content">
                  <p className="section-description">
                    Save the diagram (DBML code + table positions) to your Databricks workspace as a Python notebook.
                  </p>

                  <div className="workspace-path-selector">
                    <label>
                      <span className="label-icon">📍</span>
                      Workspace Path:
                    </label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={workspacePath}
                        onChange={(e) => setWorkspacePath(e.target.value)}
                        placeholder="/Users/your.email@company.com/dbml_diagram.py"
                        readOnly
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleBrowseForNewFile}
                        title="Create a new file"
                      >
                        New...
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleBrowseForExistingFile}
                        title="Select an existing file to update"
                      >
                        Select Existing...
                      </button>
                    </div>
                    <small>Create a new file or select an existing diagram file to update in your Databricks workspace</small>
                  </div>

                  {uploadResult && (
                    <div className={`upload-result ${uploadResult.success ? 'success' : 'error'}`}>
                      {uploadResult.message}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleWorkspaceUpload}
                    disabled={uploading || !workspacePath}
                  >
                    {uploading ? 'Uploading...' : 'Upload to Workspace'}
                  </button>
                </div>
              )}
            </div>

            {/* Tables Section */}
            <div className="form-section">
              <div
                className="section-header collapsible"
                onClick={() => toggleSection('tables')}
              >
                <div className="section-title">
                  <span className="section-icon">📊</span>
                  <h3>Tables to Deploy</h3>
                  <span className="badge">{selectedTables.length}/{tables.length}</span>
                </div>
                <div className="section-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={handleSelectAll}
                    disabled={tables.length === 0}
                  >
                    {selectedTables.length === tables.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button className="collapse-btn" type="button" onClick={(e) => {
                    e.stopPropagation();
                    toggleSection('tables');
                  }}>
                    {sectionsExpanded.tables ? '▼' : '▶'}
                  </button>
                </div>
              </div>

              {sectionsExpanded.tables && (
                <div className="table-list-container">
                  {tables.length === 0 ? (
                    <p className="no-tables">No tables found in DBML</p>
                  ) : (
                    <div className="table-list">
                      {tables.map(tableName => {
                        const isSelected = selectedTables.includes(tableName);
                        return (
                          <div
                            key={tableName}
                            className={`table-item ${isSelected ? 'selected' : ''}`}
                          >
                            <label className="table-checkbox">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleTableToggle(tableName)}
                              />
                              <span className="table-source-name">{tableName}</span>
                            </label>

                            {isSelected && (
                              <div className="table-rename">
                                <span className="rename-arrow">→</span>
                                <input
                                  type="text"
                                  className="rename-input"
                                  value={tableRenames[tableName] || ''}
                                  onChange={(e) => handleTableRename(tableName, e.target.value)}
                                  placeholder={tableName}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="final-name-preview">
                                  {getFinalTableName(tableName)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Deployment Preview Section */}
            {selectedTables.length > 0 && (
              <div className="form-section">
                <div
                  className="section-header collapsible"
                  onClick={() => toggleSection('preview')}
                >
                  <div className="section-title">
                    <span className="section-icon">👁️</span>
                    <h3>Deployment Preview</h3>
                    <span className="badge">{selectedTables.length} table(s)</span>
                  </div>
                  <button className="collapse-btn" type="button" onClick={(e) => e.stopPropagation()}>
                    {sectionsExpanded.preview ? '▼' : '▶'}
                  </button>
                </div>

                {sectionsExpanded.preview && (
                  <div className="mapping-preview">
                    <div className="preview-header">
                      <span>Source (DBML)</span>
                      <span></span>
                      <span>Destination (Databricks)</span>
                    </div>
                    {selectedTables.map(tableName => (
                      <div key={tableName} className="mapping-row">
                        <span className="source-name">{tableName}</span>
                        <span className="arrow">→</span>
                        <span className="dest-name">
                          {selectedCatalog}.{selectedSchema}.{getFinalTableName(tableName)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {deployResult && (
              <div className="deploy-result">
                <h4>Deployment Results</h4>

                <div className="result-summary">
                  <div className="summary-item">
                    <span className="label">Total:</span>
                    <span className="value">{deployResult.summary?.total || 0}</span>
                  </div>
                  <div className="summary-item success">
                    <span className="label">Created:</span>
                    <span className="value">{deployResult.summary?.created || 0}</span>
                  </div>
                  <div className="summary-item warning">
                    <span className="label">Skipped:</span>
                    <span className="value">{deployResult.summary?.skipped || 0}</span>
                  </div>
                  {deployResult.summary?.failed > 0 && (
                    <div className="summary-item error">
                      <span className="label">Failed:</span>
                      <span className="value">{deployResult.summary.failed}</span>
                    </div>
                  )}
                </div>

                {deployResult.results && deployResult.results.length > 0 && (
                  <div className="result-details">
                    {deployResult.results.map((result, idx) => (
                      <div key={idx} className={`result-item ${result.status}`}>
                        <strong>{result.table}</strong>: {result.message}
                      </div>
                    ))}
                  </div>
                )}

                {deployResult.errors && deployResult.errors.length > 0 && (
                  <div className="result-errors">
                    {deployResult.errors.map((error, idx) => (
                      <div key={idx} className="error-item">
                        <strong>{error.table}</strong>: {error.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={deploying}
              >
                {deployResult ? 'Close' : 'Cancel'}
              </button>

              {!deployResult && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDeploy}
                  disabled={deploying || !selectedCatalog || !selectedSchema || selectedTables.length === 0}
                >
                  {deploying ? 'Deploying...' : `Deploy ${selectedTables.length} Table${selectedTables.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Workspace Explorer Modal */}
        <WorkspaceExplorer
          isOpen={showWorkspaceExplorer}
          onClose={() => setShowWorkspaceExplorer(false)}
          onSelectPath={handleSelectWorkspacePath}
          currentPath="/Workspace"
          mode={workspaceExplorerMode}
        />
      </div>
    </div>
  );
}

export default DatabricksDeployDialog;

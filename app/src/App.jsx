import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import DBMLViewer from './components/DBMLViewer';
import DBMLEditor from './components/DBMLEditor';
import AuthModal from './components/AuthModal';
import Library from './components/Library';
import SaveDiagramDialog from './components/SaveDiagramDialog';
import UserMenu from './components/UserMenu';
import DatabricksConnection from './components/DatabricksConnection';
import DatabricksDeployDialog from './components/DatabricksDeployDialog';
import { useAuthStore } from './stores/authStore';
import './App.css';

function App() {
  const { user, isAuthenticated, isLoading, isElectron, initialize } = useAuthStore();

  // Load saved DBML from localStorage on mount
  const [dbmlCode, setDbmlCode] = useState(() => {
    try {
      const savedCode = localStorage.getItem('dbml-studio-code');
      return savedCode || '';
    } catch (err) {
      console.warn('Failed to load from localStorage:', err);
      return '';
    }
  });

  const [parseResult, setParseResult] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [showEditor, setShowEditor] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDatabricksConnection, setShowDatabricksConnection] = useState(false);
  const [showDatabricksDeploy, setShowDatabricksDeploy] = useState(false);
  const [currentDiagram, setCurrentDiagram] = useState(null);
  const [viewerPositions, setViewerPositions] = useState(null);

  // Check if any modal is open
  const isAnyModalOpen = showAuthModal || showLibrary || showSaveDialog || showDatabricksConnection || showDatabricksDeploy;

  // Handle OAuth callback and initialize auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    const token = params.get('token');

    if (authStatus === 'success' && token) {
      // Store token in localStorage
      localStorage.setItem('auth-token', token);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'failed') {
      alert('Authentication failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Initialize auth after handling OAuth callback
    initialize();
  }, []);

  const handleCodeChange = useCallback((code) => {
    setDbmlCode(code);
  }, []);

  const handleParse = useCallback((result, error) => {
    setParseResult(result);
    setParseError(error);
  }, []);

  const toggleEditor = useCallback(() => {
    setShowEditor(prev => !prev);
  }, []);

  const handleLoadDiagram = useCallback((diagram) => {
    setDbmlCode(diagram.dbml_code);
    setViewerPositions(diagram.positions);
    setCurrentDiagram(diagram);
  }, []);

  const handleOpenSaveDialog = useCallback(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setShowSaveDialog(true);
  }, [isAuthenticated]);

  const handleSaveDialogClose = useCallback((success) => {
    setShowSaveDialog(false);
    if (success) {
      alert('Diagram saved successfully!');
    }
  }, []);

  const handleOpenDatabricksDeploy = useCallback(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (!dbmlCode || dbmlCode.trim() === '') {
      alert('Please enter some DBML code first');
      return;
    }
    setShowDatabricksDeploy(true);
  }, [isAuthenticated, dbmlCode]);

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">DBML Studio</h1>
        <div className="app-header-actions">
          {isAuthenticated && (
            <>
              <button
                className="btn btn-databricks"
                onClick={handleOpenDatabricksDeploy}
                title="Deploy tables to Databricks"
              >
                Deploy to Databricks
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDatabricksConnection(true)}
                title="Configure Databricks connection"
              >
                Databricks Settings
              </button>
            </>
          )}
          {isAuthenticated ? (
            <UserMenu
              onOpenLibrary={() => setShowLibrary(true)}
              onSaveDiagram={handleOpenSaveDialog}
            />
          ) : (
            !isLoading && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAuthModal(true)}
              >
                Sign In
              </button>
            )
          )}
        </div>
      </div>

      <div className={`split-panel ${!showEditor ? 'fullscreen' : ''}`}>
        {showEditor && (
          <>
            <div className="panel panel-left">
              <DBMLEditor
                value={dbmlCode}
                onChange={handleCodeChange}
                onParse={handleParse}
              />
            </div>
            <div className="panel-divider"></div>
          </>
        )}
        <div className="panel panel-right">
          {!isAnyModalOpen && (
            <button
              className="toggle-editor-btn"
              onClick={toggleEditor}
              title={showEditor ? 'Hide Editor (Full Screen)' : 'Show Editor'}
            >
              {showEditor ? '◀' : '▶'}
            </button>
          )}
          <ReactFlowProvider>
            <DBMLViewer
              dbmlCode={dbmlCode}
              parseResult={parseResult}
              parseError={parseError}
              loadedPositions={viewerPositions}
              onPositionsChange={setViewerPositions}
              onCodeChange={handleCodeChange}
            />
          </ReactFlowProvider>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <Library
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        onLoadDiagram={handleLoadDiagram}
      />

      <SaveDiagramDialog
        isOpen={showSaveDialog}
        onClose={handleSaveDialogClose}
        dbmlCode={dbmlCode}
        positions={viewerPositions}
        currentDiagram={currentDiagram}
      />

      <DatabricksConnection
        isOpen={showDatabricksConnection}
        onClose={() => setShowDatabricksConnection(false)}
        onConnectionSaved={() => {
          alert('Databricks connection saved successfully!');
        }}
      />

      <DatabricksDeployDialog
        isOpen={showDatabricksDeploy}
        onClose={() => setShowDatabricksDeploy(false)}
        dbmlCode={dbmlCode}
      />
    </div>
  );
}

export default App;

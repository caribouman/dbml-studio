import React, { useCallback, useEffect, useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import { parseDBML } from '../utils/dbmlParser';
import './DBMLEditor.css';

const EXAMPLE_DBML = `Table users {
  id integer [primary key, note: 'Unique identifier for each user']
  username varchar [note: 'User display name, must be unique']
  email varchar [unique, note: 'User email address for authentication']
  created_at timestamp [note: 'Account creation timestamp']
}

Table posts {
  id integer [primary key, note: 'Unique identifier for each post']
  title varchar [note: 'Post title, max 255 characters']
  content text [note: 'Main post content body']
  author_id integer [note: 'Foreign key to users table']
  created_at timestamp [note: 'Post creation timestamp']
}

Table comments {
  id integer [primary key, note: 'Unique identifier for each comment']
  post_id integer [note: 'Foreign key to posts table']
  user_id integer [note: 'Foreign key to users table']
  content text [note: 'Comment text content']
  created_at timestamp [note: 'Comment creation timestamp']
}

TableGroup UserContent {
  users
  posts
  comments
}

Ref: posts.author_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id`;

// Effect to set error markers
const setErrorEffect = StateEffect.define();

// Error marker decoration using INLINE styles for guaranteed visibility
const errorMark = Decoration.mark({
  attributes: {
    style: "background-color: rgba(255, 100, 100, 0.4); border-bottom: 2px wavy red;"
  }
});

const errorLineMark = Decoration.line({
  attributes: {
    style: "background-color: rgba(255, 100, 100, 0.15); border-left: 3px solid red; padding-left: 3px;"
  }
});

// StateField to manage error decorations
// Store both decorations AND error location to persist across transactions
const errorField = StateField.define({
  create() {
    return { decorations: Decoration.none, errorLoc: null };
  },
  update(state, tr) {
    console.log('ErrorField update called, effects:', tr.effects.length);

    // Check if we have a setErrorEffect
    let newErrorLoc = state.errorLoc;
    for (let effect of tr.effects) {
      console.log('Processing effect:', effect);
      if (effect.is(setErrorEffect)) {
        console.log('✓ This is a setErrorEffect!');
        const { line, column, length = 1 } = effect.value;
        console.log('Error effect received:', { line, column, length });

        // Store the error location
        if (line && column) {
          newErrorLoc = { line, column, length };
        } else {
          newErrorLoc = null; // Clear error
        }
      }
    }

    // If we have an error location, create decorations
    if (newErrorLoc && newErrorLoc.line && newErrorLoc.column) {
      try {
        const doc = tr.state.doc;
        console.log('Creating decorations for line', newErrorLoc.line, 'column', newErrorLoc.column);
        const lineObj = doc.line(newErrorLoc.line);
        const from = lineObj.from + newErrorLoc.column - 1;
        const to = Math.min(from + newErrorLoc.length, lineObj.to);

        const marks = [];
        // Add line highlight
        marks.push(errorLineMark.range(lineObj.from));
        // Add text underline
        if (from < to) {
          marks.push(errorMark.range(from, to));
        }
        console.log('✓✓✓ Decorations created and PERSISTED:', marks.length, 'marks');
        return { decorations: Decoration.set(marks), errorLoc: newErrorLoc };
      } catch (e) {
        console.error('❌ Error creating decoration:', e);
        return { decorations: Decoration.none, errorLoc: newErrorLoc };
      }
    }

    console.log('No error location, returning no decorations');
    return { decorations: Decoration.none, errorLoc: null };
  },
  provide: f => EditorView.decorations.from(f, state => state.decorations)
});

function DBMLEditor({ value, onChange, onParse }) {
  const [error, setError] = useState(null);
  const [errorLocation, setErrorLocation] = useState(null);
  const [debounceTimer, setDebounceTimer] = useState(null);
  const initialParseRef = useRef(false);
  const lastExternalValueRef = useRef(value);
  const editorViewRef = useRef(null);

  // Function to apply error highlighting from outside
  const applyErrorHighlighting = useCallback((errorObj) => {
    console.log('🟢🟢🟢 applyErrorHighlighting called with:', errorObj);
    if (errorObj && errorObj.location && editorViewRef.current) {
      const loc = { line: errorObj.location.line, column: errorObj.location.column };
      console.log('🟢 Applying highlighting for:', loc);
      setErrorLocation(loc);
      editorViewRef.current.dispatch({
        effects: setErrorEffect.of({ line: loc.line, column: loc.column, length: 20 })
      });
      console.log('🟢 Highlighting applied!');
    } else {
      console.log('🔴 Cannot apply highlighting - errorObj:', errorObj, 'editorView:', !!editorViewRef.current);
    }
  }, []);

  const handleChange = useCallback((val) => {
    onChange(val);
    lastExternalValueRef.current = val; // Update ref to prevent double-parsing

    // Save to localStorage immediately
    try {
      localStorage.setItem('dbml-studio-code', val);
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }

    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Debounce parsing to avoid too many updates
    const timer = setTimeout(() => {
      try {
        const result = parseDBML(val);
        setError(null);
        setErrorLocation(null);
        // Clear error markers
        if (editorViewRef.current) {
          editorViewRef.current.dispatch({
            effects: setErrorEffect.of({})
          });
        }
        onParse(result, null);
      } catch (err) {
        console.log('========== EDITOR CAUGHT ERROR ==========');
        console.log('DBML Parse Error:', err);
        console.log('Error message:', err.message);
        console.log('Error location:', err.location);
        console.log('Error keys:', Object.keys(err));
        console.log('Has location?', 'location' in err);
        console.log('Location value:', err.location);
        setError(err.message);

        // Extract error location if available
        if (err.location) {
          const loc = { line: err.location.line, column: err.location.column };
          setErrorLocation(loc);
          console.log('Setting error location:', loc);
          console.log('Editor view exists:', !!editorViewRef.current);
          // Apply error marker
          if (editorViewRef.current) {
            console.log('Dispatching error effect to editor');
            console.log('Error effect data:', { line: loc.line, column: loc.column });
            editorViewRef.current.dispatch({
              effects: setErrorEffect.of({ line: loc.line, column: loc.column, length: 20 })
            });
            console.log('Error effect dispatched successfully');
          }
        } else {
          console.log('No error location found in error object');
          setErrorLocation(null);
        }
        onParse(null, err);
      }
    }, 500);

    setDebounceTimer(timer);
  }, [onChange, onParse, debounceTimer]);

  const handleLoadExample = useCallback(() => {
    console.log('🔵🔵🔵 handleLoadExample CALLED');
    onChange(EXAMPLE_DBML);
    lastExternalValueRef.current = EXAMPLE_DBML; // Update ref

    // Save example to localStorage
    try {
      localStorage.setItem('dbml-studio-code', EXAMPLE_DBML);
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }

    try {
      const result = parseDBML(EXAMPLE_DBML);
      setError(null);
      setErrorLocation(null);
      // Clear error markers
      if (editorViewRef.current) {
        editorViewRef.current.dispatch({
          effects: setErrorEffect.of({})
        });
      }
      onParse(result, null);
    } catch (err) {
      console.log('========== LOAD EXAMPLE ERROR ==========');
      console.log('Error:', err);
      console.log('Error location:', err.location);
      setError(err.message);

      // Apply error highlighting
      if (err.location && editorViewRef.current) {
        const loc = { line: err.location.line, column: err.location.column };
        setErrorLocation(loc);
        editorViewRef.current.dispatch({
          effects: setErrorEffect.of({ line: loc.line, column: loc.column, length: 20 })
        });
        console.log('Applied error highlighting to line', loc.line, 'column', loc.column);
      }
      onParse(null, err);
    }
  }, [onChange, onParse]);

  const handleClear = useCallback(() => {
    onChange('');
    lastExternalValueRef.current = ''; // Update ref
    setError(null);
    onParse(null, null);

    // Clear from localStorage
    try {
      localStorage.removeItem('dbml-studio-code');
    } catch (err) {
      console.warn('Failed to clear localStorage:', err);
    }
  }, [onChange, onParse]);

  // Parse initial content on mount
  useEffect(() => {
    // Only parse if we haven't done the initial parse yet
    if (!initialParseRef.current && value && value.trim()) {
      initialParseRef.current = true;
      try {
        const result = parseDBML(value);
        setError(null);
        onParse(result, null);
      } catch (err) {
        console.log('========== INITIAL PARSE ERROR ==========');
        console.log('Error:', err);
        console.log('Error location:', err.location);
        setError(err.message);

        // Apply error highlighting
        if (err.location && editorViewRef.current) {
          const loc = { line: err.location.line, column: err.location.column };
          setErrorLocation(loc);
          editorViewRef.current.dispatch({
            effects: setErrorEffect.of({ line: loc.line, column: loc.column, length: 20 })
          });
        }
        onParse(null, err);
      }
    }
  }, [value, onParse]); // Run when value is available

  // Parse when value changes externally (e.g., when loading a diagram)
  useEffect(() => {
    // Check if value changed externally (not from user typing in editor)
    if (value !== lastExternalValueRef.current && value && value.trim()) {
      lastExternalValueRef.current = value;
      try {
        const result = parseDBML(value);
        setError(null);
        onParse(result, null);
      } catch (err) {
        console.log('========== EXTERNAL VALUE PARSE ERROR ==========');
        console.log('Error:', err);
        console.log('Error location:', err.location);
        setError(err.message);
        applyErrorHighlighting(err);
        onParse(null, err);
      }
    }
  }, [value, onParse, applyErrorHighlighting]);

  // Watch for errors passed from parent and apply highlighting
  useEffect(() => {
    console.log('🔵 Checking for error to highlight');
    // Try to parse current value to check for errors
    if (value && value.trim() && editorViewRef.current) {
      try {
        parseDBML(value);
        // No error, clear highlighting
        console.log('✅ No error in current value');
      } catch (err) {
        console.log('❌ Error detected in current value:', err);
        applyErrorHighlighting(err);
      }
    }
  }, [value, applyErrorHighlighting]);

  return (
    <div className="dbml-editor">
      <div className="editor-header">
        <h2>DBML Editor</h2>
        <div className="editor-actions">
          <button onClick={handleLoadExample} className="load-example-btn">
            Load Example
          </button>
          <button onClick={handleClear} className="clear-btn" title="Clear editor">
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="editor-container">
        <CodeMirror
          value={value}
          height="100%"
          theme={oneDark}
          extensions={[
            sql(),
            EditorView.lineWrapping,
            errorField,
          ]}
          onChange={handleChange}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
          }}
          placeholder="Enter your DBML code here..."
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>

      <div className="editor-footer">
        <span className="hint">
          Tables can be dragged and repositioned in the visualization
        </span>
      </div>
    </div>
  );
}

export default DBMLEditor;

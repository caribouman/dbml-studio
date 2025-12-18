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

// Error marker decoration
const errorMark = Decoration.mark({
  attributes: { style: "background-color: rgba(255, 0, 0, 0.3); text-decoration: wavy underline red;" }
});

const errorLineMark = Decoration.line({
  attributes: { style: "background-color: rgba(255, 0, 0, 0.1);" }
});

// StateField to manage error decorations
const errorField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (let effect of tr.effects) {
      if (effect.is(setErrorEffect)) {
        const { line, column, length = 1 } = effect.value;
        if (line && column) {
          try {
            const doc = tr.state.doc;
            const lineObj = doc.line(line);
            const from = lineObj.from + column - 1;
            const to = Math.min(from + length, lineObj.to);

            const marks = [];
            // Add line highlight
            marks.push(errorLineMark.range(lineObj.from));
            // Add text underline
            if (from < to) {
              marks.push(errorMark.range(from, to));
            }
            return Decoration.set(marks);
          } catch (e) {
            console.warn('Error creating decoration:', e);
            return Decoration.none;
          }
        }
        return Decoration.none;
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f)
});

function DBMLEditor({ value, onChange, onParse }) {
  const [error, setError] = useState(null);
  const [errorLocation, setErrorLocation] = useState(null);
  const [debounceTimer, setDebounceTimer] = useState(null);
  const initialParseRef = useRef(false);
  const lastExternalValueRef = useRef(value);
  const editorViewRef = useRef(null);

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
        setError(err.message);
        // Extract error location if available
        if (err.location) {
          const loc = { line: err.location.line, column: err.location.column };
          setErrorLocation(loc);
          // Apply error marker
          if (editorViewRef.current) {
            editorViewRef.current.dispatch({
              effects: setErrorEffect.of({ line: loc.line, column: loc.column, length: 10 })
            });
          }
        } else {
          setErrorLocation(null);
        }
        onParse(null, err);
      }
    }, 500);

    setDebounceTimer(timer);
  }, [onChange, onParse, debounceTimer]);

  const handleLoadExample = useCallback(() => {
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
      onParse(result, null);
    } catch (err) {
      setError(err.message);
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
        setError(err.message);
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
        setError(err.message);
        onParse(null, err);
      }
    }
  }, [value, onParse]);

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

import React, { useState } from 'react';
import './InputPanel.css';

const EXAMPLE_DBML = `Table users {
  id integer [primary key]
  username varchar
  email varchar [unique]
  created_at timestamp
}

Table posts {
  id integer [primary key]
  title varchar
  content text
  author_id integer
  created_at timestamp
}

Table comments {
  id integer [primary key]
  post_id integer
  user_id integer
  content text
  created_at timestamp
}

Ref: posts.author_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id`;

function InputPanel({ onLoadDBML }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onLoadDBML(input);
    }
  };

  const handleLoadExample = () => {
    setInput(EXAMPLE_DBML);
  };

  return (
    <div className="input-panel">
      <div className="input-container">
        <h1>DBML Studio</h1>
        <p className="subtitle">Interactive Database Diagram Viewer</p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your DBML code here..."
            className="dbml-input"
          />

          <div className="button-group">
            <button type="button" onClick={handleLoadExample} className="example-btn">
              Load Example
            </button>
            <button type="submit" className="submit-btn">
              Visualize
            </button>
          </div>
        </form>

        <div className="info">
          <p>Paste your DBML (Database Markup Language) code to visualize your database schema.</p>
          <p>Tables can be dragged and repositioned. Positions are automatically saved.</p>
        </div>
      </div>
    </div>
  );
}

export default InputPanel;

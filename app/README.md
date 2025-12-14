# DBML Studio

An interactive web-based DBML (Database Markup Language) viewer with draggable tables and automatic position persistence.

## Features

- Parse and visualize DBML schemas
- Drag and drop tables to arrange your diagram
- Automatic position saving (both backend and localStorage)
- Real-time relationship visualization
- Responsive design
- Docker deployment with Traefik integration

## Technology Stack

- **Frontend**: React + Vite
- **Diagram Library**: React Flow (for smooth drag-and-drop)
- **DBML Parser**: @dbml/core
- **Backend**: Node.js + Express
- **Deployment**: Docker + Traefik

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Development mode:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Deploy with Docker:
   ```bash
   docker-compose up -d --build
   ```

## Usage

1. Access the application at `https://dbml-studio.soyecourt.ovh`
2. Paste your DBML code or load the example
3. Click "Visualize" to see your database schema
4. Drag tables to rearrange them
5. Positions are automatically saved

## DBML Example

```dbml
Table users {
  id integer [primary key]
  username varchar
  email varchar [unique]
  created_at timestamp
}

Table posts {
  id integer [primary key]
  title varchar
  author_id integer
}

Ref: posts.author_id > users.id
```

## Data Persistence

Table positions are saved:
- To the backend API (stored in `/app/data`)
- To browser localStorage (as fallback)

Each DBML schema gets a unique project ID based on content hash.

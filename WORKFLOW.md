# Fast Development Workflow

This workflow lets you edit code on your host and see changes immediately, without rebuilding Docker images.

## How It Works

1. **Dockerfile.simple**: Only installs `node_modules` (cached layer)
2. **Volume mount**: Your `./app` folder is mounted into the container
3. **Build on host**: Run `npm run build` on your host machine
4. **Instant deployment**: Changes apply immediately via volume mount

## Workflow

### Initial Setup (One Time)

```bash
# 1. Install dependencies on your host (for building)
cd app
npm install
cd ..

# 2. Build the Docker image (only installs node_modules)
docker-compose -f docker-compose.simple.yml build

# 3. Start the container
docker-compose -f docker-compose.simple.yml up -d
```

### Making Changes (Fast Iteration)

```bash
# 1. Edit your code in app/src/
# (edit files...)

# 2. Build on your host machine
cd app
npm run build

# 3. Changes are live immediately!
# The container serves the new dist/ files via the volume mount

# Optional: View logs
docker-compose -f docker-compose.simple.yml logs -f
```

### When to Rebuild Docker Image

Only rebuild when:
- `package.json` changes (new dependencies)
- Dockerfile changes

```bash
docker-compose -f docker-compose.simple.yml up -d --build
```

## Advantages

✅ **Fast iterations**: No Docker rebuild needed
✅ **Instant deployment**: Just `npm run build` on host
✅ **Cross-platform**: `node_modules` compiled for Linux in container
✅ **Simple**: One command to deploy changes

## File Structure

```
./app/              → Mounted to /app in container
  ├── src/          → Your source code (edit freely)
  ├── dist/         → Built files (from 'npm run build')
  ├── node_modules/ → From container (Linux-compiled)
  ├── package.json  → Triggers rebuild if changed
  └── server.js     → Backend (edit freely)
```

## Comparison with Traditional Approach

### Traditional (Slow)
```bash
# Edit code
docker-compose up -d --build  # 2-3 minutes
```

### New Workflow (Fast)
```bash
# Edit code
npm run build  # 10-15 seconds
# Already deployed!
```

## Troubleshooting

**Issue: "Module not found" errors**
- Solution: Rebuild Docker image to update node_modules
```bash
docker-compose -f docker-compose.simple.yml up -d --build
```

**Issue: Changes not appearing**
- Check that dist/ was rebuilt: `ls -la app/dist/`
- Check container is using volume: `docker inspect dbml-studio | grep app:/app`
- Restart container: `docker-compose -f docker-compose.simple.yml restart`

**Issue: better-sqlite3 errors**
- Don't copy host `node_modules` to `app/node_modules`
- The container's node_modules (compiled for Linux) must be preserved
- Check `.dockerignore` has `app/node_modules`

## Production vs This Workflow

This workflow is **perfect for single-server deployments** where you:
- Control the host machine
- Want fast iterations
- Don't need to distribute Docker images

For **multi-server or cloud deployments**, use the traditional Dockerfile that bundles everything.

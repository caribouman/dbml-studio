# Authentication Setup Guide

This guide will help you set up the account system with OAuth for DBML Studio.

## Quick Start

1. Copy the `.env.example` file to `.env` in the `app/` directory:
   ```bash
   cd app
   cp .env.example .env
   ```

2. Edit the `.env` file and update the secrets:
   ```bash
   JWT_SECRET=your-random-secret-key-here
   SESSION_SECRET=your-session-secret-here
   ```

3. (Optional) Set up OAuth providers (see below)

## Features

- **Email/Password Authentication**: Users can register and login with email and password
- **Google OAuth**: Users can sign in with their Google account
- **GitHub OAuth**: Users can sign in with their GitHub account
- **JWT + Session**: Hybrid authentication supporting both JWT tokens and sessions
- **SQLite Database**: Lightweight file-based database (no setup required)

## OAuth Setup (Optional)

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create "OAuth 2.0 Client ID"
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
6. Copy the Client ID and Client Secret to your `.env` file:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
   ```

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: DBML Studio
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/github/callback`
4. Click "Register application"
5. Copy the Client ID and generate a new Client Secret
6. Add them to your `.env` file:
   ```bash
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
   ```

## Security Recommendations

### For Production

1. **Use strong secrets**: Generate random secrets for JWT and session:
   ```bash
   # Generate a random secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Use HTTPS**: Set `NODE_ENV=production` and ensure your app runs on HTTPS

3. **Update callback URLs**: Update OAuth callback URLs to your production domain

4. **Environment variables**: Never commit `.env` file to version control

5. **Database backups**: Regularly backup the SQLite database file (`app/data/dbml-studio.db`)

## Database Location

The SQLite database is stored at: `app/data/dbml-studio.db`

This file contains:
- User accounts
- Saved diagrams
- Authentication data

Make sure to backup this file regularly in production.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/github` - Initiate GitHub OAuth

### Diagrams
- `POST /api/diagrams` - Create new diagram
- `GET /api/diagrams` - Get user's diagrams
- `GET /api/diagrams/:id` - Get specific diagram
- `PUT /api/diagrams/:id` - Update diagram
- `DELETE /api/diagrams/:id` - Delete diagram
- `GET /api/public/diagrams` - Get public diagrams

## Troubleshooting

### OAuth not working

1. Check that CLIENT_ID and CLIENT_SECRET are correct
2. Verify callback URLs match exactly (including protocol and port)
3. Check browser console for errors
4. Ensure OAuth app is not in testing mode (for Google)

### Database errors

1. Check file permissions on `app/data/` directory
2. Ensure SQLite is installed (it's included with better-sqlite3)
3. Check disk space

### Session issues

1. Clear browser cookies
2. Check SESSION_SECRET is set
3. Verify cookie settings in server.js

## Development vs Production

### Development
- Uses HTTP
- Allows localhost callback URLs
- Less strict security settings

### Production
- Requires HTTPS
- Production callback URLs
- Secure cookies enabled
- Strong secrets required

## Support

For issues or questions:
1. Check the logs in the server console
2. Review the browser console for client-side errors
3. Verify environment variables are set correctly

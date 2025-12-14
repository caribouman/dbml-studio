const jwt = require('jsonwebtoken');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const database = require('./database');

// JWT secret (should be in environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Authentication middleware for protected routes
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // Check session as fallback
    if (req.session && req.session.userId) {
      const user = database.userQueries.findById(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  const user = database.userQueries.findById(decoded.id);
  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

// Optional authentication (doesn't fail if not authenticated)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const user = database.userQueries.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
  } else if (req.session && req.session.userId) {
    const user = database.userQueries.findById(req.session.userId);
    if (user) {
      req.user = user;
    }
  }

  next();
}

// Passport local strategy
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const user = database.userQueries.findByEmail(email);

      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      if (!user.password_hash) {
        return done(null, false, { message: 'Please use social login' });
      }

      const isValid = await database.verifyPassword(password, user.password_hash);
      if (!isValid) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Google OAuth strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = database.userQueries.findByProvider('google', profile.id);

      if (!user) {
        // Check if email already exists
        const existingUser = database.userQueries.findByEmail(profile.emails[0].value);
        if (existingUser) {
          return done(null, false, { message: 'Email already registered' });
        }

        // Create new user
        const userId = await database.createUser(
          profile.emails[0].value,
          profile.displayName || profile.emails[0].value.split('@')[0],
          null,
          'google',
          profile.id,
          profile.photos && profile.photos[0] ? profile.photos[0].value : null
        );
        user = database.userQueries.findById(userId);
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// GitHub OAuth strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
    scope: ['user:email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = database.userQueries.findByProvider('github', profile.id);

      if (!user) {
        // Get primary email
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.com`;

        // Check if email already exists
        const existingUser = database.userQueries.findByEmail(email);
        if (existingUser) {
          return done(null, false, { message: 'Email already registered' });
        }

        // Create new user
        const userId = await database.createUser(
          email,
          profile.username || profile.displayName,
          null,
          'github',
          profile.id,
          profile.photos && profile.photos[0] ? profile.photos[0].value : null
        );
        user = database.userQueries.findById(userId);
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  const user = database.userQueries.findById(id);
  done(null, user);
});

module.exports = {
  generateToken,
  verifyToken,
  authenticateJWT,
  optionalAuth,
  passport,
};

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const normalizeBaseUrl = (value = '') => String(value).replace(/\/+$/, '');

const isProduction = process.env.NODE_ENV === 'production';
const configuredClientId = process.env.GOOGLE_CLIENT_ID;
const configuredClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const backendBaseUrl = normalizeBaseUrl(
  process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || ''
);

const callbackURL = process.env.GOOGLE_CALLBACK_URL
  ? normalizeBaseUrl(process.env.GOOGLE_CALLBACK_URL)
  : (isProduction
    ? `${backendBaseUrl}/api/auth/google/callback`
    : 'http://localhost:5000/api/auth/google/callback');

if (isProduction && (!configuredClientId || !configuredClientSecret)) {
  throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in production environment.');
}

if (isProduction && !callbackURL.startsWith('https://')) {
  throw new Error('GOOGLE_CALLBACK_URL (or BACKEND_URL/RENDER_EXTERNAL_URL) must be HTTPS in production.');
}

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: configuredClientId || 'your-google-client-id',
      clientSecret: configuredClientSecret || 'your-google-client-secret',
      callbackURL: callbackURL,
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Tìm user đã tồn tại với Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // User đã tồn tại
          return done(null, user);
        }

        // Kiểm tra email đã tồn tại chưa
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Email đã tồn tại, link với Google account
          user.googleId = profile.id;
          user.authProvider = 'google';
          if (!user.avatar || user.avatar.includes('placeholder')) {
            user.avatar = profile.photos[0]?.value || user.avatar;
          }
          await user.save();
          return done(null, user);
        }

        // Tạo user mới
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          avatar: profile.photos[0]?.value || 'https://via.placeholder.com/150',
          authProvider: 'google',
          isActive: true,
          role: 'customer'
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

module.exports = passport;

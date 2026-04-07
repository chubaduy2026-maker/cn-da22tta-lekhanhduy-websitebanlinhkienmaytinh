const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables FIRST - before importing passport
dotenv.config();

const passport = require('./config/passport');

const app = express();

// CORS Configuration - Allow all origins for public API
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from public folder (images, banners, etc.)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Log all requests in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu')
  .then(() => console.log('✅ Kết nối MongoDB thành công!'))
  .catch((err) => console.error('❌ Lỗi kết nối MongoDB:', err));

// Routes
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const categoryRoutes = require('./routes/categories');
const uploadRoutes = require('./routes/upload');
const filterRoutes = require('./routes/filters');
const zalopayRoutes = require('./routes/zalopay');
const reviewRoutes = require('./routes/reviews');
const couponRoutes = require('./routes/coupons');
const aiRoutes = require('./routes/ai');
const recommendationsRoutes = require('./routes/recommendations');
const recommendationV2Routes = require('./routes/v2/recommendations');
const chatV3Routes = require('./routes/v3/chat');
const videoReviewRoutes = require('./routes/videoReviews');
const techNewsRoutes = require('./routes/techNews');
const knowledgeRoutes = require('./routes/knowledge');

app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/zalopay', zalopayRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai/recommendations', recommendationsRoutes);
app.use('/api/ai/v2', recommendationV2Routes);
app.use('/api/v3', chatV3Routes);
app.use('/api', chatV3Routes); // Alias: exposes /api/chat/* alongside /api/v3/chat/*
app.use('/api/video-reviews', videoReviewRoutes);
app.use('/api/tech-news', techNewsRoutes);
app.use('/api/knowledge', knowledgeRoutes); // RAG knowledge base

// Home route
app.get('/', (req, res) => {
  res.json({ message: 'Chào mừng đến với API Cửa hàng Điện tử!' });
});

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production') {
  const backendBuildPath = path.join(__dirname, 'build');
  const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');

  // Support both monolithic deploy (backend/build) and monorepo deploy (frontend/build).
  const resolvedBuildPath = fs.existsSync(backendBuildPath)
    ? backendBuildPath
    : (fs.existsSync(frontendBuildPath) ? frontendBuildPath : null);

  if (resolvedBuildPath) {
    app.use(express.static(resolvedBuildPath));

    // Only fallback to SPA for non-API routes.
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.sendFile(path.join(resolvedBuildPath, 'index.html'));
    });
  } else {
    console.warn('Frontend build not found. Running API-only mode in production.');
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Có lỗi xảy ra!', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại port ${PORT}`);
});

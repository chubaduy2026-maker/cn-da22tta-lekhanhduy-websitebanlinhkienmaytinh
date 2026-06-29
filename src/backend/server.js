const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables FIRST - before importing passport (Updated API Key)
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

// Graceful JSON parse error handler (handle malformed JSON from external clients)
app.use((err, req, res, next) => {
  if (err && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.warn('Malformed JSON received from client:', err.message);
    return res.status(400).json({ message: 'Invalid JSON payload', error: err.message });
  }
  return next(err);
});

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
  .then(() => {
    console.log('✅ Kết nối MongoDB thành công!');

    // ── Đăng ký 5 Specialized Agents vào AIRouter ──────────────────────
    try {
      const AIRouter = require('./services/ai/core/AIRouter');
      const { registerAgents } = require('./services/ai/agents/index');
      registerAgents(AIRouter);
      console.log(`🤖 Đã đăng ký ${AIRouter.listAgents().length} AI agents: [${AIRouter.listAgents().join(', ')}]`);
    } catch (agentErr) {
      console.warn('⚠️ Không thể đăng ký agents:', agentErr.message);
    }
    // ───────────────────────────────────────────────────────────────────
  })
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
const chatbotRoutes = require('./routes/chatbot');
const recommendationsRoutes = require('./routes/recommendations');
const behaviorRoutes = require('./routes/behavior');
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
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/ai/chatbot', chatbotRoutes);
app.use('/api/ai/recommendations', recommendationsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/behavior', behaviorRoutes);
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

const PORT = parseInt(process.env.PORT, 10) || 5000;

function startServer(port, attemptsLeft = 5) {
  const server = app.listen(port, () => {
    console.log(`🚀 Server đang chạy tại port ${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`Port ${port} đang được sử dụng. Thử cổng ${port + 1}...`);
      setTimeout(() => startServer(port + 1, attemptsLeft - 1), 500);
    } else {
      console.error('Lỗi khi khởi động server:', err);
      process.exit(1);
    }
  });

  const gracefulShutdown = () => {
    console.log('Đang tắt server...');
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

startServer(PORT);

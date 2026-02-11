const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const ContractReader = require('../reader');

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
// Use memory storage in serverless environments, disk storage locally
const isServerless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;

let storage;
if (isServerless) {
  // Use memory storage for serverless
  storage = multer.memoryStorage();
} else {
  // Use disk storage for local development
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads');
      fs.ensureDirSync(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  });
}

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('contract'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded or invalid file type' 
      });
    }

    const reader = new ContractReader();
    let results;

    if (req.file.buffer) {
      // Memory storage (serverless) - create temporary file
      const tmpDir = process.env.VERCEL ? '/tmp' : require('os').tmpdir();
      await fs.ensureDir(tmpDir);
      tempFilePath = path.join(tmpDir, `${Date.now()}-${req.file.originalname}`);
      await fs.writeFile(tempFilePath, req.file.buffer);
      results = await reader.processContract(tempFilePath);
    } else {
      // Disk storage (local) - use existing file path
      results = await reader.processContract(req.file.path);
    }

    // Clean up files
    if (tempFilePath) {
      await fs.remove(tempFilePath).catch(console.error);
    }
    if (req.file.path) {
      await fs.remove(req.file.path).catch(console.error);
    }

    // Return results
    res.json({
      success: true,
      fileName: req.file.originalname,
      results: results
    });

  } catch (error) {
    console.error('Processing error:', error);
    
    // Clean up files on error
    if (tempFilePath) {
      await fs.remove(tempFilePath).catch(console.error);
    }
    if (req.file && req.file.path) {
      await fs.remove(req.file.path).catch(console.error);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: error.message
  });
});

// Start server
app.listen(port, () => {
  console.log(`📄 Contract Reader Web Interface`);
  console.log(`🌐 Server running at http://localhost:${port}`);
  console.log(`📁 Upload endpoint: http://localhost:${port}/upload`);
  console.log(`❤️  Health check: http://localhost:${port}/health`);
  
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set - contract analysis will fail');
  }
});

module.exports = app;
const express = require('express');
const multer = require('multer');
const path = require('path');
const ContractReader = require('../reader');

const app = express();

// Use memory storage only for serverless
const upload = multer({
  storage: multer.memoryStorage(),
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
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded or invalid file type' 
      });
    }

    console.log('Processing file:', req.file.originalname, 'Size:', req.file.size);

    // Create a custom ContractReader that works with buffers
    const reader = new ContractReader();
    
    // Process the contract directly from buffer without writing to disk
    const results = await reader.processContractFromBuffer(req.file.buffer, req.file.originalname);

    // Return results
    res.json({
      success: true,
      fileName: req.file.originalname,
      results: results
    });

  } catch (error) {
    console.error('Processing error:', error);
    
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
    environment: 'serverless'
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

module.exports = app;
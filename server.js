// server.js
import express from 'express';
import path from 'path';
import { spawnSync } from 'child_process';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

app.use(express.json({ limit: '10mb' }));

// Add this middleware in server.js
// Update your CSP middleware to this:
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; " +
        "style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
        "connect-src 'self';"
    );
    next();
});

// Add this static file serving route (before your other routes):
app.use('/js', express.static(path.join(__dirname, 'public/js')));

app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// MongoDB connection with enhanced configuration
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/facepulse_bp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'facepulse_bp',
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('✅ Connected to MongoDB successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Enhanced Prediction schema with validation
const predictionSchema = new mongoose.Schema({
  systolic: {
    type: Number,
    required: true,
    min: 50,
    max: 250
  },
  diastolic: {
    type: Number,
    required: true,
    min: 30,
    max: 150
  },
  emotion: {
    type: String,
    enum: ['happy', 'neutral', 'sad', 'angry', 'surprised', 'disgusted', 'fearful'],
    default: 'neutral'
  },
  suggestions: [{
    type: String,
    required: true
  }],
  signal: {
    type: Array,
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length >= 100;
      },
      message: 'Signal must be an array with at least 100 samples'
    }
  },
  userAgent: String,
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Enhanced Recording schema
const recordingSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  mimetype: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  prediction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prediction',
    index: true
  },
  metadata: Object
}, {
  timestamps: true
});

const Prediction = mongoose.model('Prediction', predictionSchema);
const Recording = mongoose.model('Recording', recordingSchema);

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add specific static routes for better organization
app.use('/static', express.static(path.join(__dirname, 'public/static')));
app.use('/models', express.static(path.join(__dirname, 'public/static/models')));
// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'templates', 'index.html'));
});

app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'templates','results.html'));
});

// Enhanced prediction endpoint with rate limiting
app.post('/api/predict', async (req, res) => {
    try {
        const { signal, emotion } = req.body;
        if (!Array.isArray(signal) || signal.length < 100) {
            return res.status(400).json({ success: false, error: 'Signal must be an array with at least 100 samples' });
        }

        // 1. Write signal to temp CSV with timestamps and header
        const samplingRate = 30; // Hz
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const tempCsv = path.join(tempDir, `rppg_${Date.now()}.csv`);
        const csvLines = ['Time (s),Green Avg (rPPG Proxy)'];
        for (let i = 0; i < signal.length; i++) {
            const time = (i / samplingRate).toFixed(3);
            csvLines.push(`${time},${signal[i]}`);
        }
        console.log('Received signal, writing CSV...');
        fs.writeFileSync(tempCsv, csvLines.join('\n'));
        console.log('CSV written, running Features.py...');

        // 2. Call Features.py to extract features
        const featuresPy = path.join(__dirname, 'model', 'python_src', 'models', 'Features.py');
        const featuresCsv = path.join(tempDir, `rppg_features_${Date.now()}.csv`);
        const featuresResult = spawnSync('/usr/local/bin/python3', [featuresPy, tempCsv, featuresCsv], { encoding: 'utf-8' });
        console.log('Features.py finished.');

        if (featuresResult.status !== 0) {
            throw new Error(`Features.py error: ${featuresResult.stderr || featuresResult.stdout}`);
        }

        // 3. Read features from output CSV
        if (!fs.existsSync(featuresCsv)) throw new Error('Features output CSV not found');
        const featuresLine = fs.readFileSync(featuresCsv, 'utf8').split('\n')[1];
        const featuresArr = featuresLine.split(',').map(Number);

        // 4. Call predict_bp.py with features as JSON string argument
        const predictPy = path.join(__dirname, 'model', 'predict_bp.py');
        const featuresJson = JSON.stringify(featuresArr);
        const predictResult = spawnSync('/usr/local/bin/python3', [predictPy, featuresJson], { encoding: 'utf-8' });

        if (predictResult.status !== 0) {
            throw new Error(`predict_bp.py error: ${predictResult.stderr || predictResult.stdout}`);
        }

        // 5. Parse prediction result (should be JSON)
        let prediction;
        try {
            prediction = JSON.parse(predictResult.stdout.trim());
        } catch (e) {
            throw new Error('Failed to parse prediction output: ' + predictResult.stdout);
        }

        if (!prediction.systolic || !prediction.diastolic) {
            throw new Error('Prediction output missing systolic/diastolic');
        }

        res.json({
            success: true,
            systolic: prediction.systolic,
            diastolic: prediction.diastolic,
            emotion: emotion || null
        });

    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update the /api/process-rppg endpoint
app.post('/api/process-rppg', apiLimiter, async (req, res) => {
    try {
        const { signal } = req.body;
        
        // Validate input
        if (!Array.isArray(signal) || signal.length < MIN_SAMPLES_FOR_PREDICTION) {
            return res.status(400).json({ 
                success: false,
                error: `Signal must be an array with at least ${MIN_SAMPLES_FOR_PREDICTION} samples`,
                received: signal?.length || 0,
                required: MIN_SAMPLES_FOR_PREDICTION
            });
        }
        
        // Process signal (replace with your actual processing logic)
        const processedSignal = window.rPPG.prepareSignalForML(signal);
        const features = window.rPPG.extractFeatures(processedSignal);
        
        // Call Python script for prediction
        const pythonScript = path.join(__dirname, 'model', 'predict_bp.py');
        const tempFile = path.join(__dirname, 'temp', `rppg_${Date.now()}.json`);
        
        await fs.promises.writeFile(tempFile, JSON.stringify({
            signal: processedSignal,
            features
        }));
        
        const pythonProcess = spawn('C:\\Users\\vedam\\AppData\\Local\\Programs\\Python\\Python312\\python.exe', [pythonScript, tempFile]);
        
        let stdout = '';
        pythonProcess.stdout.on('data', (data) => stdout += data.toString());
        
        const exitCode = await new Promise((resolve) => {
            pythonProcess.on('close', resolve);
        });
        
        if (exitCode !== 0) throw new Error('Python script failed');
        
        // Parse results
        const result = parsePythonOutput(stdout);
        
        // Save to database
        const prediction = await savePrediction({
            ...result,
            signal: processedSignal,
            inputData: features
        });
        
        res.json({
            success: true,
            data: prediction
        });
        
    } catch (error) {
        console.error('RPPG processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process RPPG signal',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Enhanced results endpoint
app.get('/api/predict/result', async (req, res) => {
  try {
    const lastPrediction = await Prediction.findOne()
      .sort({ timestamp: -1 })
      .lean();

    if (!lastPrediction) {
      return res.json({
        success: true,
        data: {
          systolic: 0,
          diastolic: 0,
          emotion: "unknown",
          category: "Unknown",
          suggestions: [
            "No previous readings found",
            "Start a new reading to get results"
          ],
          timestamp: new Date()
        }
      });
    }

    const category = getBpCategory(lastPrediction.systolic, lastPrediction.diastolic);
    const suggestions = generateSuggestions(lastPrediction.systolic, lastPrediction.diastolic);

    return res.json({
      success: true,
      data: {
        ...lastPrediction,
        category,
        suggestions
      }
    });
  } catch (error) {
    console.error('Results error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch results'
    });
  }
});

// Ensure the 'recordings' directory exists
const recordingsDir = path.join(__dirname, 'uploads/recordings');
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

// Set up multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, recordingsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Upload route
app.post('/api/upload-recording', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    res.json({ success: true, filename: req.file.filename });
});

// Enhanced recording endpoints
app.post('/api/upload-recording', apiLimiter, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }

    const latestPrediction = await Prediction.findOne().sort({ timestamp: -1 });

    const recording = new Recording({
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      prediction: latestPrediction?._id,
      metadata: {
        originalName: req.file.originalname,
        encoding: req.file.encoding
      }
    });

    await recording.save();

    return res.json({
      success: true,
      data: {
        id: recording._id,
        filename: recording.filename,
        url: `/recordings/${recording.filename}`,
        createdAt: recording.createdAt
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process recording'
    });
  }
});

app.get('/api/recordings', apiLimiter, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    const recordings = await Recording.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('prediction')
      .lean();

    return res.json({
      success: true,
      data: recordings.map(rec => ({
        ...rec,
        url: `/recordings/${rec.filename}`
      })),
      count: recordings.length
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recordings'
    });
  }
});

// Helper functions
function parsePythonOutput(output) {
  try {
    const result = JSON.parse(output.trim());
    
    if (typeof result.systolic !== 'number' || typeof result.diastolic !== 'number') {
      throw new Error('Invalid output format - missing systolic/diastolic values');
    }

    if (result.systolic < 50 || result.systolic > 250) {
      throw new Error(`Invalid systolic value: ${result.systolic}`);
    }

    if (result.diastolic < 30 || result.diastolic > 150) {
      throw new Error(`Invalid diastolic value: ${result.diastolic}`);
    }

    return result;
  } catch (error) {
    console.error('Failed to parse Python output:', output);
    throw new Error(`Invalid Python output: ${error.message}`);
  }
}

async function savePrediction(data) {
  const suggestions = generateSuggestions(data.systolic, data.diastolic);
  
  const prediction = new Prediction({
    systolic: data.systolic,
    diastolic: data.diastolic,
    emotion: data.emotion || 'neutral',
    suggestions,
    signal: data.signal,
    inputData: data.inputData,
    userAgent: data.userAgent,
    ipAddress: data.ipAddress
  });

  return await prediction.save();
}

function getBpCategory(systolic, diastolic) {
  if (systolic < 120 && diastolic < 80) return "Normal";
  if (systolic < 130 && diastolic < 80) return "Elevated";
  if (systolic < 140 || diastolic < 90) return "Hypertension Stage 1";
  if (systolic >= 140 || diastolic >= 90) return "Hypertension Stage 2";
  return "Unknown";
}

function generateSuggestions(systolic, diastolic) {
  const suggestions = [];
  
  if (systolic < 120 && diastolic < 80) {
    suggestions.push("Maintain your healthy lifestyle");
    suggestions.push("Continue regular exercise and balanced diet");
  } else if (systolic < 130 && diastolic < 80) {
    suggestions.push("Consider reducing sodium intake");
    suggestions.push("Monitor your blood pressure regularly");
  } else if (systolic < 140 || diastolic < 90) {
    suggestions.push("Consult a healthcare professional");
    suggestions.push("Consider lifestyle changes to lower your blood pressure");
  } else {
    suggestions.push("Seek medical attention for proper evaluation");
    suggestions.push("Follow your healthcare provider's recommendations");
  }
  
  suggestions.push("Stay hydrated throughout the day");
  suggestions.push("Ensure 7-8 hours of quality sleep each night");
  
  return suggestions;
}

// Serve recording files
app.use('/recordings', express.static(path.join(__dirname, 'uploads/recordings')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FacePulse: AI Blood Pressure Estimator running at http://localhost:${PORT}`);
  console.log(`📊 MongoDB: ${process.env.MONGO_URI}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
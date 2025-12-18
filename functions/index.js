const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS
app.use(cors());

// Firebase config endpoint
app.get('/firebase-config', (req, res) => {
  try {
    // Get Firebase credentials from environment variables
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

    // Validate that all required fields are set
    const requiredFields = Object.keys(firebaseConfig);
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

    if (missingFields.length > 0) {
      return res.status(500).json({
        error: 'Missing Firebase configuration',
        missingFields: missingFields
      });
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).json(firebaseConfig);
  } catch (error) {
    console.error('Error fetching Firebase config:', error);
    res.status(500).json({
      error: 'Failed to retrieve Firebase configuration',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Export the API function
exports.api = functions.https.onRequest(app);

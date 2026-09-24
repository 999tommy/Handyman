const admin = require('firebase-admin');
const fs = require('fs');
const config = require('./env');
const logger = require('../utils/logger');

/**
 * Firebase Admin Configuration
 * 
 * Initializes the Firebase Admin SDK used to verify Firebase ID tokens
 * (e.g. from Firebase Phone Authentication) on the backend.
 * 
 * The service account is resolved from (in priority order):
 *   1. FIREBASE_SERVICE_ACCOUNT env var (raw JSON string) - used on production hosts
 *   2. serviceAccountKey.json in the project root
 * 
 * Lazy-initialized so the server can still boot even if Firebase is not yet configured.
 */

let firebaseAuth = null;

let getAuth;
try {
  // firebase-admin v12+ (modular API)
  ({ getAuth } = require('firebase-admin/auth'));
} catch (e) {
  // Older firebase-admin exposes admin.auth directly
  getAuth = (app) => admin.auth(app);
}

function getCredential() {
  if (typeof admin.cert === 'function') {
    // firebase-admin v12+ (modular API)
    return admin.cert;
  }
  if (admin.credential && typeof admin.credential.cert === 'function') {
    // Legacy firebase-admin
    return admin.credential.cert.bind(admin.credential);
  }
  throw new Error('Unable to resolve Firebase admin credential helper');
}

function resolveServiceAccount() {
  if (config.firebase.serviceAccountJson) {
    return JSON.parse(config.firebase.serviceAccountJson);
  }

  const serviceAccountPath = config.firebase.serviceAccountPath;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  }

  return null;
}

function getFirebaseAuth() {
  if (firebaseAuth) return firebaseAuth;

  const serviceAccount = resolveServiceAccount();

  if (!serviceAccount) {
    throw new Error(
      'Firebase service account not configured. Set the FIREBASE_SERVICE_ACCOUNT env variable ' +
      'or place serviceAccountKey.json in the project root.'
    );
  }

  // Avoid double-initialization if the default app already exists
  const existingApps = typeof admin.getApps === 'function' ? admin.getApps() : admin.apps;

  if (!existingApps || existingApps.length === 0) {
    admin.initializeApp({
      credential: getCredential()(serviceAccount),
    });
  }

  firebaseAuth = getAuth();
  logger.info('Firebase Admin initialized');
  return firebaseAuth;
}

module.exports = {
  admin,
  getFirebaseAuth,
};
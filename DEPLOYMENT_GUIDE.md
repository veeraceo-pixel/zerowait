# Deployment Guide for ZeroWait

## Overview

Your ZeroWait website frontend is now secure and error-free. To enable the login/signup functionality, you need to deploy it to a backend-capable hosting platform with Firebase configuration.

## Why GitHub Pages Isn't Enough

GitHub Pages is a **static hosting service** that cannot run backend code. The login system requires:
- Backend endpoint: `/api/firebase-config`
- Environment variables for Firebase credentials
- Server-side processing for authentication

## Deployment Options

### Option 1: Vercel (Recommended) ⭐

**Easiest setup, best for this project**

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

#### Step 2: Deploy
```bash
vercel
```

Follow the prompts:
- Connect to GitHub account
- Select your repository
- Select ZeroWait project

#### Step 3: Add Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your ZeroWait project
3. Go to Settings → Environment Variables
4. Add these variables:

```
FIREBASE_API_KEY=AIzaSyAJFGE5OFfn-OhDNJ_rWO5oi2d2CHl2fXE
FIREBASE_AUTH_DOMAIN=zerowait-c21fc.firebaseapp.com
FIREBASE_PROJECT_ID=zerowait-c21fc
FIREBASE_STORAGE_BUCKET=zerowait-c21fc.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=839269113134
FIREBASE_APP_ID=1:839269113134:web:0411874b0e248a2a102ebf
```

#### Step 4: Create Backend Function

Create `api/firebase-config.js`:

```javascript
export default (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  });
};
```

#### Step 5: Redeploy
```bash
vercel --prod
```

---

### Option 2: Netlify

**Alternative option, also easy**

#### Step 1: Connect GitHub to Netlify

1. Go to: https://netlify.com
2. Click "New site from Git"
3. Choose GitHub
4. Select your repository

#### Step 2: Configure Build Settings

- Build command: (leave empty)
- Publish directory: `.` (root directory)

#### Step 3: Add Environment Variables

1. Go to Site settings → Build & deploy → Environment
2. Add the same Firebase variables as above

#### Step 4: Create Backend Function

Create `netlify/functions/firebase-config.js`:

```javascript
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    })
  };
};
```

---

### Option 3: Firebase Hosting

**Recommended if using Firebase heavily**

#### Step 1: Install Firebase Tools
```bash
npm install -g firebase-tools
firebase login
firebase init
```

#### Step 2: Deploy
```bash
firebase deploy
```

#### Step 3: Create Cloud Function

Set up a Cloud Function following Firebase documentation

---

## ⚠️ CRITICAL: Security Warning

**The Firebase keys in the guide are EXPOSED in previous commits!**

You MUST:

1. **Regenerate your Firebase API keys immediately**
   - Go to: https://console.firebase.google.com
   - Select zerowait-c21fc project
   - Go to Project Settings → Service Accounts
   - Create new private key

2. **Revoke the old keys** before deploying to production

3. **Update environment variables** with new keys

---

## Testing the Deployment

Once deployed to your platform:

1. Visit your new domain (e.g., zerowait.vercel.app)
2. Click "Provider Signup"
3. Create an account with:
   - Email: test@example.com
   - Password: TestPassword123
4. Click "Create Account"
5. You should see success message
6. Go to Login page
7. Login with same credentials
8. Should redirect to provider dashboard

---

## Troubleshooting

### "Unable to initialize authentication"

**Issue:** Firebase config endpoint not found

**Solutions:**
- Verify `/api/firebase-config` endpoint exists
- Check environment variables are set
- Ensure backend is deployed
- Check browser console for CORS errors

### "User not found"

**Issue:** Email not registered in Firebase

**Solutions:**
- Verify you created account (not just tried to login)
- Try signup first
- Check email spelling

### Login redirects to wrong page

**Issue:** Role detection failing

**Solutions:**
- Verify Firebase Auth is working
- Check user data in Firebase Console
- Ensure Realtime Database rules allow read access

---

## Next Steps After Deployment

1. ✅ Deploy to Vercel/Netlify/Firebase
2. ✅ Setup environment variables
3. ✅ Test login/signup flow
4. 📋 Setup Firebase Realtime Database
5. 📋 Configure database security rules
6. 📋 Setup email verification (optional)
7. 📋 Implement password reset (optional)
8. 📋 Monitor Firebase usage and costs

---

## Support Resources

- Vercel Documentation: https://vercel.com/docs
- Netlify Documentation: https://docs.netlify.com
- Firebase Documentation: https://firebase.google.com/docs
- Firebase Setup Guide: See FIREBASE_SETUP_GUIDE.md

---

**Status:** Frontend is ready. Backend deployment needed to enable authentication.

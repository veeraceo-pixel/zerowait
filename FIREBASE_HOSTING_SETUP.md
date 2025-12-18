# Firebase Hosting Setup Guide for ZeroWait

## Quick Start: Deploy Your Website in 5 Minutes

You already have a Firebase account, so deploying to Firebase Hosting is the easiest solution!

## Prerequisites

✅ Firebase account (you already have this)
✅ Firebase project (zerowait-c21fc)
✅ Node.js installed (v18 or higher)
✅ npm installed

## Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

Verify installation:
```bash
firebase --version
```

## Step 2: Login to Firebase

```bash
firebase login
```

This will open your browser to authenticate. Click "Allow" to authorize Firebase CLI.

## Step 3: Initialize Firebase Project

**IMPORTANT:** Do this in your project directory (where firebase.json is located)

```bash
firebase init
```

When prompted:
- **Which features do you want to set up?** → Select:
  - Hosting
  - Functions
- **Select a default Firebase project:** → Choose `zerowait-c21fc`
- **What do you want to use as your public directory?** → `.` (current directory)
- **Configure as a single-page app?** → `y` (yes)
- **Set up automatic builds and deploys with GitHub?** → `n` (no)
- **Install dependencies now?** → `y` (yes)

## Step 4: Set Environment Variables

You need to add your Firebase credentials as environment variables so they can be used by Cloud Functions.

### Option A: Using Firebase Console (Recommended)

1. Go to: https://console.firebase.google.com
2. Select your project: `zerowait-c21fc`
3. Go to **Build** → **Functions**
4. Click on the `api` function (after deployment)
5. Click **Runtime settings** tab
6. Under **Runtime environment variables**, add:

```
FIREBASE_API_KEY = AIzaSyAJFGE5OFfn-OhDNJ_rWO5oi2d2CHl2fXE
FIREBASE_AUTH_DOMAIN = zerowait-c21fc.firebaseapp.com
FIREBASE_PROJECT_ID = zerowait-c21fc
FIREBASE_STORAGE_BUCKET = zerowait-c21fc.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID = 839269113134
FIREBASE_APP_ID = 1:839269113134:web:0411874b0e248a2a102ebf
```

7. Click Save

### Option B: Using Local .env File (For Testing)

Create a `.env` file in the `functions` directory:

```bash
cat > functions/.env << 'EOF'
FIREBASE_API_KEY=AIzaSyAJFGE5OFfn-OhDNJ_rWO5oi2d2CHl2fXE
FIREBASE_AUTH_DOMAIN=zerowait-c21fc.firebaseapp.com
FIREBASE_PROJECT_ID=zerowait-c21fc
FIREBASE_STORAGE_BUCKET=zerowait-c21fc.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=839269113134
FIREBASE_APP_ID=1:839269113134:web:0411874b0e248a2a102ebf
EOF
```

## Step 5: Deploy to Firebase Hosting

```bash
firebase deploy
```

This will:
1. Deploy your static files to Firebase Hosting
2. Deploy Cloud Functions
3. Set up rewriting rules

**Output will show:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/zerowait-c21fc
Hosting URL: https://zerowait-c21fc.web.app
```

## Step 6: Test Your Deployment

1. Open your Hosting URL: `https://zerowait-c21fc.web.app`
2. The main page should load
3. Click "Provider Signup"
4. Try signing up with:
   - Email: test@example.com
   - Password: TestPassword123
5. You should see a success message
6. Click "Go to Login"
7. Login with same credentials
8. You should be redirected to the provider dashboard

## Troubleshooting

### Error: "Unable to initialize authentication"

**Cause:** Cloud Function not deployed or environment variables not set

**Solution:**
1. Check Cloud Function status: `firebase functions:list`
2. Verify environment variables are set in Firebase Console
3. Check function logs: `firebase functions:log`

### Error: "firebase command not found"

**Solution:**
```bash
npm install -g firebase-tools
```

### Error: "Project not found"

**Solution:**
```bash
firebase projects:list
firebase use zerowait-c21fc
```

### Error: "Missing Firebase configuration"

**Cause:** Environment variables not set on Cloud Function

**Solution:**
1. Go to Firebase Console → Functions → api
2. Click "Runtime settings"
3. Add environment variables
4. Redeploy: `firebase deploy --only functions`

## Update & Redeploy

Whenever you make changes:

```bash
firebase deploy
```

Or deploy only specific parts:
```bash
firebase deploy --only hosting
firebase deploy --only functions
```

## Custom Domain

To use a custom domain:

1. Go to Firebase Console → Hosting
2. Click "Connect domain"
3. Follow the wizard
4. Update your domain's DNS settings

## Monitoring

View live logs:
```bash
firebase functions:log
```

View hosting analytics:
1. Firebase Console → Hosting
2. See traffic and performance metrics

## Security Notes

⚠️ **REGENERATE YOUR FIREBASE KEYS IMMEDIATELY**

Your old keys were exposed in GitHub commits. Do this NOW:

1. Go to: https://console.firebase.google.com
2. Project Settings → Service Accounts
3. Create new private key
4. Replace old keys with new ones
5. Delete old keys

## Next Steps

✅ Deploy to Firebase Hosting
✅ Set environment variables
✅ Test login/signup
✅ Regenerate Firebase keys
✅ Monitor in Firebase Console

## Support

- Firebase Hosting Docs: https://firebase.google.com/docs/hosting
- Cloud Functions Docs: https://firebase.google.com/docs/functions
- Deploy Documentation: https://firebase.google.com/docs/cli/deploy

**Your website is ready to deploy!** 🚀

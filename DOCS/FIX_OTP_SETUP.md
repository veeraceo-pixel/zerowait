# skipQs — Fix: Magic Link / Email OTP Not Working

## Root Cause
By default Supabase sends a **magic link** (clickable URL) not a **6-digit code**.
The signup page expects a 6-digit numeric code in the OTP boxes — so users never
see a code, or click a link that doesn't match what the form expects.

## Fix: Enable Email OTP in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/idcrplpiokodcanjfolf/auth/providers
2. Click **Email** provider
3. Scroll to **"OTP Expiry"** section
4. Enable **"Email OTP"** (this makes Supabase send a 6-digit code instead of a magic link)
5. Set OTP expiry to **600 seconds** (10 minutes) — long enough for users to check email
6. Click **Save**

## Also check: Email Templates
Go to: Authentication → Email Templates → "Magic Link"
Make sure the template says something like:
> "Your verification code is: {{ .Token }}"

NOT a clickable link. If it shows a link template, change it to show the token number.

## Also check: SMTP Settings
If you're using Supabase's built-in email, it has a limit of **3 emails per hour** on the free tier.
For production, set up custom SMTP:
Authentication → Settings → SMTP Settings
Use SendGrid, Resend, or Mailgun (all have free tiers).

## Testing
After enabling OTP:
1. Go to skipqs.com/signup.html
2. Enter name + email → Send Verification Code
3. Check email — you should now receive a 6-digit code (not a link)
4. Enter the 6 digits → account created

## For the Login OTP (existing users)
Same setting applies — the "Sign in with email code" button on login.html
also uses signInWithOtp and needs Email OTP enabled to send a code.

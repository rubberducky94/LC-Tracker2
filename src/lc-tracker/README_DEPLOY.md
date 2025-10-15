Fixing "Firebase not configured" on build

1. Create a `.env.local` file in the `lc-tracker` folder by copying `.env.local.example`:

   cp .env.local.example .env.local

2. Fill the values with your Firebase project's settings (find them in Firebase console > Project settings > General > Your apps > SDK config).

3. Rebuild the app and redeploy:

   npm ci
   npm run build
   cd ..
   firebase deploy --only hosting

4. If you prefer a quick test without config, open the app and click "Continue without signing in". That runs in fallback mode but disables server-side sign-up/login.

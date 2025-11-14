✅ Mobile - Refresh button appears ABOVE the action buttons, aligned to the right# Render Deployment Guide for MSEC Academics

## 🚀 Current Deployment
- **Backend URL**: https://academics-su1d.onrender.com
- **Service Type**: Web Service (Node.js)

## 📋 Environment Variables Required

Add these in Render Dashboard → Environment:

```bash
# MongoDB
MONGODB_URI=mongodb+srv://msecconnect:Msec%402030@msecconnect.rsrf96t.mongodb.net/msec_academics?retryWrites=true&w=majority

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=AC78ab80a8ffb487e6fc57e014c70c0c12
TWILIO_AUTH_TOKEN=a8b9c3ebd2c73c4e8df432ee207fbf7c
TWILIO_WHATSAPP_NUMBER=+14155238886

# VAPID Keys (Web Push Notifications)
VAPID_PUBLIC_KEY=BNXMVwI8R-PuzGOKEe3xNqvhJLKZPl4XvVx6eH-oWJNyY9tDZ8qN_5LkR7VmP3QwX2Yz4KfN6Tp8Ur9Ss1Wv2Xo
VAPID_PRIVATE_KEY=your-vapid-private-key-here
VAPID_SUBJECT=mailto:admin@msec.edu.in

# Node Environment
NODE_ENV=production

# Optional: Signature URLs
PRINCIPAL_SIGNATURE_URL=https://your-cdn.com/signatures/principal.png
```

## 🔧 Build & Start Commands

### Build Command
```bash
npm install
```

### Start Command
```bash
node server.js
```

## 🎨 Puppeteer/Chrome Setup for PDF Generation

Render needs special configuration for Puppeteer to work:

### 1. Add Buildpack (Method 1 - Recommended)
In Render Dashboard:
1. Go to your service settings
2. Scroll to "Build & Deploy" section
3. Add this to **Build Command**:
```bash
npm install && npx @puppeteer/browsers install chrome@stable --path /opt/render/.cache
```

### 2. Environment Variable for Chrome
Add this environment variable:
```bash
PUPPETEER_EXECUTABLE_PATH=/opt/render/.cache/chrome/linux-*/chrome-linux*/chrome
```

### 3. Alternative: Use Dockerfile (Method 2)
If buildpack doesn't work, create a `Dockerfile`:

```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 3001

# Start application
CMD ["node", "server.js"]
```

Then in Render, select "Docker" as the environment instead of "Node".

## 🐛 Troubleshooting

### PDF Generation Fails
**Error**: `Could not find Chrome (ver. 127.0.6533.88)`

**Solution**: Make sure Puppeteer is installed and Chrome is available:
- Check build logs for Chrome installation
- Verify `PUPPETEER_EXECUTABLE_PATH` is set correctly
- Try the Dockerfile approach if buildpack fails

### Twilio Warnings
**Error**: `Twilio credentials not found`

**Solution**: Add all Twilio environment variables in Render dashboard

### MongoDB Connection Issues
**Error**: `MongooseError: Operation buffering timed out`

**Solution**: 
- Check MongoDB Atlas whitelist (allow 0.0.0.0/0 for development)
- Verify `MONGODB_URI` is correct
- Ensure MongoDB Atlas cluster is running

## 📊 Monitoring

### Check Logs
```bash
# In Render Dashboard, go to "Logs" tab
# Or use Render CLI:
render logs --service academics-su1d
```

### Health Check Endpoint
```
GET https://academics-su1d.onrender.com/
```

Should return: `{"status":"ok","message":"MSEC Academics API is running"}`

## 🔄 Redeployment

### Manual Redeploy
1. Push changes to GitHub
2. Render auto-deploys (if connected to repo)
3. Or click "Manual Deploy" in Render dashboard

### Clear Build Cache
If dependencies are stuck:
1. Go to Settings → Build & Deploy
2. Click "Clear build cache & deploy"

## 📝 Notes

- **Free Tier**: Service spins down after 15 minutes of inactivity
- **Startup Time**: First request may take 30-60 seconds (cold start)
- **PDF Generation**: Requires Chrome/Chromium (see Puppeteer setup above)
- **Memory Limit**: Free tier has 512MB RAM limit
- **Build Time**: ~2-3 minutes including Chrome installation

## ✅ Verification Checklist

- [ ] All environment variables added
- [ ] Build succeeds without errors
- [ ] Service shows "Live" status
- [ ] Health check endpoint responds
- [ ] MongoDB connection works
- [ ] Twilio WhatsApp sends messages
- [ ] PDF generation works (Chrome installed)
- [ ] CORS allows Vercel frontend
- [ ] Push notifications configured

## 🔗 Useful Links

- [Render Dashboard](https://dashboard.render.com/)
- [Puppeteer on Render](https://render.com/docs/deploy-puppeteer)
- [MongoDB Atlas](https://cloud.mongodb.com/)
- [Twilio Console](https://console.twilio.com/)

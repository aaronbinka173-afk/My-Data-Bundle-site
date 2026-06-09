# 🚀 Mac Data Hub: Namecheap.com Custom Hosting & Domain Deployment Guide

This guide describes how to deploy **Mac Data Hub** on your custom domain using **Namecheap hosting** (either a **cPanel Shared/Business Hosting Package** or a **Namecheap VPS/Dedicated Server**). 

The platform is designed to run in full production mode seamlessly once deployed. Below are the precise steps to get up and running:

---

## 📂 Architecture Overview
Mac Data Hub is a full-stack application:
- **Frontend**: A highly polished React app bundled using **Vite** and styled with **Tailwind CSS**.
- **Backend**: A resilient **Node.js Express Server** (`server.ts`/`dist/server.cjs`).
- **Database Options**:
  1. **Firebase Firestore** (Recommended for live custom domains: completely free, fast, zero maintenance, and highly resilient).
  2. **PostgreSQL DB** (Great if you have a cPanel PostgreSQL database).
  3. **JSON local persistent file** (cPanel fallback, write-permission required in root directory).

---

## 🛠️ Method A: Deploying on Namecheap cPanel Shared Hosting (NodeJS Selector)

Most Namecheap clients use Shared Hosting (Stellar, Stellar Plus, or Stellar Business) which includes the graphic **cPanel Interface**.

### 1. Build the Production Bundle Locally
Before uploading your code, compile the application into its optimized static and server outputs. Run the following command in the terminal inside your workspace:
```bash
npm run build
```
This compiles everything under:
- `dist/` (contains all frontend production assets: `index.html`, CSS, icons)
- `dist/server.cjs` (contains your bundled standalone Express backend)

### 2. Compress & Upload Files
1. Compress your workspace folder (excluding `node_modules` and local database cache files) into a `.zip` archive.
2. In Namecheap cPanel, open **File Manager** and upload the `.zip` file into your home directory (e.g., `/home/username/mac-data-hub`), **not** directly inside `public_html`.
3. Extract the archive.

### 3. Setup NodeJS App in cPanel
1. Scroll down to the **Software** section in your Namecheap cPanel, and click **Setup Node.js App**.
2. Click **Create Application**.
3. Configure the following values:
   - **Node.js version**: Select `20.x` or higher.
   - **Application Mode**: Change from `Development` to `Production`.
   - **Application Root**: Enter the folder path where you extracted the code (e.g., `mac-data-hub`).
   - **Application URL**: Select your new custom domain name registered with Namecheap (e.g., `yourdomain.com`).
   - **Application startup file**: Enter `dist/server.cjs` (the bundled compiled Node server).
4. Click **Create**.
5. Once created, cPanel will display a command to enter your virtual environment. Copy it for terminal usage if needed.

### 4. Provide Environment Secrets in Namecheap cPanel
Under the Node.js App configuration page, scroll down to the **Environment Variables** cards to securely enter the following credentials:
- `NODE_ENV` = `production`
- `JWT_SECRET` = `Enter_a_highly_secure_random_string`
- `GEMINI_API_KEY` = `Your_Google_AI_Studio_Gemini_Key` (For live AI user assistance)

#### To run with Firebase Firestore (Highly Recommended):
- Ensure `firestore.rules` is deployed.
- Ensure `firebase-applet-config.json` is populated within the application directory.

#### To run with PostgreSQL:
- `DATABASE_URL` = `postgresql://your_cpanel_db_username:password@localhost:5432/your_db_name`

---

## 🖥️ Method B: Deploying on a Namecheap VPS (Virtual Private Server)

If you are using a Namecheap VPS with Ubuntu/Debian, follow these streamlined terminal commands:

### 1. Install Node.js & PM2 (Process Manager)
```bash
# Update server
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify install
node -v && npm -v

# Install PM2 to keep backend running 24/7
sudo npm install -g pm2
```

### 2. Configure PM2 for Automatic Reboots
Deploy your build files, run `npm install --omit=dev`, then kick off PM2:
```bash
# Start your production server
pm2 start dist/server.cjs --name "mac-data-hub"

# Set PM2 to automatically restore upon VPS reboots
pm2 startup
pm2 save
```

### 3. Reverse Proxy with Nginx & Namecheap Domain Mapping
Configure Nginx to route external requests from port 80/443 directly to port 3000:
```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/default
```

Replace the server block with:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $http_host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Reload Nginx:
```bash
sudo systemctl restart nginx
```

---

## 🔒 Step C: Setup Free SSL Certificates with Namecheap

Customers in Ghana expect a secure Padlock icon and `https://` during Mobile Money (Momo) checkout.

### If using Namecheap cPanel Shared Hosting:
1. In cPanel, search for **Namecheap SSL** or **AutoSSL**.
2. Click **Run AutoSSL**. This will automatically provision a free Let's Encrypt or Sectigo certificate mapping directly to your new domain name.
3. Turn on the **Force HTTPS Redirection** toggle.

### If using Namecheap VPS:
Run **Certbot** to automatically implement HTTPS:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## ⚡ Method D: Deploying on Vercel.com (Serverless Mode)

Vercel is a serverless hosting provider. Because it operates dynamically across transient function containers, long-running background Node processes or local filesystems (like local database `.json` caches) are reset dynamically. 

By adding our native serverless routing configuration, **your backend API routes will run automatically on Vercel** as Serverless Functions, mapping `/api/*` perfectly using Vercel.

### 1. Requirements Checklist
- **Database**: You **MUST** use **Firebase Firestore** as your database on Vercel, as local JSON files will reset on every serverless execution.
- **Firebase Configuration**: Provide your Firebase config safely in the Vercel dashboard (see Step 3).

### 2. Prepare Code and Deploy
1. Ensure `vercel.json` exists in the root folder of your project (this has been created for you).
2. Ensure `/api/index.ts` is present in your code.
3. Commit and push your code to your GitHub / Git repository, and link it inside your **Vercel Dashboard**.

### 3. Set Up Vercel Environment Variables
Under your project settings inside Vercel (`vercel.com/dashboard -> Project -> Settings -> Environment Variables`), add the following:
- `NODE_ENV` = `production`
- `JWT_SECRET` = `Your_Highly_Secure_JWT_Secret_String`
- `FIREBASE_CONFIG` = `{ "apiKey": "...", "authDomain": "...", "projectId": "...", "storageBucket": "...", "messagingSenderId": "...", "appId": "..." }`
  *(Tip: Open your `firebase-applet-config.json` file, copy everything, and paste it as a single string inside Vercel as `FIREBASE_CONFIG` value).*
- `GEMINI_API_KEY` = `Your_Google_AI_Studio_Gemini_Key`
- Any active SMS Gateway keys (e.g. `ARKESEL_API_KEY`, etc.)

---

## ⚙️ Post-Deployment Live Activation Checklist (Going Live)

Once your custom domain has loaded:
1. Log in to the **Administrator Dashboard** using your owner email account.
2. Scroll to the bottom setup cards and click **🧹 Wipe Demo Data (Go Live)** to completely clean out test mock entries, simulated telemetry logs, and test reseller balances. This will securely trigger Live mode!
3. Input your real **Paystack Secret API Key** or **Flutterwave Secret API Keys** inside the payment configuration menu.
4. Input your real **SubAndGain API Token** and configure your base packages to start collecting real profits in GHS!

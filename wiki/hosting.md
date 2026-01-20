# Hosting

galerie generates fully static sites that can be hosted anywhere static files are served. This guide covers common hosting options and their configuration.

This guide assumes you're using the **fancy** theme (the default). Other themes may produce different output structures.

## Output Structure

After running galerie with the fancy theme, your `dist/` directory contains:

```
dist/
├── index.html                              # Single page application entry point
├── images/                                 # All processed images
│   ├── {stem}-{hash}-micro.webp            # Micro thumbnails (filmstrip)
│   ├── {stem}-{hash}-thumb.webp            # Grid thumbnails
│   ├── {stem}-{hash}-full.webp             # Full-size web images
│   └── {stem}-{hash}-original[-nogps].jpg  # Original files
└── static/
    ├── app-{hash}.js                       # Application JavaScript
    ├── style-{hash}.css                    # Stylesheet
    ├── gallery-{hash}.json                 # Photo metadata
    └── i18n/
        ├── en-{hash}.json                  # English translations
        ├── fr-{hash}.json                  # French translations
        └── ...                             # 20 languages total
```

All assets use content-hashed filenames (e.g., `app-3ae6aadb.js`) for cache-busting. When you rebuild, only changed files get new hashes.

### Source Maps (Debug Builds)

When building with `--source-maps`, additional files are included for debugging:

```
dist/
└── static/
    ├── app-{hash}.js
    ├── app.js.map                          # JavaScript source map (no hash)
    ├── style-{hash}.css
    └── style.css.map                       # CSS source map (no hash)
```

Source maps allow browser developer tools to show original source code when debugging. Note that `.map` files do **not** have content hashes in their filenames - they use fixed names like `app.js.map`.

**Important**: Source maps are intended for **local debugging only**. They expose your source code structure, which you may not want publicly accessible. See the [Source Maps in Production](#source-maps-in-production) section for configuration options if you choose to deploy them.

### Theme Differences

Different themes produce different outputs:

| Theme | Output | Routing |
|-------|--------|---------|
| **fancy** (default) | Single `index.html` SPA | Hash-based (`/#/photo/DSC01234`) |
| **basic** | Per-album and per-photo HTML files | File-based (`/album/photo.html`) |

The fancy theme uses hash-based client-side routing, so all navigation happens within `index.html`. The basic theme generates individual HTML files for each album and photo.

## Caching Strategy

galerie's build output is designed for optimal caching:

| Path Pattern | Cache Duration | Reason |
|--------------|----------------|--------|
| `static/*` | 1 year | Content-hashed filenames |
| `images/*` | 1 year | Content-hashed filenames |
| `index.html` | No cache | Entry point, references hashed assets |
| `*.map` | Block or no cache | Source maps (debug only, no hash) |

Since all assets in `static/` and `images/` have content hashes in their filenames, they can be cached indefinitely. The `index.html` file should never be cached - it's small, and ensuring browsers always fetch the latest version means updates are reflected immediately.

### Source Maps in Production

Source maps (`.map` files) are an exception to the caching rules. Unlike other static assets, they:
- Do **not** have content hashes in their filenames
- Expose your source code structure to anyone who requests them

**Recommended approach**: Don't deploy source maps to production. Only use `--source-maps` for local debugging.

If you must deploy with source maps (e.g., for production debugging), you have two options:

1. **Block access** (recommended) - Return 403 Forbidden for `.map` files. This prevents exposing your source code while allowing you to manually access them via SSH if needed.

2. **Serve with no-cache** - If you need browser access to source maps, serve them with `no-cache` headers since they don't have content hashes. Be aware this exposes your code publicly.

The web server configurations below include commented rules for both approaches.

## AWS S3

S3 with static website hosting is a cost-effective option for photo galleries.

### Basic Setup

1. **Create an S3 bucket** named after your domain (e.g., `photos.example.com`)

2. **Enable static website hosting**:
   - Go to bucket Properties → Static website hosting
   - Enable it
   - Set Index document: `index.html`
   - Set Error document: `index.html` (required for SPA routing)

3. **Configure bucket policy** for public access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::photos.example.com/*"
       }
     ]
   }
   ```

4. **Disable "Block Public Access"** settings that would prevent the policy above.

5. **Upload your site**:
   ```bash
   aws s3 sync dist/ s3://photos.example.com/ --delete
   ```

### Setting Cache Headers

Use the `--cache-control` flag when uploading:

```bash
#!/bin/bash
BUCKET="photos.example.com"

# Upload content-hashed assets with long cache (1 year)
# Exclude source maps (they don't have hashes and shouldn't be public)
aws s3 sync dist/static/ s3://$BUCKET/static/ \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.map"

aws s3 sync dist/images/ s3://$BUCKET/images/ \
  --cache-control "public, max-age=31536000, immutable"

# Upload index.html with no cache
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Optional: If you need source maps accessible (not recommended for production),
# upload them separately with no-cache:
# aws s3 sync dist/static/ s3://$BUCKET/static/ \
#   --cache-control "no-cache, no-store, must-revalidate" \
#   --exclude "*" --include "*.map"
```

### Custom Domain with Route 53

1. Create a Route 53 hosted zone for your domain
2. Add an A record as an "Alias" pointing to your S3 website endpoint
3. The S3 bucket name must match the domain name exactly

## Google Cloud Storage (GCS)

GCS provides similar static hosting capabilities to S3.

### Basic Setup

1. **Create a bucket**:
   ```bash
   gsutil mb gs://photos.example.com
   ```

2. **Enable website configuration**:
   ```bash
   gsutil web set -m index.html -e index.html gs://photos.example.com
   ```

3. **Make bucket publicly readable**:
   ```bash
   gsutil iam ch allUsers:objectViewer gs://photos.example.com
   ```

4. **Upload your site**:
   ```bash
   gsutil -m rsync -r -d dist/ gs://photos.example.com/
   ```

### Setting Cache Headers

```bash
# Set long cache for content-hashed assets
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "gs://photos.example.com/static/**"

gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "gs://photos.example.com/images/**"

# Disable cache for index.html
gsutil setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" \
  "gs://photos.example.com/index.html"

# If source maps exist, delete them (recommended) or set no-cache
gsutil -m rm "gs://photos.example.com/static/*.map" 2>/dev/null || true

# Alternative: If you need source maps accessible (not recommended for production)
# gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" \
#   "gs://photos.example.com/static/*.map"
```

### Custom Domain

1. Verify domain ownership in Google Search Console
2. Create a CNAME record pointing to `c.storage.googleapis.com`
3. The bucket name must match the domain name exactly

## nginx

nginx is ideal for self-hosted deployments with full control over caching and compression.

### Basic Configuration

```nginx
server {
    listen 80;
    server_name photos.example.com;
    root /var/www/photos.example.com;

    # Enable gzip compression
    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1000;

    # SPA routing: serve index.html for all non-file requests
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long cache for content-hashed assets
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /images/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for index.html
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Source maps (if deployed with --source-maps)
    # Option A: Block access (recommended - prevents exposing source code)
    location ~* \.map$ {
        return 403;
    }

    # Option B: Serve with no-cache (use instead of Option A if you need browser access)
    # location ~* \.map$ {
    #     expires -1;
    #     add_header Cache-Control "no-cache, no-store, must-revalidate";
    # }
}
```

### With HTTPS (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d photos.example.com
```

Certbot will automatically modify your nginx configuration to enable HTTPS.

### Deployment

```bash
# Copy files to server
rsync -avz --delete dist/ user@server:/var/www/photos.example.com/
```

## Apache

Apache httpd configuration for static photo galleries.

### Basic Configuration

Create or edit `.htaccess` in your document root, or add to your virtual host configuration:

```apache
# Enable rewrite engine for SPA routing
RewriteEngine On

# Serve existing files directly
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Route all other requests to index.html
RewriteRule ^ /index.html [L]

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

# Cache control
<IfModule mod_expires.c>
    ExpiresActive On

    # Long cache for content-hashed assets
    <FilesMatch "\.(js|css|webp|jpg|jpeg|png|gif)$">
        ExpiresDefault "access plus 1 year"
        Header set Cache-Control "public, immutable"
    </FilesMatch>

    # No cache for index.html
    <Files "index.html">
        ExpiresDefault "access"
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </Files>

    # Source maps (if deployed with --source-maps)
    # Option A: Block access (recommended - prevents exposing source code)
    <FilesMatch "\.map$">
        Require all denied
    </FilesMatch>

    # Option B: Serve with no-cache (use instead of Option A if you need browser access)
    # <FilesMatch "\.map$">
    #     ExpiresDefault "access"
    #     Header set Cache-Control "no-cache, no-store, must-revalidate"
    # </FilesMatch>
</IfModule>
```

### Virtual Host Configuration

```apache
<VirtualHost *:80>
    ServerName photos.example.com
    DocumentRoot /var/www/photos.example.com

    <Directory /var/www/photos.example.com>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Required Modules

Ensure these Apache modules are enabled:

```bash
sudo a2enmod rewrite
sudo a2enmod expires
sudo a2enmod headers
sudo a2enmod deflate
sudo systemctl restart apache2
```

## Cloudflare

Cloudflare provides CDN, caching, and DDoS protection in front of any origin server.

### Setup

1. **Add your site to Cloudflare**:
   - Sign up at cloudflare.com
   - Add your domain
   - Update your domain's nameservers to Cloudflare's

2. **Configure DNS**:
   - Add an A record pointing to your origin server
   - Enable the orange cloud (proxy) for CDN benefits

3. **Enable HTTPS**:
   - SSL/TLS → Overview → Set to "Full (strict)" if your origin has a valid certificate
   - Or use "Flexible" if your origin is HTTP-only (less secure)

### Cache Rules

Cloudflare respects `Cache-Control` headers from your origin, but you can override them with Cache Rules for more control.

Go to **Caching → Cache Rules** and create rules:

**Rule 1: Block source maps (if deployed)**
- If: URI Path ends with `.map`
- Then:
  - Cache eligibility: Bypass cache

Note: Cloudflare Cache Rules can't return 403 directly. To block source maps at the edge, use a WAF Custom Rule instead (Security → WAF → Custom Rules) with action "Block".

**Rule 2: Long cache for content-hashed assets**
- If: URI Path starts with `/static/` OR URI Path starts with `/images/`
- Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: Override → 1 year
  - Browser TTL: Override → 1 year

**Rule 3: No cache for index.html**
- If: URI Path equals `/` OR URI Path equals `/index.html`
- Then:
  - Cache eligibility: Bypass cache

### Page Rules (Legacy)

If using Page Rules instead of Cache Rules:

| URL Pattern | Setting |
|-------------|---------|
| `photos.example.com/static/*` | Cache Level: Cache Everything, Edge Cache TTL: 1 month |
| `photos.example.com/images/*` | Cache Level: Cache Everything, Edge Cache TTL: 1 month |

### Performance Settings

Recommended settings under **Speed → Optimization**:

- **Auto Minify**: Enable for JavaScript, CSS, HTML
- **Brotli**: Enable (better compression than gzip)
- **Early Hints**: Enable
- **Rocket Loader**: Disable (can interfere with SPA JavaScript)

### Purging Cache

With the cache rules above, `index.html` bypasses the cache entirely, so no purging is needed after deployments. Updates are reflected immediately.

If you do need to purge other files for some reason:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Or in the dashboard: **Caching → Configuration → Purge Cache**

## Cloudflare R2 + Workers

For a fully Cloudflare-native solution, you can use R2 (S3-compatible storage) with Workers.

### Setup

1. Create an R2 bucket in the Cloudflare dashboard
2. Upload your site:
   ```bash
   # Using rclone (after configuring R2 remote)
   rclone sync dist/ r2:photos-bucket/
   ```
3. Create a Worker to serve from R2:
   ```javascript
   export default {
     async fetch(request, env) {
       const url = new URL(request.url);
       let path = url.pathname.slice(1) || 'index.html';

       // Block source maps (recommended - prevents exposing source code)
       if (path.endsWith('.map')) {
         return new Response('Forbidden', { status: 403 });
       }

       const object = await env.BUCKET.get(path);
       if (!object) {
         // SPA fallback: serve index.html for unknown routes
         const fallback = await env.BUCKET.get('index.html');
         return new Response(fallback.body, {
           headers: { 'Content-Type': 'text/html' }
         });
       }

       // Content-hashed assets can be cached forever
       const isHashed = path.startsWith('static/') || path.startsWith('images/');
       return new Response(object.body, {
         headers: {
           'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
           'Cache-Control': isHashed
             ? 'public, max-age=31536000, immutable'
             : 'no-cache, no-store, must-revalidate'
         }
       });
     }
   };
   ```

## Raspberry Pi with Cloudflare Tunnels

This section walks through hosting your gallery on a Raspberry Pi at home, using Cloudflare Tunnels to make it accessible from the internet. This approach:

- Requires no port forwarding on your router
- Works behind NAT, CGNAT, or dynamic IP addresses
- Keeps your Pi hidden behind Cloudflare's network
- Provides free HTTPS and DDoS protection

### Prerequisites

Before starting, you need:

1. **A Raspberry Pi** with Raspberry Pi OS installed (this guide uses Bookworm)
2. **A domain name** added to your Cloudflare account (free tier works fine)
3. **Your gallery built** and copied to the Pi

### Step 1: Check Your Pi's Architecture

First, determine if your Pi runs 32-bit or 64-bit:

```bash
uname -m
```

- If it shows `aarch64` → You have 64-bit (Pi 3, 4, 5 with 64-bit OS)
- If it shows `armv7l` → You have 32-bit (older Pi or 32-bit OS)

Remember this for Step 3.

### Step 2: Install nginx

nginx will serve your gallery files locally. The Cloudflare tunnel will connect to nginx.

```bash
sudo apt update
sudo apt install nginx
```

Verify it's running:

```bash
sudo systemctl status nginx
```

You should see "active (running)" in green.

### Step 3: Install cloudflared

Add Cloudflare's package repository and install cloudflared:

```bash
# Create keyring directory
sudo mkdir -p --mode=0755 /usr/share/keyrings

# Download Cloudflare's GPG key
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

# Add the repository (use 'bookworm' for current Raspberry Pi OS)
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install cloudflared
sudo apt update
sudo apt install cloudflared
```

Verify installation:

```bash
cloudflared --version
```

### Step 4: Create a Tunnel in Cloudflare Dashboard

This is the easiest method. Do these steps on any computer with a web browser:

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Sign in with your Cloudflare account
3. In the left sidebar, go to **Networks** → **Tunnels**
4. Click **Create a tunnel**
5. Select **Cloudflared** as the connector type
6. Give your tunnel a name (e.g., `photos-pi`)
7. Click **Save tunnel**

You'll see a page with installation instructions. **Don't close this page yet** - you need the command shown.

### Step 5: Connect Your Pi to the Tunnel

On the Cloudflare dashboard, you'll see a command that looks like this:

```bash
sudo cloudflared service install eyJhIjoiYWJjZGVm...
```

The long string is your unique tunnel token. **Copy the entire command** and run it on your Raspberry Pi.

This command:
- Installs cloudflared as a system service
- Configures it to connect to your tunnel
- Sets it to start automatically on boot

After running the command, go back to the Cloudflare dashboard and click **Next**.

### Step 6: Route Your Domain to the Tunnel

Still in the Cloudflare dashboard:

1. Under **Public Hostnames**, click **Add a public hostname**
2. Configure the hostname:
   - **Subdomain**: Enter a subdomain (e.g., `photos`) or leave blank for root domain
   - **Domain**: Select your domain from the dropdown
   - **Type**: Select `HTTP`
   - **URL**: Enter `localhost:80`
3. Click **Save hostname**

Your tunnel is now configured to route `photos.yourdomain.com` to nginx on your Pi.

### Step 7: Copy Your Gallery to nginx

Copy your built gallery to nginx's web directory:

```bash
# Remove the default nginx page
sudo rm -rf /var/www/html/*

# Copy your gallery (adjust the source path as needed)
sudo cp -r /path/to/your/gallery/dist/* /var/www/html/
```

Set proper ownership:

```bash
sudo chown -R www-data:www-data /var/www/html
```

### Step 8: Configure nginx

Create a configuration optimized for galerie:

```bash
sudo nano /etc/nginx/sites-available/default
```

Replace the entire contents with:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;

    server_name _;

    # Gzip compression
    gzip on;
    gzip_types text/html text/css application/javascript application/json;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long cache for hashed assets
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /images/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for index.html
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Block source maps (if present)
    location ~* \.map$ {
        return 403;
    }
}
```

Save the file (Ctrl+O, Enter, Ctrl+X) and restart nginx:

```bash
sudo nginx -t          # Test configuration
sudo systemctl restart nginx
```

### Step 9: Test Your Site

Visit your domain in a browser (e.g., `https://photos.yourdomain.com`). Your gallery should load with HTTPS automatically provided by Cloudflare.

### Step 10: Verify Everything Starts on Boot

Reboot your Pi to ensure everything comes back up automatically:

```bash
sudo reboot
```

After a minute or two, check your site again. If it loads, you're all set.

### Updating Your Gallery

When you have new photos to add:

1. Build your gallery on your main computer
2. Copy the new `dist/` folder to your Pi:
   ```bash
   rsync -avz --delete dist/ pi@raspberrypi.local:/tmp/gallery/
   ```
3. SSH into the Pi and copy to nginx:
   ```bash
   ssh pi@raspberrypi.local
   sudo rm -rf /var/www/html/*
   sudo cp -r /tmp/gallery/* /var/www/html/
   sudo chown -R www-data:www-data /var/www/html
   ```

Since `index.html` is never cached, visitors will see the new photos immediately.

### Troubleshooting

**Tunnel shows "Inactive" or "Down" in dashboard**
- Check if cloudflared is running: `sudo systemctl status cloudflared`
- View logs: `sudo journalctl -u cloudflared -f`
- Restart the service: `sudo systemctl restart cloudflared`

**Site not loading but tunnel is healthy**
- Check if nginx is running: `sudo systemctl status nginx`
- Test nginx config: `sudo nginx -t`
- Check nginx logs: `sudo tail -f /var/log/nginx/error.log`

**"502 Bad Gateway" error**
- The tunnel can't reach nginx. Verify nginx is running on port 80
- Check the tunnel's public hostname is set to `localhost:80`

**Changes not appearing**
- Verify files were copied: `ls -la /var/www/html/`
- Check ownership: `ls -la /var/www/html/` should show `www-data`
- Clear browser cache or open in incognito window

## Deployment Script Example

Here's a complete deployment script for S3:

```bash
#!/bin/bash
set -e

BUCKET="photos.example.com"
SITE_DIR="/path/to/gallery"

# Build the site (without --source-maps for production)
galerie -C "$SITE_DIR"

cd "$SITE_DIR/dist"

# Upload content-hashed assets with long cache
# Exclude source maps (they don't have hashes and shouldn't be public)
aws s3 sync static/ s3://$BUCKET/static/ \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.map"

aws s3 sync images/ s3://$BUCKET/images/ \
  --cache-control "public, max-age=31536000, immutable"

# Upload index.html with no cache
aws s3 cp index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

echo "Deployment complete!"
```

## Troubleshooting

### Images not loading
- Check that CORS headers are set if loading images from a different domain
- Verify MIME types are correct (especially for WebP)
- Ensure the `images/` directory was uploaded

### Stale content after deploy
- Verify `index.html` has `no-cache` headers (check with browser dev tools → Network tab)
- If using Cloudflare, ensure the bypass cache rule is active for `/` and `/index.html`
- Content-hashed assets never go stale - new `index.html` automatically references new URLs

### 404 errors on browser refresh
- The fancy theme uses hash-based routing (`/#/photo/...`), so this shouldn't happen
- If using basic theme, ensure all HTML files were uploaded
- Verify error document is set to `index.html` for SPA fallback

### Hash routing not working
- Check browser console for JavaScript errors
- Ensure `app-{hash}.js` loaded successfully
- Verify `gallery-{hash}.json` is accessible

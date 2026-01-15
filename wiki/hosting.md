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
| `index.html` | Short (5 min) | Changes on rebuild |

Since all assets in `static/` and `images/` have content hashes in their filenames, they can be cached indefinitely. Only `index.html` needs a short cache time.

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
aws s3 sync dist/static/ s3://$BUCKET/static/ \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync dist/images/ s3://$BUCKET/images/ \
  --cache-control "public, max-age=31536000, immutable"

# Upload index.html with short cache (5 minutes)
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "public, max-age=300"
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

# Set short cache for index.html
gsutil setmeta -h "Cache-Control:public, max-age=300" \
  "gs://photos.example.com/index.html"
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

    # Short cache for index.html
    location = /index.html {
        expires 5m;
        add_header Cache-Control "public";
    }
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

    # Short cache for index.html
    <Files "index.html">
        ExpiresDefault "access plus 5 minutes"
        Header set Cache-Control "public"
    </Files>
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

**Rule 1: Long cache for content-hashed assets**
- If: URI Path starts with `/static/` OR URI Path starts with `/images/`
- Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: Override → 1 year
  - Browser TTL: Override → 1 year

**Rule 2: Short cache for index.html**
- If: URI Path equals `/` OR URI Path equals `/index.html`
- Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: Override → 5 minutes
  - Browser TTL: Override → 5 minutes

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

After deploying a new version of your gallery:

```bash
# Purge index.html (the only file that needs purging)
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://photos.example.com/index.html"]}'
```

Or in the dashboard: **Caching → Configuration → Purge Cache**

Since all assets have content-hashed filenames, you only need to purge `index.html` after updates. The new `index.html` will reference new asset URLs automatically.

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

       const object = await env.BUCKET.get(path);
       if (!object) {
         // SPA fallback: serve index.html for unknown routes
         const fallback = await env.BUCKET.get('index.html');
         return new Response(fallback.body, {
           headers: { 'Content-Type': 'text/html' }
         });
       }

       const isHashed = path.startsWith('static/') || path.startsWith('images/');
       return new Response(object.body, {
         headers: {
           'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
           'Cache-Control': isHashed
             ? 'public, max-age=31536000, immutable'
             : 'public, max-age=300'
         }
       });
     }
   };
   ```

## Deployment Script Example

Here's a complete deployment script for S3 with Cloudflare:

```bash
#!/bin/bash
set -e

BUCKET="photos.example.com"
CLOUDFLARE_ZONE="your-zone-id"
CLOUDFLARE_TOKEN="your-api-token"
SITE_DIR="/path/to/gallery"

# Build the site
galerie -C "$SITE_DIR"

cd "$SITE_DIR/dist"

# Upload content-hashed assets with long cache
aws s3 sync static/ s3://$BUCKET/static/ \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync images/ s3://$BUCKET/images/ \
  --cache-control "public, max-age=31536000, immutable"

# Upload index.html with short cache
aws s3 cp index.html s3://$BUCKET/index.html \
  --cache-control "public, max-age=300"

# Purge Cloudflare cache for index.html
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://photos.example.com/index.html"]}'

echo "Deployment complete!"
```

## Troubleshooting

### Images not loading
- Check that CORS headers are set if loading images from a different domain
- Verify MIME types are correct (especially for WebP)
- Ensure the `images/` directory was uploaded

### Stale content after deploy
- Purge `index.html` from your CDN cache
- Hard refresh in browser (Ctrl+Shift+R)
- Content-hashed assets don't need purging - new `index.html` references new URLs

### 404 errors on browser refresh
- The fancy theme uses hash-based routing (`/#/photo/...`), so this shouldn't happen
- If using basic theme, ensure all HTML files were uploaded
- Verify error document is set to `index.html` for SPA fallback

### Hash routing not working
- Check browser console for JavaScript errors
- Ensure `app-{hash}.js` loaded successfully
- Verify `gallery-{hash}.json` is accessible

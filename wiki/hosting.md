# Hosting

galerie generates fully static sites that can be hosted anywhere static files are served. This guide covers common hosting options and their configuration.

## Overview

After running galerie, your `dist/` directory contains:
- `index.html` - Main entry point
- `gallery.json` - Photo metadata
- `static/` - Theme assets (CSS, JS) with content-hashed filenames
- `thumbs/` - Thumbnail images
- `full/` - Full-size images
- Album directories with photos and optional HTML pages

### Caching Strategy

galerie's build output is designed for optimal caching:

| Path Pattern | Cache Duration | Reason |
|--------------|----------------|--------|
| `static/*.js`, `static/*.css` | 1 year | Content-hashed filenames |
| `thumbs/*`, `full/*` | 1 year | Content-hashed filenames |
| `index.html`, `gallery.json` | Short (5 min) | Changes on rebuild |
| `*.html` (album/photo pages) | Short (5 min) | Changes on rebuild |

## AWS S3

S3 with static website hosting is a cost-effective option for photo galleries.

### Basic Setup

1. **Create an S3 bucket** named after your domain (e.g., `photos.example.com`)

2. **Enable static website hosting**:
   - Go to bucket Properties → Static website hosting
   - Enable it
   - Set Index document: `index.html`
   - Set Error document: `index.html` (for SPA routing, if using fancy theme)

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
# Upload hashed assets with long cache
aws s3 sync dist/static/ s3://photos.example.com/static/ \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync dist/thumbs/ s3://photos.example.com/thumbs/ \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync dist/full/ s3://photos.example.com/full/ \
  --cache-control "public, max-age=31536000, immutable"

# Upload HTML/JSON with short cache
aws s3 cp dist/index.html s3://photos.example.com/index.html \
  --cache-control "public, max-age=300"

aws s3 cp dist/gallery.json s3://photos.example.com/gallery.json \
  --cache-control "public, max-age=300"

# Upload remaining files
aws s3 sync dist/ s3://photos.example.com/ \
  --exclude "static/*" --exclude "thumbs/*" --exclude "full/*" \
  --exclude "index.html" --exclude "gallery.json" \
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
# Set metadata for hashed assets
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "gs://photos.example.com/static/**"

gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "gs://photos.example.com/thumbs/**"

gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "gs://photos.example.com/full/**"

# Set short cache for HTML/JSON
gsutil -m setmeta -h "Cache-Control:public, max-age=300" \
  "gs://photos.example.com/*.html"

gsutil setmeta -h "Cache-Control:public, max-age=300" \
  "gs://photos.example.com/gallery.json"
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
    gzip_types text/html text/css application/javascript application/json;
    gzip_min_length 1000;

    # Default: serve files directly
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long cache for content-hashed assets
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /thumbs/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /full/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Short cache for HTML and JSON
    location ~* \.(html|json)$ {
        expires 5m;
        add_header Cache-Control "public";
    }

    # Serve images with proper MIME types
    location ~* \.(jpg|jpeg|webp|png|gif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
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

# Or use a deployment script
scp -r dist/* user@server:/var/www/photos.example.com/
```

## Apache

Apache httpd configuration for static photo galleries.

### Basic Configuration

Create or edit `.htaccess` in your document root, or add to your virtual host configuration:

```apache
# Enable rewrite engine (for SPA routing)
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

# Cache control for hashed assets
<IfModule mod_expires.c>
    ExpiresActive On

    # Long cache for static assets
    <FilesMatch "\.(js|css)$">
        ExpiresDefault "access plus 1 year"
        Header set Cache-Control "public, immutable"
    </FilesMatch>

    # Long cache for images
    <FilesMatch "\.(jpg|jpeg|webp|png|gif)$">
        ExpiresDefault "access plus 1 year"
        Header set Cache-Control "public, immutable"
    </FilesMatch>

    # Short cache for HTML and JSON
    <FilesMatch "\.(html|json)$">
        ExpiresDefault "access plus 5 minutes"
        Header set Cache-Control "public"
    </FilesMatch>
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

    # Or inline the .htaccess rules here for better performance
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

**Rule 1: Long cache for hashed assets**
- If: URI Path starts with `/static/` OR URI Path starts with `/thumbs/` OR URI Path starts with `/full/`
- Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: Override → 1 year
  - Browser TTL: Override → 1 year

**Rule 2: Short cache for HTML/JSON**
- If: URI Path ends with `.html` OR URI Path ends with `.json`
- Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: Override → 5 minutes
  - Browser TTL: Override → 5 minutes

### Page Rules (Legacy)

If using Page Rules instead of Cache Rules:

| URL Pattern | Setting |
|-------------|---------|
| `photos.example.com/static/*` | Cache Level: Cache Everything, Edge Cache TTL: 1 month |
| `photos.example.com/thumbs/*` | Cache Level: Cache Everything, Edge Cache TTL: 1 month |
| `photos.example.com/full/*` | Cache Level: Cache Everything, Edge Cache TTL: 1 month |
| `photos.example.com/*.html` | Cache Level: Cache Everything, Edge Cache TTL: 5 minutes |

### Performance Settings

Recommended settings under **Speed → Optimization**:

- **Auto Minify**: Enable for JavaScript, CSS, HTML
- **Brotli**: Enable (better compression than gzip)
- **Early Hints**: Enable
- **Rocket Loader**: Disable (can interfere with SPA JavaScript)

### Purging Cache

After deploying a new version of your gallery:

```bash
# Purge specific files
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://photos.example.com/index.html","https://photos.example.com/gallery.json"]}'
```

Or in the dashboard: **Caching → Configuration → Purge Cache**

For galerie sites, you typically only need to purge `index.html` and `gallery.json` after updates, since all other assets have content-hashed filenames.

## Cloudflare R2 + Pages

For a fully Cloudflare-native solution, you can use R2 (S3-compatible storage) with Cloudflare Pages or Workers.

### Using R2 with a Worker

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
         // Fallback to index.html for SPA routing
         const fallback = await env.BUCKET.get('index.html');
         return new Response(fallback.body, {
           headers: { 'Content-Type': 'text/html' }
         });
       }

       return new Response(object.body, {
         headers: {
           'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
           'Cache-Control': path.match(/\.(js|css|jpg|jpeg|webp|png)$/)
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

# Build the site
galerie -C /path/to/gallery

# Upload with appropriate cache headers
aws s3 sync dist/static/ s3://$BUCKET/static/ \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync dist/thumbs/ s3://$BUCKET/thumbs/ \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync dist/full/ s3://$BUCKET/full/ \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync dist/ s3://$BUCKET/ \
  --exclude "static/*" --exclude "thumbs/*" --exclude "full/*" \
  --cache-control "public, max-age=300"

# Purge Cloudflare cache for updated files
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://photos.example.com/index.html","https://photos.example.com/gallery.json"]}'

echo "Deployment complete!"
```

## Troubleshooting

### Images not loading
- Check that CORS headers are set if loading from a different domain
- Verify MIME types are correct (especially for WebP)

### Stale content after deploy
- Purge CDN cache (Cloudflare, CloudFront, etc.)
- Check browser cache (hard refresh with Ctrl+Shift+R)
- Verify `Cache-Control` headers are set correctly

### 404 errors on refresh (SPA themes)
- Ensure error document is set to `index.html`
- For nginx/Apache, verify the try_files/RewriteRule configuration

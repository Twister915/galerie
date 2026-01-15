# Raspberry Pi / NUC Setup with Auto-Rebuild

This guide covers setting up galerie on a Raspberry Pi or Intel NUC running Ubuntu, with automatic rebuilds when you add new photos.

## Overview

The setup consists of:
- **galerie watch** - Monitors your photos folder and rebuilds automatically
- **nginx** - Serves the generated static site
- **systemd** - Keeps galerie watch running as a background service

When you drop photos into the folder (via SMB, SFTP, or directly), the site rebuilds within seconds.

## Prerequisites

- Raspberry Pi 4/5 or Intel NUC running Ubuntu (22.04 or newer)
- Photos you want to host
- Domain name (optional, for internet access via Cloudflare Tunnel)

## 1. Install galerie

The easiest method is downloading a pre-built binary:

```bash
# For Raspberry Pi 4/5 (ARM64)
curl -L -o galerie https://github.com/Twister915/galerie/releases/latest/download/galerie-linux-arm64
chmod +x galerie
sudo mv galerie /usr/local/bin/

# Verify
galerie --version
```

For Intel NUC or x86_64 systems, use `galerie-linux-x86_64` instead.

### Building from Source (Alternative)

If you prefer to build from source (or need to modify galerie):

```bash
# Install dependencies
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev curl git

# Install Rust (nightly)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustup default nightly

# Install Node.js (for theme building)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone and build galerie
git clone https://github.com/Twister915/galerie.git
cd galerie
cargo build --release

# Install
sudo cp target/release/galerie /usr/local/bin/
galerie --version
```

The build takes 15-25 minutes on a Raspberry Pi 4.

## 2. Create Gallery Directory

Set up the directory structure:

```bash
# Create gallery directory
sudo mkdir -p /var/www/gallery
sudo chown $USER:$USER /var/www/gallery

# Create the structure
cd /var/www/gallery
mkdir photos

# Create site.toml
cat > site.toml << 'EOF'
domain = "photos.example.com"
title = "My Photo Gallery"
EOF
```

## 3. Add Your Photos

Copy photos into the `photos/` directory. You can organize them into subdirectories to create albums:

```
/var/www/gallery/
├── site.toml
└── photos/
    ├── vacation-2024/
    │   ├── beach.jpg
    │   └── sunset.jpg
    ├── family/
    │   └── reunion.jpg
    └── random-shot.jpg
```

## 4. Test the Build

Run a manual build first to ensure everything works:

```bash
cd /var/www/gallery
galerie build

# Check the output
ls -la dist/
```

You should see `index.html`, `images/`, and `static/` directories.

## 5. Install and Configure nginx

```bash
# Install nginx
sudo apt update
sudo apt install -y nginx

# Create site configuration
sudo tee /etc/nginx/sites-available/gallery << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/gallery/dist;
    index index.html;
    server_name _;

    # Enable gzip compression
    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml;

    # SPA fallback - all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets - cache forever (content-hashed filenames)
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Images - cache forever (content-hashed filenames)
    location /images/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html - never cache (so updates appear immediately)
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/gallery /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Create systemd Service for galerie watch

This is the key part - creating a service that automatically rebuilds when photos change.

```bash
sudo tee /etc/systemd/system/galerie.service << 'EOF'
[Unit]
Description=galerie photo gallery watcher
Documentation=https://github.com/example/galerie
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/gallery
ExecStart=/usr/local/bin/galerie watch --debounce 5
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=galerie

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/gallery
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
```

### Service Configuration Explained

| Option | Purpose |
|--------|---------|
| `Type=simple` | galerie watch runs in foreground |
| `User=www-data` | Run as web server user for proper permissions |
| `WorkingDirectory` | The gallery directory containing site.toml |
| `--debounce 5` | Wait 5 seconds after last file change before rebuilding |
| `Restart=always` | Automatically restart if it crashes |
| `RestartSec=10` | Wait 10 seconds before restarting |
| `ReadWritePaths` | Only allow writes to the gallery directory |

### Fix Permissions

The service runs as `www-data`, so fix ownership:

```bash
sudo chown -R www-data:www-data /var/www/gallery
```

## 7. Start the Service

```bash
# Reload systemd to pick up new service
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable galerie

# Start the service
sudo systemctl start galerie

# Check status
sudo systemctl status galerie
```

You should see output like:
```
● galerie.service - galerie photo gallery watcher
     Loaded: loaded (/etc/systemd/system/galerie.service; enabled)
     Active: active (running)
```

## 8. View Logs

```bash
# Follow logs in real-time
sudo journalctl -u galerie -f

# View recent logs
sudo journalctl -u galerie -n 50

# View logs since last boot
sudo journalctl -u galerie -b
```

When working correctly, you'll see:
```
galerie::watch: performing initial build
galerie::pipeline: pipeline loaded, photos: 42, albums: 3
galerie::pipeline: build complete
galerie::watch: watching photos directory, path: /var/www/gallery/photos
galerie::watch: watch mode active, press Ctrl+C to stop, debounce_secs: 5
```

## 9. Test Auto-Rebuild

Add a new photo and watch the logs:

```bash
# In one terminal, watch logs
sudo journalctl -u galerie -f

# In another terminal, add a photo
sudo cp /path/to/new-photo.jpg /var/www/gallery/photos/
sudo chown www-data:www-data /var/www/gallery/photos/new-photo.jpg
```

You should see in the logs:
```
galerie::watch: change detected, waiting 5s for more changes...
galerie::watch: rebuilding site...
galerie::pipeline: photos processed, total: 43, cached: 42, generated: 1
galerie::watch: build complete
```

## 10. Access Your Gallery

- **Local network**: `http://<pi-ip-address>/`
- **Find your IP**: `hostname -I`

For internet access, see [Cloudflare Tunnel setup](hosting.md#raspberry-pi-with-cloudflare-tunnels).

## Setting Up File Sharing (Optional)

To easily add photos from other devices, set up Samba (SMB) sharing:

```bash
# Install Samba
sudo apt install -y samba

# Create a share for the photos directory
sudo tee -a /etc/samba/smb.conf << 'EOF'

[photos]
   path = /var/www/gallery/photos
   browseable = yes
   read only = no
   guest ok = no
   valid users = pi
   create mask = 0644
   directory mask = 0755
   force user = www-data
   force group = www-data
EOF

# Set Samba password for your user
sudo smbpasswd -a pi

# Restart Samba
sudo systemctl restart smbd
```

Now you can access `\\<pi-ip>\photos` from Windows or `smb://<pi-ip>/photos` from macOS.

## Adjusting the Debounce Time

The `--debounce` flag controls how long galerie waits after the last file change before rebuilding. This prevents multiple rebuilds when copying many files.

- **Default (5 seconds)**: Good for most cases
- **Longer (10-15 seconds)**: Better for slow network transfers or large batches
- **Shorter (2-3 seconds)**: Faster feedback for local testing

Edit the service to change:

```bash
sudo systemctl edit galerie
```

Add:
```ini
[Service]
ExecStart=
ExecStart=/usr/local/bin/galerie watch --debounce 10
```

Then restart:
```bash
sudo systemctl restart galerie
```

## Troubleshooting

### Service won't start

Check logs for errors:
```bash
sudo journalctl -u galerie -n 100 --no-pager
```

Common issues:
- **Permission denied**: Run `sudo chown -R www-data:www-data /var/www/gallery`
- **site.toml not found**: Ensure `WorkingDirectory` is correct
- **galerie not found**: Check `/usr/local/bin/galerie` exists and is executable

### Changes not detected

1. Check the service is running: `sudo systemctl status galerie`
2. Verify file ownership: `ls -la /var/www/gallery/photos/`
3. Check inotify limits (for large directories):
   ```bash
   # Increase limit if needed
   echo 'fs.inotify.max_user_watches=524288' | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

### Build errors

Check what's failing:
```bash
sudo journalctl -u galerie -n 200 | grep -i error
```

Try a manual build to see detailed errors:
```bash
cd /var/www/gallery
sudo -u www-data galerie build -v
```

### nginx shows old content

The browser may be caching. Try:
- Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
- Clear browser cache
- Check nginx is serving from correct directory:
  ```bash
  sudo nginx -T | grep root
  ```

## Complete Setup Script

Here's a script that does everything above:

```bash
#!/bin/bash
set -e

GALLERY_DIR="/var/www/gallery"
DOMAIN="photos.example.com"

echo "=== Installing galerie ==="
if ! command -v galerie &> /dev/null; then
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        BINARY="galerie-linux-arm64"
    else
        BINARY="galerie-linux-x86_64"
    fi
    curl -L -o /tmp/galerie "https://github.com/Twister915/galerie/releases/latest/download/$BINARY"
    chmod +x /tmp/galerie
    sudo mv /tmp/galerie /usr/local/bin/galerie
fi
galerie --version

echo "=== Creating gallery directory ==="
sudo mkdir -p "$GALLERY_DIR/photos"
sudo chown -R www-data:www-data "$GALLERY_DIR"

echo "=== Creating site.toml ==="
sudo -u www-data tee "$GALLERY_DIR/site.toml" << EOF
domain = "$DOMAIN"
title = "My Photo Gallery"
EOF

echo "=== Installing nginx ==="
sudo apt update
sudo apt install -y nginx

echo "=== Configuring nginx ==="
sudo tee /etc/nginx/sites-available/gallery << 'NGINX'
server {
    listen 80 default_server;
    root /var/www/gallery/dist;
    index index.html;
    server_name _;
    gzip on;
    gzip_types text/html text/css application/javascript application/json;
    location / { try_files $uri $uri/ /index.html; }
    location /static/ { expires 1y; add_header Cache-Control "public, immutable"; }
    location /images/ { expires 1y; add_header Cache-Control "public, immutable"; }
    location = /index.html { expires -1; add_header Cache-Control "no-cache, no-store, must-revalidate"; }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/gallery /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== Creating systemd service ==="
sudo tee /etc/systemd/system/galerie.service << 'SERVICE'
[Unit]
Description=galerie photo gallery watcher
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/gallery
ExecStart=/usr/local/bin/galerie watch --debounce 5
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=galerie
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/www/gallery
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

echo "=== Starting service ==="
sudo systemctl daemon-reload
sudo systemctl enable galerie
sudo systemctl start galerie

echo "=== Done! ==="
echo "Add photos to: $GALLERY_DIR/photos/"
echo "View at: http://$(hostname -I | awk '{print $1}')/"
echo "Logs: sudo journalctl -u galerie -f"
```

Save as `setup-galerie.sh`, make executable with `chmod +x setup-galerie.sh`, and run with `sudo ./setup-galerie.sh`.

#!/bin/bash

# Script to update NGINX configuration with cache settings from database
# This script reads cache_config table and generates NGINX config with cache zones

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGINX_TEMPLATE="$PROJECT_ROOT/../nginx/ifilm.conf.template"
NGINX_CONFIG="/etc/nginx/sites-available/ifilm"
NGINX_MAIN="/etc/nginx/nginx.conf"
NGINX_CACHE_DIR="/var/cache/nginx"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ifilm}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Create cache directories
sudo mkdir -p "$NGINX_CACHE_DIR/images"
sudo mkdir -p "$NGINX_CACHE_DIR/videos"
sudo chown -R www-data:www-data "$NGINX_CACHE_DIR"
sudo chmod -R 755 "$NGINX_CACHE_DIR"

# Query database for cache configs
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F"," <<EOF > /tmp/cache_configs.txt
SELECT cache_type, max_size, inactive_time, cache_valid_200, cache_valid_404, COALESCE(cache_directory, '/var/cache/nginx'), is_enabled
FROM cache_config
ORDER BY cache_type;
EOF

# Read cache configs
declare -A CACHE_CONFIGS
declare -A CACHE_DIRECTORIES
while IFS=',' read -r cache_type max_size inactive_time cache_valid_200 cache_valid_404 cache_directory is_enabled; do
    if [ "$is_enabled" = "t" ]; then
        CACHE_CONFIGS["$cache_type"]="$max_size|$inactive_time|$cache_valid_200|$cache_valid_404"
        CACHE_DIRECTORIES["$cache_type"]="${cache_directory:-/var/cache/nginx}"
    fi
done < /tmp/cache_configs.txt

# Create cache directories
for cache_type in "${!CACHE_DIRECTORIES[@]}"; do
    CACHE_DIR="${CACHE_DIRECTORIES[$cache_type]}/$cache_type"
    sudo mkdir -p "$CACHE_DIR"
    sudo chown -R www-data:www-data "$(dirname "$CACHE_DIR")"
    sudo chmod -R 755 "$(dirname "$CACHE_DIR")"
done

# Add/update cache zones in main nginx.conf http block
if [ -n "${CACHE_CONFIGS[images]}" ] || [ -n "${CACHE_CONFIGS[videos]}" ]; then
    # Remove old cache zone definitions if they exist (including comments)
    sudo sed -i '/# iFilm cache zone for images/d' "$NGINX_MAIN" 2>/dev/null || true
    sudo sed -i '/# iFilm cache zone for videos/d' "$NGINX_MAIN" 2>/dev/null || true
    sudo sed -i '/proxy_cache_path.*images_cache/d' "$NGINX_MAIN" 2>/dev/null || true
    sudo sed -i '/proxy_cache_path.*videos_cache/d' "$NGINX_MAIN" 2>/dev/null || true
    
    # Also remove from site config (they shouldn't be there)
    sudo sed -i '/proxy_cache_path/d' "$NGINX_CONFIG" 2>/dev/null || true
    
    # Create backup
    sudo cp "$NGINX_MAIN" "${NGINX_MAIN}.bak.$(date +%s)" 2>/dev/null || true
    
    # Add cache zones to http block
    if [ -n "${CACHE_CONFIGS[images]}" ]; then
        IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[images]}"
        CACHE_DIR="${CACHE_DIRECTORIES[images]:-/var/cache/nginx}/images"
        sudo sed -i "/^http {/a\\
    # iFilm cache zone for images\\
    proxy_cache_path ${CACHE_DIR} levels=1:2 keys_zone=images_cache:10m max_size=${max_size} inactive=${inactive_time};\\
" "$NGINX_MAIN"
    fi
    
    if [ -n "${CACHE_CONFIGS[videos]}" ]; then
        IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[videos]}"
        CACHE_DIR="${CACHE_DIRECTORIES[videos]:-/var/cache/nginx}/videos"
        if grep -q "images_cache" "$NGINX_MAIN"; then
            sudo sed -i "/images_cache/a\\
    # iFilm cache zone for videos\\
    proxy_cache_path ${CACHE_DIR} levels=1:2 keys_zone=videos_cache:10m max_size=${max_size} inactive=${inactive_time};\\
" "$NGINX_MAIN"
        else
            sudo sed -i "/^http {/a\\
    # iFilm cache zone for videos\\
    proxy_cache_path ${CACHE_DIR} levels=1:2 keys_zone=videos_cache:10m max_size=${max_size} inactive=${inactive_time};\\
" "$NGINX_MAIN"
        fi
    fi
fi

# Use the actual NGINX config file (not template) as base
# Always prefer the actual config file to preserve any manual changes
NGINX_BASE="$NGINX_CONFIG"
if [ ! -f "$NGINX_BASE" ]; then
    echo "⚠️  NGINX config file not found, using template..."
    # Fallback to template if config doesn't exist
    NGINX_BASE="$NGINX_TEMPLATE"
    if [ ! -f "$NGINX_BASE" ]; then
        echo "❌ Error: NGINX config or template not found"
        echo "   Config: $NGINX_CONFIG"
        echo "   Template: $NGINX_TEMPLATE"
        exit 1
    fi
else
    echo "✅ Using existing NGINX config file: $NGINX_BASE"
fi

# Create temporary config file
TMP_CONFIG=$(mktemp)
sudo cp "$NGINX_BASE" "$TMP_CONFIG"

# Remove any cache zone definitions from site config (they should only be in main nginx.conf)
sudo sed -i '/proxy_cache_path/d' "$TMP_CONFIG"

# Enable cache directives in location blocks if cache is enabled
if [ -n "${CACHE_CONFIGS[images]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[images]}"
    # Uncomment cache directives for images within the location block
    # Use individual sed commands with range pattern matching closing brace (4 spaces + })
    sed -i '/location ^~ \/api\/media\/images\//,/^    }/s/^        # proxy_cache images_cache;/        proxy_cache images_cache;/' "$TMP_CONFIG"
    sed -i '/location ^~ \/api\/media\/images\//,/^    }/s/^        # proxy_cache_valid 200/        proxy_cache_valid 200/' "$TMP_CONFIG"
    sed -i '/location ^~ \/api\/media\/images\//,/^    }/s/^        # proxy_cache_valid 404/        proxy_cache_valid 404/' "$TMP_CONFIG"
    sed -i '/location ^~ \/api\/media\/images\//,/^    }/s/^        # proxy_cache_use_stale/        proxy_cache_use_stale/' "$TMP_CONFIG"
    sed -i '/location ^~ \/api\/media\/images\//,/^    }/s/^        # proxy_cache_background_update/        proxy_cache_background_update/' "$TMP_CONFIG"
    sed -i '/location ^~ \/api\/media\/images\//,/^    }/s/^        # add_header X-Cache-Status/        add_header X-Cache-Status/' "$TMP_CONFIG"
    # Replace the cache_valid lines with actual values from database
    sed -i "/location ^~ \/api\/media\/images\//,/^    }/s|proxy_cache_valid 200 30d|proxy_cache_valid 200 ${cache_valid_200}|" "$TMP_CONFIG"
    sed -i "/location ^~ \/api\/media\/images\//,/^    }/s|proxy_cache_valid 404 1h|proxy_cache_valid 404 ${cache_valid_404}|" "$TMP_CONFIG"
fi

if [ -n "${CACHE_CONFIGS[videos]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[videos]}"
    # Uncomment cache directives for videos within the location block
    # Match prefix location pattern (^~ /api/media/stream/)
    sed -i '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/ {
        s|^[[:space:]]*# proxy_cache videos_cache;|        proxy_cache videos_cache;|
        s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|
        s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|
        s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|
        s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|
        s|^[[:space:]]*# proxy_cache_lock|        proxy_cache_lock|
        s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|
    }' "$TMP_CONFIG"
    # Replace the cache_valid lines with actual values from database
    sed -i "/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/ {
        s|proxy_cache_valid 200 7d|proxy_cache_valid 200 ${cache_valid_200}|
        s|proxy_cache_valid 404 1h|proxy_cache_valid 404 ${cache_valid_404}|
    }" "$TMP_CONFIG"
    # Ensure buffering is enabled for caching (required for proxy_cache)
    sed -i '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/ {
        s|proxy_buffering off;|proxy_buffering on;|
    }' "$TMP_CONFIG"
fi

# Copy to NGINX config location
sudo cp "$TMP_CONFIG" "$NGINX_CONFIG"

# Test NGINX config
if sudo nginx -t; then
    echo "✅ NGINX configuration is valid"
    # Auto-reload NGINX
    if sudo systemctl reload nginx; then
        echo "✅ NGINX reloaded successfully"
    else
        echo "⚠️  NGINX config is valid but reload failed. Run 'sudo systemctl reload nginx' manually"
    fi
else
    echo "❌ NGINX configuration test failed"
    exit 1
fi

# Cleanup
rm -f /tmp/cache_configs.txt "$TMP_CONFIG"

echo "✅ NGINX cache configuration updated successfully"


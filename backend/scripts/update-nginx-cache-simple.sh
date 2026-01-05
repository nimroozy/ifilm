#!/bin/bash

# Simplified script to update NGINX cache configuration
# This script modifies the existing NGINX config to enable caching

set -e

NGINX_CONFIG="/etc/nginx/sites-available/ifilm"
NGINX_MAIN="/etc/nginx/nginx.conf"

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ifilm}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Query database for cache configs
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F"," <<EOF > /tmp/cache_configs.txt
SELECT cache_type, max_size, inactive_time, cache_valid_200, cache_valid_404, COALESCE(cache_directory, '/var/cache/nginx'), is_enabled
FROM cache_config
WHERE cache_type IN ('images', 'videos')
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
    # Remove old cache zone definitions if they exist
    sudo sed -i '/proxy_cache_path.*images_cache/d' "$NGINX_MAIN" 2>/dev/null || true
    sudo sed -i '/proxy_cache_path.*videos_cache/d' "$NGINX_MAIN" 2>/dev/null || true
    
    # Create backup
    sudo cp "$NGINX_MAIN" "${NGINX_MAIN}.bak.$(date +%s)"
    
    # Find the http block and add cache zones after it opens
    if [ -n "${CACHE_CONFIGS[images]}" ]; then
        IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[images]}"
        CACHE_DIR="${CACHE_DIRECTORIES[images]:-/var/cache/nginx}/images"
        # Add after http { line
        sudo sed -i "/^http {/a\\
    # iFilm cache zone for images\\
    proxy_cache_path ${CACHE_DIR} levels=1:2 keys_zone=images_cache:10m max_size=${max_size} inactive=${inactive_time};\\
" "$NGINX_MAIN"
    fi
    
    if [ -n "${CACHE_CONFIGS[videos]}" ]; then
        IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[videos]}"
        CACHE_DIR="${CACHE_DIRECTORIES[videos]:-/var/cache/nginx}/videos"
        # Add after http { line (or after images cache if it exists)
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

# Enable cache directives in site config
TMP_CONFIG=$(mktemp)
sudo cp "$NGINX_CONFIG" "$TMP_CONFIG"

# Enable image cache
if [ -n "${CACHE_CONFIGS[images]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[images]}"
    # Uncomment cache directives in images location block
    sed -i '/location ~\* \^\/api\/media\/images\//,/^[[:space:]]*}/ {
        s|^[[:space:]]*# proxy_cache images_cache;|        proxy_cache images_cache;|
        s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|
        s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|
        s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|
        s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|
        s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|
    }' "$TMP_CONFIG"
    # Update cache_valid values with actual ones from database
    sed -i "/location ~\* \^\/api\/media\/images\//,/^[[:space:]]*}/ {
        s|proxy_cache_valid 200 30d|proxy_cache_valid 200 ${cache_valid_200}|
        s|proxy_cache_valid 200 ${cache_valid_200}|proxy_cache_valid 200 ${cache_valid_200}|  # Ensure it's set
        s|proxy_cache_valid 404 1h|proxy_cache_valid 404 ${cache_valid_404}|
    }" "$TMP_CONFIG"
fi

# Enable video cache
if [ -n "${CACHE_CONFIGS[videos]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[videos]}"
    # Uncomment cache directives in stream location block
    sed -i '/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
        s|^[[:space:]]*# proxy_cache videos_cache;|        proxy_cache videos_cache;|
        s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|
        s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|
        s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|
        s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|
        s|^[[:space:]]*# proxy_cache_lock|        proxy_cache_lock|
        s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|
    }' "$TMP_CONFIG"
    # Update cache_valid values with actual ones from database
    sed -i "/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
        s|proxy_cache_valid 200 7d|proxy_cache_valid 200 ${cache_valid_200}|
        s|proxy_cache_valid 200 ${cache_valid_200}|proxy_cache_valid 200 ${cache_valid_200}|  # Ensure it's set
        s|proxy_cache_valid 404 1h|proxy_cache_valid 404 ${cache_valid_404}|
    }" "$TMP_CONFIG"
fi

# Copy updated config
sudo cp "$TMP_CONFIG" "$NGINX_CONFIG"

# Test and reload
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✅ NGINX cache configuration updated and reloaded"
else
    echo "❌ NGINX configuration test failed"
    exit 1
fi

rm -f /tmp/cache_configs.txt "$TMP_CONFIG"


#!/bin/bash

# Script to update NGINX configuration with cache settings from database
# This script reads cache_config table and generates NGINX config with cache zones

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGINX_TEMPLATE="$PROJECT_ROOT/../nginx/ifilm.conf.template"
NGINX_CONFIG="/etc/nginx/sites-available/ifilm"
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

# Generate cache zone directives
CACHE_ZONES=""
if [ -n "${CACHE_CONFIGS[images]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[images]}"
    CACHE_DIR="${CACHE_DIRECTORIES[images]:-/var/cache/nginx}/images"
    CACHE_ZONES="${CACHE_ZONES}proxy_cache_path ${CACHE_DIR} levels=1:2 keys_zone=images_cache:10m max_size=${max_size} inactive=${inactive_time};\n"
    # Create directory if it doesn't exist
    sudo mkdir -p "$CACHE_DIR"
    sudo chown -R www-data:www-data "$(dirname "$CACHE_DIR")"
    sudo chmod -R 755 "$(dirname "$CACHE_DIR")"
fi

if [ -n "${CACHE_CONFIGS[videos]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[videos]}"
    CACHE_DIR="${CACHE_DIRECTORIES[videos]:-/var/cache/nginx}/videos"
    CACHE_ZONES="${CACHE_ZONES}proxy_cache_path ${CACHE_DIR} levels=1:2 keys_zone=videos_cache:10m max_size=${max_size} inactive=${inactive_time};\n"
    # Create directory if it doesn't exist
    sudo mkdir -p "$CACHE_DIR"
    sudo chown -R www-data:www-data "$(dirname "$CACHE_DIR")"
    sudo chmod -R 755 "$(dirname "$CACHE_DIR")"
fi

# Use the actual NGINX config file (not template) as base
NGINX_BASE="$NGINX_CONFIG"
if [ ! -f "$NGINX_BASE" ]; then
    # Fallback to template if config doesn't exist
    NGINX_BASE="$NGINX_TEMPLATE"
fi

if [ ! -f "$NGINX_BASE" ]; then
    echo "Error: NGINX config or template not found"
    exit 1
fi

# Create temporary config file
TMP_CONFIG=$(mktemp)

# Add cache zones at the top (before server block) if they exist
if [ -n "$CACHE_ZONES" ]; then
    echo -e "$CACHE_ZONES" > "$TMP_CONFIG"
    echo "" >> "$TMP_CONFIG"
fi

# Append base config content
cat "$NGINX_BASE" >> "$TMP_CONFIG"

# Enable cache directives in location blocks if cache is enabled
if [ -n "${CACHE_CONFIGS[images]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[images]}"
    # Uncomment cache directives for images
    sed -i "s|^[[:space:]]*# proxy_cache images_cache;|        proxy_cache images_cache;|g" "$TMP_CONFIG"
    sed -i "s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|g" "$TMP_CONFIG"
    sed -i "/location ~\* \^\/api\/media\/images\//,/^[[:space:]]*}/ {
        s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|g
        s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|g
        s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|g
        s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|g
        s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|g
    }" "$TMP_CONFIG"
    # Replace the cache_valid lines with actual values
    sed -i "/location ~\* \^\/api\/media\/images\//,/^[[:space:]]*}/ {
        s|proxy_cache_valid 200 30d|proxy_cache_valid 200 ${cache_valid_200}|g
        s|proxy_cache_valid 404 1h|proxy_cache_valid 404 ${cache_valid_404}|g
    }" "$TMP_CONFIG"
fi

if [ -n "${CACHE_CONFIGS[videos]}" ]; then
    IFS='|' read -r max_size inactive_time cache_valid_200 cache_valid_404 <<< "${CACHE_CONFIGS[videos]}"
    # Uncomment cache directives for videos
    sed -i "/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
        s|^[[:space:]]*# proxy_cache videos_cache;|        proxy_cache videos_cache;|g
        s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|g
        s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|g
        s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|g
        s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|g
        s|^[[:space:]]*# proxy_cache_lock|        proxy_cache_lock|g
        s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|g
    }" "$TMP_CONFIG"
    # Replace the cache_valid lines with actual values
    sed -i "/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
        s|proxy_cache_valid 200 7d|proxy_cache_valid 200 ${cache_valid_200}|g
        s|proxy_cache_valid 404 1h|proxy_cache_valid 404 ${cache_valid_404}|g
    }" "$TMP_CONFIG"
fi

# Copy to NGINX config location
sudo cp "$TMP_CONFIG" "$NGINX_CONFIG"

# Test NGINX config
if sudo nginx -t; then
    echo "✅ NGINX configuration is valid"
    echo "Run 'sudo systemctl reload nginx' to apply changes"
else
    echo "❌ NGINX configuration test failed"
    exit 1
fi

# Cleanup
rm -f /tmp/cache_configs.txt "$TMP_CONFIG"

echo "✅ NGINX cache configuration updated successfully"


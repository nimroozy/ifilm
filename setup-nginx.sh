#!/bin/bash

set -e

echo "🔧 Setting up NGINX reverse proxy..."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Install NGINX if not present
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing NGINX..."
    apt-get update -qq
    apt-get install -y nginx
fi

# Copy NGINX configuration
echo "📝 Installing NGINX configuration..."
cp nginx/ifilm.conf /etc/nginx/sites-available/ifilm

# Enable site
if [ -L /etc/nginx/sites-enabled/ifilm ]; then
    echo "NGINX site already enabled"
else
    ln -s /etc/nginx/sites-available/ifilm /etc/nginx/sites-enabled/
fi

# Remove default site if it exists
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Test NGINX configuration
echo "🧪 Testing NGINX configuration..."
if nginx -t; then
    echo "✅ NGINX configuration is valid"
else
    echo "❌ NGINX configuration test failed"
    exit 1
fi

# Restart NGINX
echo "🔄 Restarting NGINX..."
systemctl restart nginx
systemctl enable nginx

echo ""
echo "✅ NGINX setup complete!"
echo ""
echo "🌐 Your application is now available at:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo "   (Port 80 - no need to specify port)"
echo ""
echo "📝 NGINX Status:"
systemctl status nginx --no-pager | head -10


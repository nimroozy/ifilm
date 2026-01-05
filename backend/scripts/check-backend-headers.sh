#!/bin/bash

# Check what headers the backend is sending that might prevent caching

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"
STREAM_URL="http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8"

echo "=== Checking Backend Response Headers ==="
echo ""

echo "Making request to: $STREAM_URL"
echo ""

echo "Full response headers:"
curl -sI "$STREAM_URL" 2>&1
echo ""

echo "Checking for cache-preventing headers:"
HEADERS=$(curl -sI "$STREAM_URL" 2>&1)

if echo "$HEADERS" | grep -qi "Cache-Control.*no-store\|Cache-Control.*no-cache\|Cache-Control.*private"; then
    echo "❌ Found cache-preventing Cache-Control header:"
    echo "$HEADERS" | grep -i "Cache-Control"
    echo ""
    echo "This will prevent NGINX from caching the response!"
elif echo "$HEADERS" | grep -qi "Cache-Control"; then
    echo "✓ Cache-Control header found:"
    echo "$HEADERS" | grep -i "Cache-Control"
else
    echo "⚠️  No Cache-Control header found"
fi

if echo "$HEADERS" | grep -qi "Set-Cookie"; then
    echo "⚠️  Found Set-Cookie header (might prevent caching):"
    echo "$HEADERS" | grep -i "Set-Cookie"
fi

if echo "$HEADERS" | grep -qi "Transfer-Encoding.*chunked"; then
    echo "⚠️  Response is chunked (might prevent caching)"
fi

echo ""
echo "X-Cache-Status header:"
echo "$HEADERS" | grep -i "X-Cache-Status" || echo "Not found"


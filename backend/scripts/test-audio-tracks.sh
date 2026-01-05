#!/bin/bash
# Test script to check if audio tracks are being detected

MOVIE_ID="${1:-7764635b5dfc348c2e8970c25e506726}"

echo "Testing audio track detection for movie: $MOVIE_ID"
echo "=========================================="
echo ""

# Get JWT token (you'll need to login first and get token)
TOKEN="${2:-}"

if [ -z "$TOKEN" ]; then
    echo "⚠️  No token provided. Testing without auth (will use API key fallback)..."
    echo ""
fi

echo "1. Testing backend endpoint..."
if [ -z "$TOKEN" ]; then
    RESPONSE=$(curl -s "http://127.0.0.1:5000/api/media/movies/$MOVIE_ID/stream")
else
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:5000/api/media/movies/$MOVIE_ID/stream")
fi

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check for audio tracks
AUDIO_TRACKS=$(echo "$RESPONSE" | jq -r '.audioTracks | length' 2>/dev/null || echo "0")

if [ "$AUDIO_TRACKS" = "null" ] || [ -z "$AUDIO_TRACKS" ]; then
    AUDIO_TRACKS=0
fi

echo "2. Audio tracks found: $AUDIO_TRACKS"
echo ""

if [ "$AUDIO_TRACKS" -gt 0 ]; then
    echo "✅ Audio tracks detected:"
    echo "$RESPONSE" | jq -r '.audioTracks[] | "  - \(.name) (\(.language), \(.codec))"' 2>/dev/null || echo "  (Unable to parse)"
else
    echo "❌ No audio tracks found"
    echo ""
    echo "Possible reasons:"
    echo "  - Movie has only one audio track"
    echo "  - Backend failed to fetch MediaSources"
    echo "  - Authentication issue"
    echo ""
    echo "Check backend logs:"
    echo "  pm2 logs ifilm-backend --lines 50 | grep -i 'audio\|getStreamUrl\|MediaSource'"
fi

echo ""
echo "3. Checking backend logs..."
pm2 logs ifilm-backend --lines 20 --nostream | grep -i "getStreamUrl\|audio\|MediaSource" | tail -10 || echo "No relevant logs found"

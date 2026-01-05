# Audio Track Switching Fix - Implementation Summary

## Root Cause (Confirmed)
Jellyfin **ignores `AudioStreamIndex` during Direct Play / audio stream copy** in browser playback. When Jellyfin decides playback can be Direct Play:
- Audio track is locked at stream start
- `AudioStreamIndex` is ignored
- UI changes but audio stays default

**Jellyfin Web solves this by forcing a transcode or direct-stream (audio remux) when switching audio.**

## Solution Implemented
We force transcoding by adding `AudioCodec=aac` to **all** stream requests when `AudioStreamIndex` is present. This disables Direct Play and makes Jellyfin honor the selected audio track.

## Implementation Details

### 1. Master Playlist (`master.m3u8`)
**Location:** `backend/src/controllers/media.controller.ts` (lines 962-983)

When `AudioStreamIndex` is present:
- ✅ `AudioStreamIndex={index}`
- ✅ `VideoStreamIndex=0`
- ✅ `SubtitleStreamIndex=-1`
- ✅ **`AudioCodec=aac`** ← Forces transcoding

**Example URL:**
```
/Videos/{id}/master.m3u8?api_key=XXX&MediaSourceId=YYY&AudioStreamIndex=2&VideoStreamIndex=0&SubtitleStreamIndex=-1&AudioCodec=aac
```

### 2. Variant Playlists (`main.m3u8`)
**Location:** `backend/src/controllers/media.controller.ts` (lines 948-954)

When `AudioStreamIndex` is present:
- ✅ `AudioStreamIndex={index}`
- ✅ **`AudioCodec=aac`** ← Forces transcoding

### 3. Segments (`.ts` files)
**Location:** `backend/src/controllers/media.controller.ts` (lines 914-920)

When `AudioStreamIndex` is present (and not from HLS playlist):
- ✅ `AudioStreamIndex={index}`
- ✅ **`AudioCodec=aac`** ← Forces transcoding

### 4. General URL Parameters
**Location:** `backend/src/controllers/media.controller.ts` (lines 861-874)

When `AudioStreamIndex` is added to any request:
- ✅ `AudioStreamIndex={index}`
- ✅ **`AudioCodec=aac`** ← Forces transcoding

### 5. Playlist Rewriting
**Location:** `backend/src/controllers/media.controller.ts` (lines 1157-1159)

When rewriting variant playlist URLs in HLS manifest:
- ✅ `AudioStreamIndex={index}`
- ✅ **`AudioCodec=aac`** ← Forces transcoding

### 6. Critical Verification
**Location:** `backend/src/controllers/media.controller.ts` (lines 991-1002)

**Safety Check:** Before sending request to Jellyfin:
- ✅ Verifies `AudioCodec=aac` is present in URL when `AudioStreamIndex` is used
- ✅ Logs error if missing (should never happen)
- ✅ Auto-fixes if missing (defensive programming)
- ✅ Logs verification status in request details

## Expected Behavior After Fix

### ✅ Correct Behavior
1. **Audio track switching forces a new stream**
   - Player reloads with new `AudioStreamIndex`
   - `AudioCodec=aac` forces transcoding

2. **Jellyfin playback mode becomes Direct Stream or Transcode**
   - NOT Direct Play
   - Jellyfin honors `AudioStreamIndex` during transcoding

3. **Audio track actually changes**
   - Selected language/codec plays correctly
   - Matches Jellyfin Web behavior

4. **UI and playback are synchronized**
   - UI shows selected track
   - Audio matches UI selection

### ❌ No Regression
- Normal playback (no audio track change) still works
- Direct Play still works when no `AudioStreamIndex` is specified
- No performance impact when audio track is not changed

## Verification Steps

### 1. Check Backend Logs
When switching audio tracks, look for:
```
[BACKEND AUDIO] ========== MASTER PLAYLIST REQUEST ==========
[BACKEND AUDIO] AudioStreamIndex: 2
[BACKEND AUDIO] AudioCodec: aac (FORCING TRANSCODE)
[BACKEND AUDIO] Generated Jellyfin URL: .../master.m3u8?...&AudioStreamIndex=2&AudioCodec=aac
[proxyStream] ✅ VERIFIED: AudioCodec=aac is present in URL (transcoding will be forced)
```

### 2. Check Jellyfin Dashboard
After switching audio track:
- **Playback mode must NOT be "Direct Play"**
- Should be "Direct Stream" or "Transcode"
- Audio track should match selection

### 3. Test Audio Track Switching
1. Play a video with multiple audio tracks
2. Switch to a different audio track
3. Verify:
   - ✅ Video reloads briefly
   - ✅ Audio language changes
   - ✅ Jellyfin dashboard shows transcoding (not Direct Play)
   - ✅ Audio matches UI selection

### 4. Test Normal Playback
1. Play a video without changing audio track
2. Verify:
   - ✅ Video plays normally
   - ✅ No unnecessary transcoding
   - ✅ Direct Play works when no audio track change

## Technical Notes

### Why `AudioCodec=aac`?
- **Minimal impact:** Only forces audio transcoding, video can still be direct streamed
- **Compatible:** AAC is universally supported
- **Effective:** Disables Direct Play, forces Jellyfin to honor `AudioStreamIndex`

### Alternative Options (Not Used)
- `VideoCodec=h264` - Would force video transcoding (more CPU intensive)
- `MaxStreamingBitrate=8000000` - Bandwidth-based (less reliable)

### Jellyfin Behavior
- **Direct Play:** Streams file as-is, ignores `AudioStreamIndex`
- **Direct Stream:** Remuxes container, can change audio track
- **Transcode:** Full transcoding, always honors `AudioStreamIndex`

By forcing `AudioCodec=aac`, we ensure Jellyfin uses **Direct Stream** or **Transcode**, both of which honor `AudioStreamIndex`.

## Files Modified
- `backend/src/controllers/media.controller.ts` - Added `AudioCodec=aac` to all `AudioStreamIndex` requests

## Testing Checklist
- [x] Audio track switching forces transcoding
- [x] Audio actually changes when track is switched
- [x] Jellyfin dashboard shows transcoding (not Direct Play)
- [x] Normal playback still works (no regression)
- [x] Backend logs show `AudioCodec=aac` in URLs
- [x] Verification check confirms `AudioCodec` is present

## Status
✅ **IMPLEMENTED AND VERIFIED**

The fix is complete. All stream requests with `AudioStreamIndex` now include `AudioCodec=aac` to force transcoding, ensuring Jellyfin honors the selected audio track.


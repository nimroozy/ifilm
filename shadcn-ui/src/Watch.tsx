import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Hls from 'hls.js';

interface MediaDetails {
  id: string;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: number;
  rating: number;
  duration: number;
  genres: string[];
  type?: 'movie' | 'series';
  seasons?: Array<{
    id: string;
    name: string;
    seasonNumber: number;
  }>;
}

interface Episode {
  id: string;
  name: string;
  episodeNumber: number;
  overview: string;
  thumbnailUrl?: string;
}

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [media, setMedia] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  // Series-specific state
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Invalid media ID');
      setLoading(false);
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:58',message:'Component mount/ID change',data:{id,streamUrlBefore:streamUrl,selectedEpisodeBefore:selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // CRITICAL: Clear any existing stream URL on mount to prevent stale data
    setStreamUrl(null);
    setSelectedEpisode(null);
    setEpisodes([]);
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:70',message:'State cleared, calling loadMediaDetails',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    loadMediaDetails();
  }, [id]);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:73',message:'useEffect for player init',data:{streamUrl,mediaType:media?.type,selectedEpisode,mediaId:media?.id,loadingEpisodes,hasVideoRef:!!videoRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    // Don't initialize if we're still loading episodes
    if (loadingEpisodes) {
      console.log('[Watch] Still loading episodes, skipping player initialization');
      return;
    }

    // Only initialize player if we have valid conditions
    if (!streamUrl || !videoRef.current) {
      return;
    }

    // CRITICAL: For series, we MUST have a selected episode
    if (media?.type === 'series') {
      if (!selectedEpisode) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:87',message:'BLOCKED: No selected episode in useEffect',data:{streamUrl,seriesId:media.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        console.error('[Watch] CRITICAL: Series detected but no episode selected!');
        console.error('[Watch] Series ID:', media.id);
        console.error('[Watch] Stream URL:', streamUrl);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setStreamUrl(null);
        setError('Please select an episode to play.');
        return;
      }
      
      // Extract ID from stream URL path
      const streamUrlMatch = streamUrl.match(/\/stream\/([^\/]+)/);
      const streamUrlId = streamUrlMatch ? streamUrlMatch[1] : null;
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:100',message:'Validation check in useEffect',data:{streamUrl,streamUrlId,seriesId:media.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      console.log('[Watch] ========================================');
      console.log('[Watch] VALIDATION CHECK IN useEffect');
      console.log('[Watch] Stream URL:', streamUrl);
      console.log('[Watch] Stream URL ID:', streamUrlId);
      console.log('[Watch] Series ID:', media.id);
      console.log('[Watch] Selected Episode ID:', selectedEpisode);
      console.log('[Watch] ========================================');
      
      // CRITICAL CHECK: Stream URL must contain episode ID, NOT series ID
      if (streamUrlId === media.id) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:113',message:'BLOCKED: Stream URL contains series ID in useEffect',data:{streamUrl,streamUrlId,seriesId:media.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        console.error('[Watch] ❌ BLOCKED: Stream URL contains SERIES ID!');
        console.error('[Watch] This should NEVER happen - destroying player immediately');
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setStreamUrl(null);
        setError('Cannot stream series directly. Please select an episode.');
        toast.error('Please select an episode to play.');
        return;
      }
      
      // Verify stream URL path matches selected episode ID
      if (streamUrlId !== selectedEpisode) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:127',message:'BLOCKED: Stream URL ID mismatch in useEffect',data:{streamUrlId,selectedEpisode,streamUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        console.error('[Watch] ❌ BLOCKED: Stream URL ID does not match selected episode!');
        console.error('[Watch] Stream URL ID:', streamUrlId);
        console.error('[Watch] Selected Episode ID:', selectedEpisode);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setStreamUrl(null);
        setError('Stream URL ID mismatch. Please select an episode again.');
        return;
      }
      
      console.log('[Watch] ✅ All validations passed in useEffect');
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:143',message:'Calling initializePlayer',data:{streamUrl,mediaType:media?.type,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    console.log('[Watch] Initializing player with stream URL:', streamUrl);
    initializePlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, media?.type, selectedEpisode, media?.id, loadingEpisodes]);

  const loadMediaDetails = async () => {
    try {
      setLoading(true);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:154',message:'loadMediaDetails entry',data:{id,currentStreamUrl:streamUrl,currentSelectedEpisode:selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Load as movie only (series redirects to WatchSeries)
      const response = await api.get(`/media/movies/${id}`);
      const mediaData = response.data;
      
      setMedia({
        id: mediaData.id,
        title: mediaData.title,
        overview: mediaData.overview || '',
        posterUrl: mediaData.posterUrl,
        backdropUrl: mediaData.backdropUrl || mediaData.posterUrl,
        year: mediaData.year || 0,
        rating: mediaData.rating || 0,
        duration: mediaData.duration || 0,
        genres: mediaData.genres || [],
        type: 'movie',
      });

      // For movies, get stream URL directly
      await loadStreamUrl(mediaData.id, 'movie');
    } catch (err: any) {
      console.error('Failed to load media details:', err);
      setError(err.response?.data?.message || 'Failed to load media');
      toast.error('Failed to load media details');
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (seriesId: string, seasonId: string) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:216',message:'loadEpisodes entry',data:{seriesId,seasonId,streamUrlBefore:streamUrl,selectedEpisodeBefore:selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setLoadingEpisodes(true);
      // CRITICAL: Clear stream URL before loading episodes to prevent stale series ID
      setStreamUrl(null);
      setSelectedEpisode(null);
      
      // Get episodes for the season
      const response = await api.get(`/media/series/${seriesId}/episodes?seasonId=${seasonId}`);
      const episodesData = response.data.episodes || response.data.items || [];
      
      console.log('[Watch] Loaded episodes:', episodesData.length);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:225',message:'Episodes fetched from API',data:{episodesCount:episodesData.length,episodeIds:episodesData.map((e:any)=>e.id).slice(0,3),seriesId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      setEpisodes(episodesData.map((ep: any) => ({
        id: ep.id,
        name: ep.name || ep.title,
        episodeNumber: ep.episodeNumber || ep.indexNumber || 0,
        overview: ep.overview || '',
        thumbnailUrl: ep.thumbnailUrl || ep.posterUrl,
      })));
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:235',message:'Episodes state set, NOT auto-selecting',data:{episodesCount:episodesData.length,streamUrlAfter:streamUrl,selectedEpisodeAfter:selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // DO NOT auto-select or auto-load stream URL
      // User must explicitly click on an episode to play it
      if (episodesData.length > 0) {
        console.log('[Watch] Episodes loaded. Waiting for user to select an episode.');
        // Don't set selectedEpisode or load stream URL automatically
        // User will click on an episode to play it
      } else {
        // No episodes found, ensure everything is cleared
        setStreamUrl(null);
        setSelectedEpisode(null);
      }
    } catch (err: any) {
      console.error('Failed to load episodes:', err);
      toast.error('Failed to load episodes');
      setStreamUrl(null);
      setSelectedEpisode(null);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const loadStreamUrl = async (mediaId: string, type: 'movie' | 'episode' = 'movie') => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:258',message:'loadStreamUrl entry',data:{mediaId,type,mediaType:media?.type,seriesId:media?.id,selectedEpisode,currentStreamUrl:streamUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.log('[Watch] loadStreamUrl called:', { mediaId, type, mediaType: media?.type, seriesId: media?.id, selectedEpisode });
      
      // CRITICAL: For series, we MUST have a selected episode and mediaId must be the episode ID
      if (media?.type === 'series') {
        if (!selectedEpisode) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:264',message:'BLOCKED: No selected episode',data:{mediaId,seriesId:media.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          console.error('[Watch] BLOCKED: Cannot load stream URL for series without selected episode');
          setStreamUrl(null);
          return;
        }
        
        if (mediaId === media.id) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:270',message:'BLOCKED: mediaId is series ID',data:{mediaId,seriesId:media.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          console.error('[Watch] BLOCKED: mediaId is series ID, not episode ID!');
          console.error('[Watch] Series ID:', media.id);
          console.error('[Watch] Episode ID should be:', selectedEpisode);
          setStreamUrl(null);
          setError('Cannot stream series directly. Please select an episode.');
          return;
        }
        
        if (mediaId !== selectedEpisode) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:279',message:'BLOCKED: mediaId mismatch',data:{mediaId,selectedEpisode,seriesId:media.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          console.error('[Watch] BLOCKED: mediaId does not match selected episode!');
          console.error('[Watch] mediaId:', mediaId);
          console.error('[Watch] selectedEpisode:', selectedEpisode);
          setStreamUrl(null);
          setError('Episode ID mismatch. Please select an episode again.');
          return;
        }
      }
      
      // Get stream URL from backend
      const endpoint = type === 'movie' 
        ? `/media/movies/${mediaId}/stream`
        : `/media/movies/${mediaId}/stream`; // Episodes use the same endpoint
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:293',message:'Calling backend for stream URL',data:{endpoint,mediaId,type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.log('[Watch] Calling backend endpoint:', endpoint);
      const response = await api.get(endpoint);
      const streamUrlValue = response.data.streamUrl;
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:297',message:'Backend returned stream URL',data:{streamUrlValue,mediaId,type,seriesId:media?.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.log('[Watch] Backend returned stream URL:', streamUrlValue);
      
      // Extract ID from stream URL to verify
      const streamUrlIdMatch = streamUrlValue.match(/\/stream\/([^\/]+)/);
      const streamUrlId = streamUrlIdMatch ? streamUrlIdMatch[1] : null;
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:301',message:'Extracted stream URL ID',data:{streamUrlId,streamUrlValue,mediaId,seriesId:media?.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // CRITICAL: Verify the stream URL contains the correct ID
      if (media?.type === 'series') {
        if (streamUrlId === media.id) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:306',message:'BLOCKED: Stream URL contains series ID',data:{streamUrlId,streamUrlValue,seriesId:media.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          console.error('[Watch] BLOCKED: Stream URL contains SERIES ID!');
          console.error('[Watch] Stream URL ID:', streamUrlId);
          console.error('[Watch] Series ID:', media.id);
          console.error('[Watch] Expected Episode ID:', selectedEpisode);
          setStreamUrl(null);
          setError('Invalid stream URL. Please select an episode.');
          return;
        }
        
        if (streamUrlId !== selectedEpisode) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:316',message:'BLOCKED: Stream URL ID mismatch',data:{streamUrlId,selectedEpisode,streamUrlValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          console.error('[Watch] BLOCKED: Stream URL ID does not match selected episode!');
          console.error('[Watch] Stream URL ID:', streamUrlId);
          console.error('[Watch] Selected Episode ID:', selectedEpisode);
          setStreamUrl(null);
          setError('Stream URL ID mismatch.');
          return;
        }
      }
      
      // FINAL CRITICAL CHECK: Ensure stream URL does NOT contain series ID
      if (media?.type === 'series' && streamUrlValue.includes(media.id) && !streamUrlValue.includes(selectedEpisode!)) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:327',message:'FINAL BLOCK: Stream URL contains series ID',data:{streamUrlValue,seriesId:media.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        console.error('[Watch] FINAL BLOCK: Stream URL contains series ID!');
        console.error('[Watch] Stream URL:', streamUrlValue);
        console.error('[Watch] Series ID:', media.id);
        console.error('[Watch] Episode ID:', selectedEpisode);
        setStreamUrl(null);
        setError('Invalid stream URL detected. Please select an episode again.');
        toast.error('Invalid stream URL. Please select an episode.');
        return;
      }
      
      // All checks passed, set the stream URL
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:339',message:'Setting stream URL',data:{streamUrlValue,streamUrlId,selectedEpisode,mediaId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.log('[Watch] ✅ All validations passed! Setting stream URL:', streamUrlValue);
      console.log('[Watch] Stream URL ID:', streamUrlId);
      console.log('[Watch] Episode ID:', selectedEpisode);
      setStreamUrl(streamUrlValue);
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:343',message:'loadStreamUrl error',data:{error:err.message,mediaId,type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('[Watch] Failed to load stream URL:', err);
      setError(err.response?.data?.message || 'Failed to load stream URL');
      setStreamUrl(null);
    }
  };

  const handleEpisodeSelect = async (episodeId: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:350',message:'handleEpisodeSelect entry',data:{episodeId,seriesId:media?.id,currentStreamUrl:streamUrl,currentSelectedEpisode:selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.log('[Watch] ========================================');
    console.log('[Watch] USER CLICKED ON EPISODE');
    console.log('[Watch] Episode ID:', episodeId);
    console.log('[Watch] Series ID:', media?.id);
    console.log('[Watch] ========================================');
    
    // Set selected episode
    setSelectedEpisode(episodeId);
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:358',message:'Selected episode set',data:{episodeId,streamUrlBeforeClear:streamUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    // CRITICAL: Clear existing stream URL before loading new one
    setStreamUrl(null);
    
    // Small delay to ensure state is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:364',message:'Calling loadStreamUrl for episode',data:{episodeId,selectedEpisodeAfter:selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    // Load stream URL for the selected episode
    await loadStreamUrl(episodeId, 'episode');
  };

  const initializePlayer = () => {
    if (!videoRef.current || !streamUrl) {
      console.warn('[Watch] Cannot initialize player: missing video ref or stream URL');
      return;
    }

    // CRITICAL: Final safety check - if it's a series, we MUST have selectedEpisode
    if (media?.type === 'series') {
      if (!selectedEpisode) {
        console.error('[Watch] BLOCKED: Cannot initialize player for series without episode!');
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setStreamUrl(null);
        return;
      }
      
      // Extract ID from stream URL and verify it's the episode ID
      const streamUrlMatch = streamUrl.match(/\/stream\/([^\/]+)/);
      const streamUrlId = streamUrlMatch ? streamUrlMatch[1] : null;
      
      if (streamUrlId === media.id) {
        console.error('[Watch] BLOCKED: Stream URL contains SERIES ID in initializePlayer!');
        console.error('[Watch] Stream URL:', streamUrl);
        console.error('[Watch] Stream URL ID:', streamUrlId);
        console.error('[Watch] Series ID:', media.id);
        console.error('[Watch] Episode ID:', selectedEpisode);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setStreamUrl(null);
        setError('Cannot stream series directly. Please select an episode.');
        return;
      }
      
      if (streamUrlId !== selectedEpisode) {
        console.error('[Watch] BLOCKED: Stream URL ID mismatch in initializePlayer!');
        console.error('[Watch] Stream URL ID:', streamUrlId);
        console.error('[Watch] Selected Episode ID:', selectedEpisode);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setStreamUrl(null);
        setError('Stream URL ID does not match selected episode.');
        return;
      }
      
      console.log('[Watch] ✅ All checks passed, initializing player for episode:', selectedEpisode);
    }

    const video = videoRef.current;

    // Set up event listeners
    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress(video.currentTime);
        setDuration(video.duration);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        debug: false,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, ready to play');
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, destroying HLS instance');
              hls.destroy();
              setError('Failed to load video. Please try again.');
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = streamUrl;
    } else {
      setError('HLS playback not supported in this browser');
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          toast.error('Failed to play video. Please try again.');
        });
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch(err => {
          console.error('Error entering fullscreen:', err);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      setShowControls(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">{error || 'Media not found'}</div>
          <button
            onClick={() => navigate('/movies')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Back to Movies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Backdrop */}
      {media.backdropUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${media.backdropUrl})` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 p-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition"
        >
          <ArrowLeft className="h-6 w-6" />
          <span>Back</span>
        </button>
        <div className="text-white text-lg font-semibold">{media.title}</div>
        <div className="w-20" /> {/* Spacer */}
      </div>

      {/* Series Episode Selection - Show first for series */}
      {media.type === 'series' && (
          <div className="px-4 mt-6">
            {/* Season Selection */}
            {media.seasons && media.seasons.length > 0 && (
              <div className="mb-6">
                <h3 className="text-white text-lg font-semibold mb-3">Seasons</h3>
                <div className="flex gap-2 flex-wrap">
                  {media.seasons.map((season) => (
                    <button
                      key={season.id}
                      onClick={() => {
                        setSelectedSeason(season.seasonNumber);
                        loadEpisodes(media.id, season.id);
                      }}
                      className={`px-4 py-2 rounded transition-colors ${
                        selectedSeason === season.seasonNumber
                          ? 'bg-red-600 text-white'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {season.name || `Season ${season.seasonNumber}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Episode List */}
            {selectedSeason !== null && (
              <div>
                <h3 className="text-white text-lg font-semibold mb-3">Episodes</h3>
                {loadingEpisodes ? (
                  <div className="text-white">Loading episodes...</div>
                ) : episodes.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {episodes.map((episode) => (
                      <button
                        key={episode.id}
                        onClick={() => handleEpisodeSelect(episode.id)}
                        className={`text-left rounded-lg overflow-hidden transition-transform hover:scale-105 ${
                          selectedEpisode === episode.id
                            ? 'ring-2 ring-red-600'
                            : ''
                        }`}
                      >
                        {episode.thumbnailUrl && (
                          <img
                            src={episode.thumbnailUrl}
                            alt={episode.name}
                            className="w-full aspect-video object-cover"
                          />
                        )}
                        <div className="p-2 bg-[#1F1F1F]">
                          <div className="text-white text-sm font-medium truncate">
                            E{episode.episodeNumber} - {episode.name}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-white">No episodes found for this season.</div>
                )}
              </div>
            )}
          </div>
        )}

      {/* Video Player - Only show if we have a stream URL AND (it's a movie OR we have a selected episode for series) */}
      {/* CRITICAL: For series, also verify the stream URL doesn't contain the series ID */}
      {(() => {
        // Helper function to check if video player should render
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:700',message:'Render guard check',data:{streamUrl,mediaType:media.type,selectedEpisode,mediaId:media.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        if (!streamUrl) return false;
        if (media.type !== 'series') return true; // Movies are always OK
        
        // For series, we need selectedEpisode AND stream URL must be for episode
        if (!selectedEpisode) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:706',message:'Render guard: No selected episode',data:{streamUrl,seriesId:media.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
          return false;
        }
        
        const streamUrlMatch = streamUrl.match(/\/stream\/([^\/]+)/);
        const streamUrlId = streamUrlMatch ? streamUrlMatch[1] : null;
        
        if (streamUrlId === media.id) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:711',message:'Render guard: BLOCKED - series ID in stream URL',data:{streamUrl,streamUrlId,seriesId:media.id,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
          console.error('[Watch] ❌ BLOCKING RENDER: Stream URL contains series ID!');
          console.error('[Watch] Stream URL:', streamUrl);
          console.error('[Watch] Series ID:', media.id);
          console.error('[Watch] Episode ID:', selectedEpisode);
          return false;
        }
        
        if (streamUrlId !== selectedEpisode) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:719',message:'Render guard: BLOCKED - ID mismatch',data:{streamUrlId,selectedEpisode,streamUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
          console.error('[Watch] ❌ BLOCKING RENDER: Stream URL ID does not match episode!');
          console.error('[Watch] Stream URL ID:', streamUrlId);
          console.error('[Watch] Episode ID:', selectedEpisode);
          return false;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a3acb5e5-10cb-42af-846d-274e9c2ec842',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Watch.tsx:726',message:'Render guard: PASSED',data:{streamUrlId,selectedEpisode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        return true;
      })() && (
        <div
          className="relative z-10 w-full mt-6"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              preload="metadata"
            />

            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-white text-xl">Loading video...</div>
              </div>
            )}

            {/* Play/Pause Button Overlay */}
            {showControls && !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <button
                  onClick={togglePlay}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-6 transition-all transform hover:scale-110"
                >
                  <Play className="h-16 w-16 text-white" fill="currentColor" />
                </button>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Progress Bar */}
              <div className="px-4 pt-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500 transition-colors"
                  style={{
                    background: `linear-gradient(to right, #E50914 0%, #E50914 ${(progress / (duration || 1)) * 100}%, #4B5563 ${(progress / (duration || 1)) * 100}%, #4B5563 100%)`
                  }}
                />
              </div>

              {/* Control Buttons */}
              <div className="px-4 pb-4 flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" fill="currentColor" />
                  ) : (
                    <Play className="h-6 w-6" fill="currentColor" />
                  )}
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                </div>

                {/* Time Display */}
                <div className="text-white text-sm font-mono ml-2">
                  {formatTime(progress)} / {formatTime(duration)}
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                    aria-label="Settings"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                    aria-label="Fullscreen"
                  >
                    <Maximize className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Media Info */}
        <div className="mt-6 px-4 text-white">
          <h1 className="text-3xl font-bold mb-2">{media.title}</h1>
          <div className="flex items-center gap-4 mb-4">
            <span>{media.year}</span>
            <span>•</span>
            {media.type === 'movie' && <span>{Math.floor(media.duration / 60)} min</span>}
            {media.type === 'movie' && <span>•</span>}
            <span>⭐ {media.rating.toFixed(1)}</span>
          </div>
          <div className="flex gap-2 mb-4">
            {media.genres.map((genre) => (
              <span
                key={genre}
                className="px-2 py-1 bg-white/20 rounded text-sm"
              >
                {genre}
              </span>
            ))}
          </div>
          {media.overview && (
            <p className="text-gray-300 max-w-3xl">{media.overview}</p>
          )}
        </div>
      </div>
    </div>
  );
}


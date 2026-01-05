export interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: number;
  rating: number;
  duration: number;
  genres: string[];
}

export interface Episode {
  id: string;
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  duration: number;
  thumbnailUrl: string;
}

export interface StreamInfo {
  streamUrl: string;
  token: string;
  expiresAt: Date;
  subtitles: Subtitle[];
  qualities: Quality[];
}

export interface Subtitle {
  language: string;
  url: string;
}

export interface Quality {
  label: string;
  value: string;
}

export interface WatchHistory {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'episode';
  progress: number;
  duration: number;
  percentage: number;
  lastWatched: Date;
}

export interface Favorite {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'series';
  mediaTitle: string;
  mediaPosterUrl: string;
  addedAt: Date;
}

export interface ContinueWatchingItem extends MediaItem {
  progress: number;
  lastWatched: Date;
}
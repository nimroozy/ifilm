export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  RunTimeTicks?: number;
  Genres?: string[];
  ImageTags?: {
    Primary?: string;
    Backdrop?: string;
  };
  BackdropImageTags?: string[];
  SeriesId?: string;
  SeasonId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
}

export interface JellyfinLibrary {
  Id: string;
  ItemId?: string;
  Name: string;
  CollectionType?: string | string[];
  ItemCount?: number;
}

export interface JellyfinAuthResponse {
  User: {
    Id: string;
    Name: string;
  };
  AccessToken: string;
  ServerId: string;
}

export interface JellyfinSystemInfo {
  ServerName: string;
  Version: string;
  Id: string;
}
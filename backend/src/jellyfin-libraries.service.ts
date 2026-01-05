import { query } from '../config/database';
import { jellyfinService } from './jellyfin.service';
import { JellyfinLibrary } from '../types/jellyfin.types';

export interface LibraryRecord {
  id: string;
  configId: string;
  libraryId: string;
  libraryName: string;
  collectionType: 'movies' | 'tvshows' | 'music' | 'mixed';
  isVisible: boolean;
  itemCount: number;
  lastSync?: Date;
  createdAt: Date;
}

export const syncLibraries = async (configId: string): Promise<LibraryRecord[]> => {
  try {
    // Ensure Jellyfin service is initialized
    if (!jellyfinService.isInitialized()) {
      const { loadJellyfinConfig } = await import('./jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        throw new Error('Jellyfin service not initialized and no config found');
      }
    }
    
    // Get libraries from Jellyfin
    console.log('[JellyfinLibraries] Fetching libraries from Jellyfin...');
    const libraries = await jellyfinService.getLibraries();
    console.log('[JellyfinLibraries] Received libraries:', {
      count: libraries?.length || 0,
      isArray: Array.isArray(libraries),
      libraries: libraries?.map((lib: any) => ({ Id: lib.Id || lib.ItemId, Name: lib.Name })) || [],
    });

    if (!libraries || !Array.isArray(libraries) || libraries.length === 0) {
      console.warn('[JellyfinLibraries] No libraries returned from Jellyfin');
      return [];
    }

    // Sync each library to database
    const syncedLibraries: LibraryRecord[] = [];

    for (const library of libraries) {
      const libraryId = (library as any).Id || (library as any).ItemId || '';
      const libraryName = library.Name || 'Unknown Library';
      
      // Get actual item count by querying Jellyfin for items in this library
      let itemCount = 0;
      try {
        const itemsResponse = await jellyfinService.getItems({
          parentId: libraryId,
          limit: 1, // Just get count, not actual items
        });
        itemCount = itemsResponse.TotalRecordCount || 0;
        console.log('[JellyfinLibraries] Library item count:', { libraryId, libraryName, itemCount });
      } catch (itemCountError: any) {
        console.warn('[JellyfinLibraries] Could not get item count for library', libraryId, ':', itemCountError.message);
        // Fallback to ItemCount from library object if available
        itemCount = (library as any).ItemCount || 0;
      }
      
      console.log('[JellyfinLibraries] Processing library:', {
        Id: libraryId,
        Name: libraryName,
        CollectionType: library.CollectionType,
        ItemCount: itemCount,
      });
      
      const collectionType = determineCollectionType(library);
      
      if (!libraryId) {
        console.warn('[JellyfinLibraries] Skipping library with no ID:', library);
        continue;
      }
      
      try {
        console.log('[JellyfinLibraries] Inserting library:', { configId, libraryId, libraryName, collectionType });
        const result = await query(
          `INSERT INTO jellyfin_libraries (config_id, library_id, library_name, collection_type, item_count, last_sync)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (config_id, library_id)
           DO UPDATE SET 
             library_name = EXCLUDED.library_name,
             collection_type = EXCLUDED.collection_type,
             item_count = EXCLUDED.item_count,
             last_sync = CURRENT_TIMESTAMP
           RETURNING *`,
          [configId, libraryId, libraryName, collectionType, itemCount]
        );
        console.log('[JellyfinLibraries] Successfully saved library:', libraryId);

        const row = result.rows[0];
        syncedLibraries.push({
          id: row.id,
          configId: row.config_id,
          libraryId: row.library_id,
          libraryName: row.library_name,
          collectionType: row.collection_type,
          isVisible: row.is_visible,
          itemCount: row.item_count,
          lastSync: row.last_sync,
          createdAt: row.created_at,
        });
      } catch (dbError: any) {
        console.error(`Error syncing library ${libraryId}:`, dbError);
        // Check if it's a constraint error (constraint might not exist yet)
        if (dbError.code === '23505') {
          // Unique constraint violation - try update instead
          try {
            const updateResult = await query(
              `UPDATE jellyfin_libraries 
               SET library_name = $1, collection_type = $2, item_count = $3, last_sync = CURRENT_TIMESTAMP
               WHERE config_id = $4 AND library_id = $5
               RETURNING *`,
              [libraryName, collectionType, itemCount, configId, libraryId]
            );
            if (updateResult.rows.length > 0) {
              const row = updateResult.rows[0];
              syncedLibraries.push({
                id: row.id,
                configId: row.config_id,
                libraryId: row.library_id,
                libraryName: row.library_name,
                collectionType: row.collection_type,
                isVisible: row.is_visible,
                itemCount: row.item_count,
                lastSync: row.last_sync,
                createdAt: row.created_at,
              });
            }
          } catch (updateError) {
            console.error(`Error updating library ${libraryId}:`, updateError);
          }
        } else {
          throw dbError; // Re-throw if it's not a constraint error
        }
      }
    }

    console.log('[JellyfinLibraries] Sync completed. Total libraries synced:', syncedLibraries.length);
    return syncedLibraries;
  } catch (error: any) {
    console.error('[JellyfinLibraries] Error syncing libraries:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    throw error; // Re-throw to let controller handle it
  }
};

const determineCollectionType = (library: JellyfinLibrary): 'movies' | 'tvshows' | 'music' | 'mixed' => {
  const collectionType = library.CollectionType;
  
  if (!collectionType) {
    return 'mixed';
  }
  
  if (typeof collectionType === 'string') {
    if (collectionType === 'movies') return 'movies';
    if (collectionType === 'tvshows') return 'tvshows';
    if (collectionType === 'music') return 'music';
    return 'mixed';
  }
  
  if (Array.isArray(collectionType)) {
    const typeArray = collectionType as string[];
    if (typeArray.includes('movies') && typeArray.length === 1) {
      return 'movies';
    }
    if (typeArray.includes('tvshows') && typeArray.length === 1) {
      return 'tvshows';
    }
    if (typeArray.includes('music') && typeArray.length === 1) {
      return 'music';
    }
  }
  
  return 'mixed';
};

export const getLibraries = async (configId: string): Promise<LibraryRecord[]> => {
  try {
    const result = await query(
      `SELECT * FROM jellyfin_libraries 
       WHERE config_id = $1 
       ORDER BY library_name`,
      [configId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      configId: row.config_id,
      libraryId: row.library_id,
      libraryName: row.library_name,
      collectionType: row.collection_type,
      isVisible: row.is_visible,
      itemCount: row.item_count,
      lastSync: row.last_sync,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting libraries:', error);
    return [];
  }
};

export const updateLibraryVisibility = async (
  libraryId: string,
  isVisible: boolean
): Promise<boolean> => {
  try {
    const result = await query(
      'UPDATE jellyfin_libraries SET is_visible = $1 WHERE id = $2 RETURNING id',
      [isVisible, libraryId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error updating library visibility:', error);
    return false;
  }
};

export const getVisibleLibraries = async (configId: string): Promise<LibraryRecord[]> => {
  try {
    const result = await query(
      `SELECT * FROM jellyfin_libraries 
       WHERE config_id = $1 AND is_visible = true
       ORDER BY library_name`,
      [configId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      configId: row.config_id,
      libraryId: row.library_id,
      libraryName: row.library_name,
      collectionType: row.collection_type,
      isVisible: row.is_visible,
      itemCount: row.item_count,
      lastSync: row.last_sync,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting visible libraries:', error);
    return [];
  }
};


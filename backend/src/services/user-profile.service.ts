import { query } from '../config/database';

export interface UserProfile {
  id: string;
  userId: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  language: string;
  subtitleLanguage: string;
  autoplayNext: boolean;
  qualityPreference: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  language: string;
  subtitleLanguage: string;
  videoQuality: string;
  autoplay: boolean;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const result = await query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default profile if doesn't exist
      return await createDefaultProfile(userId);
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      language: row.language || 'en',
      subtitleLanguage: row.subtitle_language || 'en',
      autoplayNext: row.autoplay_next ?? true,
      qualityPreference: row.quality_preference || 'auto',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

const createDefaultProfile = async (userId: string): Promise<UserProfile> => {
  const result = await query(
    `INSERT INTO user_profiles (user_id, language, subtitle_language, autoplay_next, quality_preference)
     VALUES ($1, 'en', 'en', true, 'auto')
     RETURNING *`,
    [userId]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    language: row.language,
    subtitleLanguage: row.subtitle_language,
    autoplayNext: row.autoplay_next,
    qualityPreference: row.quality_preference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const updateUserProfile = async (
  userId: string,
  data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  }
): Promise<UserProfile | null> => {
  try {
    // Ensure profile exists
    await getUserProfile(userId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(data.displayName);
    }
    if (data.bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      values.push(data.bio);
    }
    if (data.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatarUrl);
    }

    if (updates.length === 0) {
      return await getUserProfile(userId);
    }

    values.push(userId);
    const result = await query(
      `UPDATE user_profiles 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      language: row.language,
      subtitleLanguage: row.subtitle_language,
      autoplayNext: row.autoplay_next,
      qualityPreference: row.quality_preference,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null;
  }
};

export const getPreferences = async (userId: string): Promise<UserPreferences> => {
  const profile = await getUserProfile(userId);
  if (!profile) {
    return {
      language: 'en',
      subtitleLanguage: 'en',
      videoQuality: 'auto',
      autoplay: true,
    };
  }

  return {
    language: profile.language,
    subtitleLanguage: profile.subtitleLanguage,
    videoQuality: profile.qualityPreference,
    autoplay: profile.autoplayNext,
  };
};

export const updatePreferences = async (
  userId: string,
  preferences: UserPreferences
): Promise<UserProfile | null> => {
  try {
    // Ensure profile exists
    await getUserProfile(userId);

    const result = await query(
      `UPDATE user_profiles 
       SET language = $1, 
           subtitle_language = $2, 
           quality_preference = $3, 
           autoplay_next = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $5
       RETURNING *`,
      [
        preferences.language,
        preferences.subtitleLanguage,
        preferences.videoQuality,
        preferences.autoplay,
        userId,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      language: row.language,
      subtitleLanguage: row.subtitle_language,
      autoplayNext: row.autoplay_next,
      qualityPreference: row.quality_preference,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error updating preferences:', error);
    return null;
  }
};


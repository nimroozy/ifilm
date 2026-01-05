import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import {
  getUserProfile,
  updateUserProfile,
  getPreferences,
  updatePreferences,
} from '../services/user-profile.service';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Get user from database
    const userResult = await query(
      'SELECT id, email, username, role, avatar, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user profile
    const profile = await getUserProfile(userId);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.created_at,
      },
      profile: profile || null,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

export const updateProfileData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { username, email, displayName, bio, avatarUrl } = req.body;

    // Update user table if username or email changed
    if (username || email) {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (username) {
        // Check if username is already taken
        const existing = await query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, userId]
        );
        if (existing.rows.length > 0) {
          return res.status(400).json({ message: 'Username already taken' });
        }
        updates.push(`username = $${paramIndex++}`);
        values.push(username);
      }

      if (email) {
        // Check if email is already taken
        const existing = await query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, userId]
        );
        if (existing.rows.length > 0) {
          return res.status(400).json({ message: 'Email already taken' });
        }
        updates.push(`email = $${paramIndex++}`);
        values.push(email);
      }

      if (updates.length > 0) {
        values.push(userId);
        await query(
          `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
          values
        );
      }
    }

    // Update profile table
    const profileData: any = {};
    if (displayName !== undefined) profileData.displayName = displayName;
    if (bio !== undefined) profileData.bio = bio;
    if (avatarUrl !== undefined) profileData.avatarUrl = avatarUrl;

    let updatedProfile = null;
    if (Object.keys(profileData).length > 0) {
      updatedProfile = await updateUserProfile(userId, profileData);
    } else {
      updatedProfile = await getUserProfile(userId);
    }

    // Get updated user data
    const userResult = await query(
      'SELECT id, email, username, role, avatar, created_at FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      profile: updatedProfile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Get current password hash
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Failed to update password' });
  }
};

export const getUserPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const preferences = await getPreferences(userId);

    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'Failed to fetch preferences' });
  }
};

export const updateUserPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { language, subtitleLanguage, videoQuality, autoplay } = req.body;

    const preferences = {
      language: language || 'en',
      subtitleLanguage: subtitleLanguage || 'en',
      videoQuality: videoQuality || 'auto',
      autoplay: autoplay !== undefined ? autoplay : true,
    };

    const updatedProfile = await updatePreferences(userId, preferences);

    if (!updatedProfile) {
      return res.status(500).json({ message: 'Failed to update preferences' });
    }

    res.json({
      preferences: {
        language: updatedProfile.language,
        subtitleLanguage: updatedProfile.subtitleLanguage,
        videoQuality: updatedProfile.qualityPreference,
        autoplay: updatedProfile.autoplayNext,
      },
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
};


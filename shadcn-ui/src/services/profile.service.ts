import { User } from '@/types/auth.types';
import { api } from './api';
import { isDemoMode } from './mockAuth.service';

export interface ProfileUpdateData {
  username?: string;
  email?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface ProfilePreferences {
  language: string;
  subtitleLanguage: string;
  videoQuality: string;
  autoplay: boolean;
}

export interface UserProfile {
  user: User;
  profile: {
    id: string;
    userId: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    language: string;
    subtitleLanguage: string;
    autoplayNext: boolean;
    qualityPreference: string;
  } | null;
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
};

export const getProfile = async (): Promise<UserProfile | null> => {
  try {
    const response = await api.get('/user/profile');
    return response.data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

export const updateProfile = async (data: ProfileUpdateData): Promise<{ success: boolean; message: string; user?: User; profile?: any }> => {
  if (isDemoMode()) {
    // Demo mode: update localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return { success: false, message: 'User not found' };
    }

    const user: User = JSON.parse(userStr);

    // Validate email if provided
    if (data.email && !validateEmail(data.email)) {
      return { success: false, message: 'Invalid email format' };
    }

    // Update user data
    const updatedUser: User = {
      ...user,
      username: data.username || user.username,
      email: data.email || user.email,
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));

    return {
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }

  try {
    // Update profile via API
    const response = await api.put('/user/profile', {
      username: data.username,
      email: data.email,
      displayName: data.displayName,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
    });

    // Update password if provided
    if (data.newPassword) {
      if (!data.currentPassword) {
        return { success: false, message: 'Current password is required' };
      }
      const passwordValidation = validatePassword(data.newPassword);
      if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message || 'Invalid password' };
      }

      await api.put('/user/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    }

    // Update localStorage with new user data
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return {
      success: true,
      message: response.data.message || 'Profile updated successfully',
      user: response.data.user,
      profile: response.data.profile,
    };
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to update profile',
    };
  }
};

export const getPreferences = async (): Promise<ProfilePreferences> => {
  if (isDemoMode()) {
    const preferencesStr = localStorage.getItem('userPreferences');
    if (preferencesStr) {
      return JSON.parse(preferencesStr);
    }
    return {
      language: 'en',
      subtitleLanguage: 'en',
      videoQuality: 'auto',
      autoplay: true,
    };
  }

  try {
    const response = await api.get('/user/preferences');
    return response.data;
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return {
      language: 'en',
      subtitleLanguage: 'en',
      videoQuality: 'auto',
      autoplay: true,
    };
  }
};

export const updatePreferences = async (preferences: ProfilePreferences): Promise<{ success: boolean; message: string }> => {
  if (isDemoMode()) {
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
    return {
      success: true,
      message: 'Preferences updated successfully',
    };
  }

  try {
    const response = await api.put('/user/preferences', preferences);
    return {
      success: true,
      message: response.data.message || 'Preferences updated successfully',
    };
  } catch (error: any) {
    console.error('Error updating preferences:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to update preferences',
    };
  }
};
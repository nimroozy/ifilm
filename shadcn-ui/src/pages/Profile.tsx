import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User as UserIcon, Mail, Calendar, Shield, Settings, Video, Globe, Subtitles, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User } from '@/types/auth.types';
import { isDemoMode } from '@/services/mockAuth.service';
import { updateProfile, updatePreferences, getPreferences, ProfilePreferences } from '@/services/profile.service';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);

  // Profile form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Preferences state
  const [preferences, setPreferences] = useState<ProfilePreferences>({
    language: 'en',
    subtitleLanguage: 'en',
    videoQuality: 'auto',
    autoplay: true,
  });

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    // Load user data
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData: User = JSON.parse(userStr);
      setUser(userData);
      setUsername(userData.username);
      setEmail(userData.email);
    }

    // Check demo mode
    setIsDemo(isDemoMode());

    // Load preferences
    const userPreferences = getPreferences();
    setPreferences(userPreferences);
  }, [navigate]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate passwords match
      if (newPassword && newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        setLoading(false);
        return;
      }

      const result = await updateProfile({
        username,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      if (result.success && result.user) {
        setUser(result.user);
        toast.success(result.message);
        // Clear password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setLoading(true);

    try {
      const result = await updatePreferences(preferences);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    toast.info('Changes discarded');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Header */}
      <header className="bg-[#1F1F1F] border-b border-[#2A2A2A]">
        <div className="container mx-auto px-8 md:px-16 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" className="text-white hover:text-[#B3B3B3]">
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-white">My Profile</h1>
              {isDemo && (
                <Badge variant="outline" className="bg-[#E50914]/20 text-[#E50914] border-[#E50914]/50">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Demo Mode
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-8 md:px-16 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Info Card */}
          <div className="lg:col-span-1">
            <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white">Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-[#E50914] flex items-center justify-center mb-4">
                    <UserIcon className="h-12 w-12 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">{user.username}</h2>
                  <p className="text-[#B3B3B3] text-sm">{user.email}</p>
                </div>

                <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
                  <div className="flex items-center gap-3 text-[#B3B3B3]">
                    <Calendar className="h-5 w-5" />
                    <div>
                      <p className="text-sm text-white">Member Since</p>
                      <p className="text-xs">{new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[#B3B3B3]">
                    <Shield className="h-5 w-5" />
                    <div>
                      <p className="text-sm text-white">Account Type</p>
                      <p className="text-xs capitalize">{user.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[#B3B3B3]">
                    <Mail className="h-5 w-5" />
                    <div>
                      <p className="text-sm text-white">Email Status</p>
                      <p className="text-xs text-green-500">Verified</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="bg-[#1F1F1F] border-[#2A2A2A]">
                <TabsTrigger value="account" className="data-[state=active]:bg-[#E50914]">
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </TabsTrigger>
                <TabsTrigger value="preferences" className="data-[state=active]:bg-[#E50914]">
                  <Video className="h-4 w-4 mr-2" />
                  Preferences
                </TabsTrigger>
              </TabsList>

              {/* Account Settings Tab */}
              <TabsContent value="account">
                <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
                  <CardHeader>
                    <CardTitle className="text-white">Edit Profile</CardTitle>
                    <CardDescription className="text-[#B3B3B3]">
                      Update your account information and password
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                      {/* Username */}
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-white">Username</Label>
                        <Input
                          id="username"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-[#E50914]"
                          required
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-white">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-[#E50914]"
                          required
                        />
                      </div>

                      {/* Password Section */}
                      <div className="pt-4 border-t border-[#2A2A2A]">
                        <h3 className="text-white font-semibold mb-4">Change Password</h3>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="currentPassword" className="text-white">Current Password</Label>
                            <Input
                              id="currentPassword"
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-[#E50914]"
                              placeholder="Leave blank to keep current password"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-white">New Password</Label>
                            <Input
                              id="newPassword"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-[#E50914]"
                              placeholder="Minimum 8 characters"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-[#E50914]"
                              placeholder="Re-enter new password"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-4 pt-4">
                        <Button
                          type="submit"
                          className="bg-[#E50914] hover:bg-[#F40612] text-white"
                          disabled={loading}
                        >
                          {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-[#3A3A3A] text-white hover:bg-[#2A2A2A]"
                          onClick={handleCancel}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Preferences Tab */}
              <TabsContent value="preferences">
                <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
                  <CardHeader>
                    <CardTitle className="text-white">Viewing Preferences</CardTitle>
                    <CardDescription className="text-[#B3B3B3]">
                      Customize your streaming experience
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Language */}
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Language
                      </Label>
                      <Select
                        value={preferences.language}
                        onValueChange={(value) => setPreferences({ ...preferences, language: value })}
                      >
                        <SelectTrigger className="bg-[#2A2A2A] border-[#3A3A3A] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1F1F1F] border-[#2A2A2A]">
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Subtitle Language */}
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        <Subtitles className="h-4 w-4" />
                        Subtitle Language
                      </Label>
                      <Select
                        value={preferences.subtitleLanguage}
                        onValueChange={(value) => setPreferences({ ...preferences, subtitleLanguage: value })}
                      >
                        <SelectTrigger className="bg-[#2A2A2A] border-[#3A3A3A] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1F1F1F] border-[#2A2A2A]">
                          <SelectItem value="off">Off</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Video Quality */}
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Video Quality
                      </Label>
                      <Select
                        value={preferences.videoQuality}
                        onValueChange={(value) => setPreferences({ ...preferences, videoQuality: value })}
                      >
                        <SelectTrigger className="bg-[#2A2A2A] border-[#3A3A3A] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1F1F1F] border-[#2A2A2A]">
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                          <SelectItem value="720p">720p (HD)</SelectItem>
                          <SelectItem value="480p">480p (SD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Autoplay */}
                    <div className="flex items-center justify-between py-4 border-t border-[#2A2A2A]">
                      <div>
                        <Label className="text-white">Autoplay Next Episode</Label>
                        <p className="text-sm text-[#B3B3B3]">Automatically play the next episode</p>
                      </div>
                      <Switch
                        checked={preferences.autoplay}
                        onCheckedChange={(checked) => setPreferences({ ...preferences, autoplay: checked })}
                      />
                    </div>

                    {/* Save Button */}
                    <div className="pt-4">
                      <Button
                        onClick={handlePreferencesUpdate}
                        className="bg-[#E50914] hover:bg-[#F40612] text-white"
                        disabled={loading}
                      >
                        {loading ? 'Saving...' : 'Save Preferences'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
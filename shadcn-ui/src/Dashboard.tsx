import { useEffect, useState } from 'react';
import { Users, Film, Activity, HardDrive, RefreshCw, Settings, Library, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import AdminLayout from '@/components/admin/AdminLayout';
import { getSystemStats, getActivityLogs, SystemStats, ActivityLog, clearCache } from '@/services/admin.service';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, logsData] = await Promise.all([
        getSystemStats(),
        getActivityLogs(),
      ]);
      setStats(statsData);
      setActivityLogs(logsData);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadData();
    toast.success('Dashboard refreshed');
  };

  const handleClearCache = async (cacheType: 'jellyfin' | 'nginx' | 'all' = 'all') => {
    try {
      const result = await clearCache(cacheType);
      if (result.success) {
        toast.success(result.message || 'Cache cleared successfully');
        // Refresh dashboard data after clearing cache
        await loadData();
      } else {
        toast.error(result.message || 'Failed to clear cache');
      }
    } catch (error) {
      toast.error('Failed to clear cache');
      console.error('Clear cache error:', error);
    }
  };

  if (loading || !stats) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-white">Loading dashboard...</p>
        </div>
      </AdminLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-600';
      case 'disconnected':
        return 'bg-yellow-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registered':
      case 'user_login':
        return <Users className="h-4 w-4" />;
      case 'movie_watched':
        return <Film className="h-4 w-4" />;
      case 'library_synced':
        return <Library className="h-4 w-4" />;
      case 'settings_updated':
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-[#B3B3B3] mt-1">Monitor and manage your iFilm platform</p>
          </div>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="bg-red-600/20 hover:bg-red-600/30 border-red-600/50 text-white">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Cache
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#1F1F1F] border-[#2A2A2A]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Clear Cache</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#B3B3B3]">
                    This will clear cached data from Jellyfin and Nginx to show updated movies and series.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-2 py-4">
                  <Button
                    onClick={() => handleClearCache('jellyfin')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Clear Jellyfin Cache Only
                  </Button>
                  <Button
                    onClick={() => handleClearCache('nginx')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Clear Nginx Cache Only
                  </Button>
                  <Button
                    onClick={() => handleClearCache('all')}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    Clear All Caches
                  </Button>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-[#2A2A2A] text-white hover:bg-[#3A3A3A]">
                    Cancel
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={handleRefresh} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#B3B3B3]">Total Users</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-[#B3B3B3] mt-1">Registered accounts</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#B3B3B3]">Total Content</CardTitle>
              <Film className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {(stats.totalMovies + stats.totalSeries).toLocaleString()}
              </div>
              <p className="text-xs text-[#B3B3B3] mt-1">
                {stats.totalMovies} movies, {stats.totalSeries} series
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#B3B3B3]">Active Streams</CardTitle>
              <Activity className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.activeStreams}</div>
              <p className="text-xs text-[#B3B3B3] mt-1">Currently watching</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#B3B3B3]">Storage</CardTitle>
              <HardDrive className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.storageUsed}</div>
              <p className="text-xs text-[#B3B3B3] mt-1">of {stats.storageTotal} used</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Health */}
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader>
              <CardTitle className="text-white">System Health</CardTitle>
              <CardDescription className="text-[#B3B3B3]">Current system status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(stats.jellyfinStatus)}`} />
                  <span className="text-white">Jellyfin Server</span>
                </div>
                <Badge variant="outline" className="text-white border-[#2A2A2A]">
                  {stats.jellyfinStatus}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white">API Response Time</span>
                <Badge variant="outline" className="text-white border-[#2A2A2A]">
                  {stats.apiResponseTime}ms
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
              <CardDescription className="text-[#B3B3B3]">Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => navigate('/admin/libraries')}
                className="w-full justify-start bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white"
              >
                <Library className="h-4 w-4 mr-2" />
                Sync Libraries
              </Button>
              <Button
                onClick={() => navigate('/admin/users')}
                className="w-full justify-start bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
              <Button
                onClick={() => navigate('/admin/jellyfin-settings')}
                className="w-full justify-start bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white"
              >
                <Settings className="h-4 w-4 mr-2" />
                Server Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-[#B3B3B3]">Latest system events and user actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 pb-4 border-b border-[#2A2A2A] last:border-0 last:pb-0">
                  <div className="p-2 bg-blue-600/20 rounded-lg text-blue-600">
                    {getActivityIcon(log.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm">{log.message}</p>
                    <p className="text-xs text-[#B3B3B3] mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
import { useState, useEffect } from 'react';
import { HardDrive, Save, RefreshCw, CheckCircle, XCircle, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import AdminLayout from '@/components/admin/AdminLayout';
import { getCacheConfig, saveCacheConfig, updateCacheConfigEnabled, reloadNginxConfig, CacheConfig } from '@/services/admin.service';
import { toast } from 'sonner';

export default function CacheSettings() {
  const [configs, setConfigs] = useState<CacheConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const configsData = await getCacheConfig();
      setConfigs(configsData);
    } catch (error: any) {
      console.error('Error loading cache configs:', error);
      toast.error('Failed to load cache configuration');
    } finally {
      setLoading(false);
    }
  };

  const getConfig = (type: 'images' | 'videos' | 'all'): CacheConfig | null => {
    return configs.find(c => c.cache_type === type) || null;
  };

  const updateConfig = (type: 'images' | 'videos' | 'all', updates: Partial<CacheConfig>) => {
    setConfigs(prev => prev.map(c => c.cache_type === type ? { ...c, ...updates } : c));
  };

  const handleSaveConfig = async (type: 'images' | 'videos' | 'all') => {
    const config = getConfig(type);
    if (!config) return;

    setSaving(type);
    try {
      const result = await saveCacheConfig({
        cacheType: type,
        maxSize: config.max_size,
        inactiveTime: config.inactive_time,
        cacheValid200: config.cache_valid_200,
        cacheValid404: config.cache_valid_404,
        isEnabled: config.is_enabled,
      });

      if (result.success) {
        toast.success(`Cache configuration for ${type} saved successfully`);
        await loadConfigs();
      } else {
        toast.error(result.message || 'Failed to save configuration');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleEnabled = async (type: 'images' | 'videos' | 'all', enabled: boolean) => {
    try {
      const result = await updateCacheConfigEnabled(type, enabled);
      if (result.success) {
        updateConfig(type, { is_enabled: enabled });
        toast.success(`Cache for ${type} ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(result.message || 'Failed to update cache status');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update cache status');
    }
  };

  const handleReloadNginx = async () => {
    setReloading(true);
    try {
      const result = await reloadNginxConfig();
      if (result.success) {
        toast.success('NGINX configuration reloaded successfully');
      } else {
        const errorMsg = result.message || 'Failed to reload NGINX';
        const hint = (error as any)?.response?.data?.hint || '';
        toast.error(`${errorMsg}${hint ? ` - ${hint}` : ''}`, {
          duration: 10000,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to reload NGINX';
      const hint = error.response?.data?.hint || '';
      toast.error(`${errorMsg}${hint ? ` - ${hint}` : ''}`, {
        duration: 10000,
      });
    } finally {
      setReloading(false);
    }
  };

  const renderConfigCard = (type: 'images' | 'videos' | 'all', title: string, description: string) => {
    const config = getConfig(type);
    if (!config) return null;

    return (
      <Card key={type}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config.is_enabled ? 'default' : 'secondary'}>
                {config.is_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch
                checked={config.is_enabled}
                onCheckedChange={(checked) => handleToggleEnabled(type, checked)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${type}-max-size`}>Max Cache Size</Label>
              <Input
                id={`${type}-max-size`}
                value={config.max_size}
                onChange={(e) => updateConfig(type, { max_size: e.target.value })}
                placeholder="e.g., 10g, 50g, 100g"
                disabled={!config.is_enabled}
              />
              <p className="text-xs text-muted-foreground">Maximum cache size (e.g., 10g, 50g, 100g)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-inactive-time`}>Inactive Time</Label>
              <Input
                id={`${type}-inactive-time`}
                value={config.inactive_time}
                onChange={(e) => updateConfig(type, { inactive_time: e.target.value })}
                placeholder="e.g., 7d, 30d, 90d"
                disabled={!config.is_enabled}
              />
              <p className="text-xs text-muted-foreground">Time before inactive cache is removed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-valid-200`}>Cache Valid (200 OK)</Label>
              <Input
                id={`${type}-valid-200`}
                value={config.cache_valid_200}
                onChange={(e) => updateConfig(type, { cache_valid_200: e.target.value })}
                placeholder="e.g., 7d, 30d"
                disabled={!config.is_enabled}
              />
              <p className="text-xs text-muted-foreground">How long to cache successful responses</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-valid-404`}>Cache Valid (404)</Label>
              <Input
                id={`${type}-valid-404`}
                value={config.cache_valid_404}
                onChange={(e) => updateConfig(type, { cache_valid_404: e.target.value })}
                placeholder="e.g., 1h, 24h"
                disabled={!config.is_enabled}
              />
              <p className="text-xs text-muted-foreground">How long to cache 404 errors</p>
            </div>
          </div>
          <Button
            onClick={() => handleSaveConfig(type)}
            disabled={saving === type || !config.is_enabled}
            className="w-full"
          >
            {saving === type ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cache Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Configure NGINX cache settings for images and videos to improve website performance
            </p>
          </div>
          <Button
            onClick={handleReloadNginx}
            disabled={reloading}
            variant="outline"
          >
            {reloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reloading...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload NGINX
              </>
            )}
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Cache Configuration</AlertTitle>
          <AlertDescription>
            Configure cache settings for different content types. After saving, click "Reload NGINX" to apply changes.
            Cache directories are created automatically at <code className="text-xs">/var/cache/nginx/</code>
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          {renderConfigCard(
            'images',
            'Image Cache',
            'Cache configuration for images (posters, backdrops, etc.)'
          )}
          {renderConfigCard(
            'videos',
            'Video Cache',
            'Cache configuration for video streams (HLS playlists and segments)'
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cache Management</CardTitle>
            <CardDescription>
              After updating cache settings, reload NGINX to apply changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Cache configuration is stored in the database and applied to NGINX when reloaded.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run the update script: <code className="text-xs">/opt/ifilm/backend/scripts/update-nginx-cache.sh</code>
                </p>
              </div>
              <Button
                onClick={handleReloadNginx}
                disabled={reloading}
              >
                {reloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reloading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reload NGINX Config
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}


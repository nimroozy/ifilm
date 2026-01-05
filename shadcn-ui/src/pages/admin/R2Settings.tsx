import { useState, useEffect } from 'react';
import { Cloud, Key, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AdminLayout from '@/components/admin/AdminLayout';
import { getR2Config, saveR2Config, testR2Connection, R2Config } from '@/services/admin.service';
import { toast } from 'sonner';

export default function R2Settings() {
  const [accountId, setAccountId] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [region, setRegion] = useState('auto');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await getR2Config();
      if (config) {
        setAccountId(config.accountId);
        setAccessKeyId(config.accessKeyId);
        setBucketName(config.bucketName);
        setPublicUrl(config.publicUrl || '');
        setEndpointUrl(config.endpointUrl || `https://${config.accountId}.r2.cloudflarestorage.com`);
        setRegion(config.region || 'auto');
      }
    } catch (error) {
      console.error('Error loading R2 config:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      toast.error('Please enter all required fields');
      return;
    }

    setTesting(true);
    setConnectionStatus('idle');
    setErrorMessage('');

    try {
      const result = await testR2Connection({
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        endpointUrl: endpointUrl || `https://${accountId}.r2.cloudflarestorage.com`,
        region,
      });

      if (result.success) {
        setConnectionStatus('success');
        toast.success(result.message);
      } else {
        setConnectionStatus('error');
        setErrorMessage(result.message);
        toast.error(result.message);
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Failed to test connection');
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      toast.error('Please enter all required fields');
      return;
    }

    setSaving(true);

    try {
      const result = await saveR2Config({
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl: publicUrl || undefined,
        endpointUrl: endpointUrl || undefined,
        region: region || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        // Clear secret key from state after saving
        setSecretAccessKey('');
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">R2 Storage Settings</h1>
          <p className="text-[#B3B3B3] mt-1">Configure your Cloudflare R2 storage connection</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white">R2 Configuration</CardTitle>
                <CardDescription className="text-[#B3B3B3]">
                  Enter your Cloudflare R2 storage details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Account ID */}
                <div className="space-y-2">
                  <Label htmlFor="accountId" className="text-white flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Account ID
                  </Label>
                  <Input
                    id="accountId"
                    type="text"
                    placeholder="your-account-id"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600"
                  />
                  <p className="text-xs text-[#B3B3B3]">
                    Your Cloudflare Account ID (found in R2 Dashboard)
                  </p>
                </div>

                {/* Access Key ID */}
                <div className="space-y-2">
                  <Label htmlFor="accessKeyId" className="text-white flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Access Key ID
                  </Label>
                  <Input
                    id="accessKeyId"
                    type="text"
                    placeholder="Enter your Access Key ID"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600"
                  />
                  <p className="text-xs text-[#B3B3B3]">
                    R2 API Token Access Key ID
                  </p>
                </div>

                {/* Secret Access Key */}
                <div className="space-y-2">
                  <Label htmlFor="secretAccessKey" className="text-white flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Secret Access Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="secretAccessKey"
                      type={showSecretKey ? 'text' : 'password'}
                      placeholder="Enter your Secret Access Key"
                      value={secretAccessKey}
                      onChange={(e) => setSecretAccessKey(e.target.value)}
                      className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600 pr-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 text-[#B3B3B3] hover:text-white"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                    >
                      {showSecretKey ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  <p className="text-xs text-[#B3B3B3]">
                    R2 API Token Secret Access Key (only required when saving new config)
                  </p>
                </div>

                {/* Bucket Name */}
                <div className="space-y-2">
                  <Label htmlFor="bucketName" className="text-white">
                    Bucket Name
                  </Label>
                  <Input
                    id="bucketName"
                    type="text"
                    placeholder="my-bucket"
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600"
                  />
                  <p className="text-xs text-[#B3B3B3]">
                    Your R2 bucket name
                  </p>
                </div>

                {/* Endpoint URL */}
                <div className="space-y-2">
                  <Label htmlFor="endpointUrl" className="text-white">
                    Endpoint URL
                  </Label>
                  <Input
                    id="endpointUrl"
                    type="url"
                    placeholder={`https://${accountId || 'account-id'}.r2.cloudflarestorage.com`}
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600"
                  />
                  <p className="text-xs text-[#B3B3B3]">
                    R2 endpoint URL (defaults to Cloudflare R2 endpoint)
                  </p>
                </div>

                {/* Public URL (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="publicUrl" className="text-white">
                    Public URL (Optional)
                  </Label>
                  <Input
                    id="publicUrl"
                    type="url"
                    placeholder="https://your-bucket.r2.dev"
                    value={publicUrl}
                    onChange={(e) => setPublicUrl(e.target.value)}
                    className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600"
                  />
                  <p className="text-xs text-[#B3B3B3]">
                    Custom domain or R2.dev public URL for public file access
                  </p>
                </div>

                {/* Region */}
                <div className="space-y-2">
                  <Label htmlFor="region" className="text-white">
                    Region
                  </Label>
                  <Input
                    id="region"
                    type="text"
                    placeholder="auto"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600"
                  />
                  <p className="text-xs text-[#B3B3B3]">
                    R2 region (default: auto)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={handleTestConnection}
                    disabled={testing || saving}
                    className="bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={testing || saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Connection Status */}
            {connectionStatus === 'success' && (
              <Alert className="bg-[#1F1F1F] border-green-600">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-white">Connection Successful</AlertTitle>
                <AlertDescription className="text-[#B3B3B3]">
                  Successfully connected to R2 bucket
                </AlertDescription>
              </Alert>
            )}

            {connectionStatus === 'error' && (
              <Alert className="bg-[#1F1F1F] border-red-600">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-white">Connection Failed</AlertTitle>
                <AlertDescription className="text-[#B3B3B3]">
                  {errorMessage || 'Failed to connect to R2 bucket'}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Info Card */}
          <div className="space-y-6">
            <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white">About R2 Storage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-[#B3B3B3]">
                <p>
                  Cloudflare R2 is an S3-compatible object storage service that allows you to store and serve files.
                </p>
                <div>
                  <p className="text-white font-semibold mb-2">To get your credentials:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Go to Cloudflare Dashboard</li>
                    <li>Navigate to R2 → Manage R2 API Tokens</li>
                    <li>Create a new API token</li>
                    <li>Copy the Access Key ID and Secret Access Key</li>
                    <li>Enter your Account ID and Bucket Name</li>
                  </ol>
                </div>
                <div className="pt-4 border-t border-[#2A2A2A]">
                  <Button
                    onClick={() => window.open('https://dash.cloudflare.com', '_blank')}
                    variant="outline"
                    className="w-full border-blue-600 text-blue-600 hover:bg-blue-600/10"
                  >
                    Open Cloudflare Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


import { useState, useEffect } from 'react';
import { Server, Key, CheckCircle, XCircle, Loader2, AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/admin/AdminLayout';
import { saveJellyfinSettings, getJellyfinSettings } from '@/services/admin.service';
import { testJellyfinConnection } from '@/services/jellyfin.service';
import { toast } from 'sonner';

export default function JellyfinSettings() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [serverInfo, setServerInfo] = useState<{ name: string; version: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [detailedError, setDetailedError] = useState<string>('');
  const [isCorsError, setIsCorsError] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  useEffect(() => {
    // Load existing settings
    const settings = getJellyfinSettings();
    if (settings) {
      setServerUrl(settings.serverUrl);
      setApiKey(settings.apiKey);
    }
  }, []);

  const handleTestConnection = async () => {
    if (!serverUrl || !apiKey) {
      toast.error('Please enter both Server URL and API Key');
      return;
    }

    setTesting(true);
    setConnectionStatus('idle');
    setErrorMessage('');
    setDetailedError('');
    setIsCorsError(false);

    try {
      const result = await testJellyfinConnection(serverUrl, apiKey);
      
      if (result.success) {
        setConnectionStatus('success');
        setServerInfo(result.serverInfo || null);
        toast.success(result.message);
      } else {
        setConnectionStatus('error');
        setErrorMessage(result.message);
        setDetailedError(result.detailedError || '');
        setIsCorsError(result.isCorsError || false);
        toast.error(result.message);
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage('Failed to test connection');
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!serverUrl || !apiKey) {
      toast.error('Please enter both Server URL and API Key');
      return;
    }

    setSaving(true);

    try {
      const result = await saveJellyfinSettings({ serverUrl, apiKey });
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyOriginToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedOrigin(true);
      toast.success('Origin URL copied to clipboard!');
      setTimeout(() => setCopiedOrigin(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Jellyfin Settings</h1>
          <p className="text-[#B3B3B3] mt-1">Configure your Jellyfin server connection</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white">Server Configuration</CardTitle>
                <CardDescription className="text-[#B3B3B3]">
                  Enter your Jellyfin server details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Server URL */}
                <div className="space-y-2">
                  <Label htmlFor="serverUrl" className="text-white flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Server URL
                  </Label>
                  <Input
                    id="serverUrl"
                    type="url"
                    placeholder="http://localhost:8096"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600"
                  />
                  <p className="text-xs text-[#B3B3B3]">
                    The URL of your Jellyfin server (e.g., http://192.168.1.100:8096)
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-white flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your Jellyfin API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-[#2A2A2A] border-[#3A3A3A] text-white focus:border-blue-600 pr-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 text-[#B3B3B3] hover:text-white"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  <p className="text-xs text-[#B3B3B3]">
                    Generate an API key in Jellyfin Dashboard → API Keys
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

            {/* CORS Error Alert */}
            {isCorsError && (
              <Alert className="bg-[#1F1F1F] border-yellow-600">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-white text-lg">CORS Configuration Required</AlertTitle>
                <AlertDescription className="text-[#B3B3B3] space-y-4">
                  <p className="font-semibold text-white">{errorMessage}</p>
                  {detailedError && (
                    <div className="bg-[#2A2A2A] p-3 rounded text-xs">
                      <p className="text-[#B3B3B3]">{detailedError}</p>
                    </div>
                  )}
                  
                  <Separator className="bg-[#3A3A3A]" />
                  
                  <div className="space-y-3">
                    <p className="font-semibold text-white">How to Fix CORS Error:</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Open your Jellyfin Dashboard at: <code className="bg-[#2A2A2A] px-2 py-1 rounded">{serverUrl}</code></li>
                      <li>Navigate to: <strong className="text-white">Dashboard → Networking</strong></li>
                      <li>Scroll down to the <strong className="text-white">CORS</strong> section</li>
                      <li>
                        Add this URL to allowed origins:
                        <div className="flex items-center gap-2 mt-2">
                          <code className="bg-[#2A2A2A] px-3 py-2 rounded flex-1 text-blue-400">
                            {window.location.origin}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={copyOriginToClipboard}
                            className="border-blue-600 text-blue-600 hover:bg-blue-600/10"
                          >
                            {copiedOrigin ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" />
                                Copy URL
                              </>
                            )}
                          </Button>
                        </div>
                      </li>
                      <li>Click <strong className="text-white">Save</strong> and restart Jellyfin server</li>
                      <li>Come back here and click <strong className="text-white">Test Connection</strong> again</li>
                    </ol>
                  </div>

                  <Separator className="bg-[#3A3A3A]" />

                  <div className="space-y-2">
                    <p className="font-semibold text-white text-sm">Alternative Solutions:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Use a backend proxy (recommended for production)</li>
                      <li>Use a reverse proxy like Nginx to serve both apps on same domain</li>
                      <li>For development only: Use a browser extension to bypass CORS</li>
                    </ul>
                  </div>

                  <div className="pt-2">
                    <a 
                      href="/docs/jellyfin_cors_setup.md" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                    >
                      View Detailed CORS Setup Guide
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* General Error Alert */}
            {connectionStatus === 'error' && !isCorsError && (
              <Alert className="bg-[#1F1F1F] border-red-600">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-white">Connection Failed</AlertTitle>
                <AlertDescription className="text-[#B3B3B3] space-y-3">
                  <p className="font-semibold text-white">{errorMessage}</p>
                  {detailedError && (
                    <div className="bg-[#2A2A2A] p-3 rounded text-xs">
                      <p className="text-[#B3B3B3] font-mono">{detailedError}</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <p className="font-semibold text-white text-sm">Troubleshooting:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm mt-1">
                      <li>Verify the server URL is correct and accessible</li>
                      <li>Ensure your Jellyfin server is running</li>
                      <li>Check that the API key is valid (Dashboard → API Keys)</li>
                      <li>Make sure there are no firewall restrictions</li>
                      <li>Check browser console (F12) for detailed error messages</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Connection Status */}
            <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white">Connection Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectionStatus === 'idle' && (
                  <div className="text-center py-8">
                    <Server className="h-12 w-12 mx-auto text-[#B3B3B3] mb-4" />
                    <p className="text-[#B3B3B3] text-sm">
                      Test connection to see status
                    </p>
                  </div>
                )}

                {connectionStatus === 'success' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Connected</span>
                    </div>
                    {serverInfo && (
                      <div className="space-y-2 pt-2 border-t border-[#2A2A2A]">
                        <div>
                          <p className="text-xs text-[#B3B3B3]">Server Name</p>
                          <p className="text-white">{serverInfo.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#B3B3B3]">Version</p>
                          <p className="text-white">{serverInfo.version}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {connectionStatus === 'error' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      <span className="font-semibold">Connection Failed</span>
                    </div>
                    <p className="text-xs text-[#B3B3B3]">
                      Check the error details above and follow the troubleshooting steps.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Debug Info */}
            <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white text-sm">Debug Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="text-[#B3B3B3]">Current Origin:</p>
                  <code className="text-blue-400 break-all">{window.location.origin}</code>
                </div>
                <div>
                  <p className="text-[#B3B3B3]">Browser Console:</p>
                  <p className="text-white">Press F12 to view detailed logs</p>
                </div>
              </CardContent>
            </Card>

            {/* Setup Guide */}
            <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white">Quick Setup Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#B3B3B3]">
                <div>
                  <p className="font-semibold text-white mb-1">1. Install Jellyfin</p>
                  <p>Download from jellyfin.org</p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">2. Generate API Key</p>
                  <p>Dashboard → API Keys → Create</p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">3. Enable CORS</p>
                  <p>Dashboard → Networking → CORS</p>
                  <p className="text-xs mt-1">Add: <code className="bg-[#2A2A2A] px-1 py-0.5 rounded">{window.location.origin}</code></p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">4. Enter Details</p>
                  <p>Copy server URL and API key</p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">5. Test & Save</p>
                  <p>Test connection, then save</p>
                </div>
                <div className="pt-2 border-t border-[#2A2A2A]">
                  <a 
                    href="https://jellyfin.org/docs/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Jellyfin Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
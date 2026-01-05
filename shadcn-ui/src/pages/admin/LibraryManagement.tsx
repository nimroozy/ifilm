import { useEffect, useState } from 'react';
import { Library as LibraryIcon, RefreshCw, Eye, EyeOff, Film, Tv } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AdminLayout from '@/components/admin/AdminLayout';
import { getLibraries, toggleLibraryVisibility, syncLibraries, Library } from '@/services/admin.service';
import { toast } from 'sonner';

export default function LibraryManagement() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadLibraries();
  }, []);

  const loadLibraries = async () => {
    try {
      const data = await getLibraries();
      setLibraries(data);
    } catch (error) {
      toast.error('Failed to load libraries');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (libraryId: string) => {
    try {
      const result = await toggleLibraryVisibility(libraryId);
      if (result.success) {
        await loadLibraries();
        toast.success(result.message);
      }
    } catch (error) {
      toast.error('Failed to update library visibility');
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await syncLibraries();
      if (result.success) {
        await loadLibraries();
        toast.success(result.message);
      }
    } catch (error) {
      toast.error('Failed to sync libraries');
    } finally {
      setSyncing(false);
    }
  };

  const getLibraryIcon = (type: string) => {
    switch (type) {
      case 'movies':
        return <Film className="h-5 w-5" />;
      case 'series':
        return <Tv className="h-5 w-5" />;
      default:
        return <LibraryIcon className="h-5 w-5" />;
    }
  };

  const visibleCount = libraries.filter(lib => lib.visible).length;
  const totalItems = libraries.reduce((sum, lib) => sum + lib.itemCount, 0);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-white">Loading libraries...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Library Management</h1>
            <p className="text-[#B3B3B3] mt-1">Manage your Jellyfin media libraries</p>
          </div>
          <Button
            onClick={handleSyncAll}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync All'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#B3B3B3]">Total Libraries</CardTitle>
              <LibraryIcon className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{libraries.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#B3B3B3]">Visible Libraries</CardTitle>
              <Eye className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{visibleCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#B3B3B3]">Total Items</CardTitle>
              <Film className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{totalItems.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Libraries Table */}
        <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
          <CardHeader>
            <CardTitle className="text-white">Libraries</CardTitle>
            <CardDescription className="text-[#B3B3B3]">
              Control which libraries are visible to users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-[#2A2A2A]">
                  <TableHead className="text-[#B3B3B3]">Library</TableHead>
                  <TableHead className="text-[#B3B3B3]">Type</TableHead>
                  <TableHead className="text-[#B3B3B3]">Items</TableHead>
                  <TableHead className="text-[#B3B3B3]">Last Sync</TableHead>
                  <TableHead className="text-[#B3B3B3]">Visibility</TableHead>
                  <TableHead className="text-[#B3B3B3]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {libraries.map((library) => (
                  <TableRow key={library.id} className="border-[#2A2A2A] hover:bg-[#2A2A2A]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-600">
                          {getLibraryIcon(library.type)}
                        </div>
                        <span className="text-white font-medium">{library.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-white border-[#2A2A2A] capitalize">
                        {library.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white">{library.itemCount.toLocaleString()}</TableCell>
                    <TableCell className="text-[#B3B3B3] text-sm">
                      {new Date(library.lastSync).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={library.visible}
                        onCheckedChange={() => handleToggleVisibility(library.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {library.visible ? (
                        <Badge className="bg-green-600 hover:bg-green-700">
                          <Eye className="h-3 w-3 mr-1" />
                          Visible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[#B3B3B3] border-[#2A2A2A]">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
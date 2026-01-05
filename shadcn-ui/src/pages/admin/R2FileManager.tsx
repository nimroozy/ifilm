import { useEffect, useState, useRef } from 'react';
import { 
  Upload, Download, File, Folder, Trash2, Edit2, Move, 
  RefreshCw, Search, ArrowLeft, MoreVertical, Loader2 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AdminLayout from '@/components/admin/AdminLayout';
import { 
  listR2Files, uploadR2File, downloadR2File, renameR2File, 
  moveR2File, deleteR2File, R2File, R2ListResponse 
} from '@/services/admin.service';
import { toast } from 'sonner';

export default function R2FileManager() {
  const [files, setFiles] = useState<R2File[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<R2File | null>(null);
  
  // Dialogs
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  
  // Form states
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPath, setUploadPath] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, [currentPrefix]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await listR2Files(currentPrefix);
      setFiles(result.files);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (key: string) => {
    if (key.endsWith('/')) {
      setCurrentPrefix(key);
    }
  };

  const handleGoUp = () => {
    if (currentPrefix) {
      const parts = currentPrefix.split('/').filter(Boolean);
      parts.pop();
      setCurrentPrefix(parts.length > 0 ? parts.join('/') + '/' : '');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const key = uploadPath ? `${uploadPath}${uploadPath.endsWith('/') ? '' : '/'}${uploadFile.name}` : uploadFile.name;
      await uploadR2File(uploadFile, key);
      toast.success('File uploaded successfully');
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadPath('');
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: R2File) => {
    try {
      const result = await downloadR2File(file.key, true);
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to download file');
    }
  };

  const handleRename = async () => {
    if (!selectedFile || !newName.trim()) {
      toast.error('Please enter a new name');
      return;
    }

    try {
      const newKey = selectedFile.key.replace(selectedFile.name, newName.trim());
      await renameR2File(selectedFile.key, newKey);
      toast.success('File renamed successfully');
      setShowRenameDialog(false);
      setSelectedFile(null);
      setNewName('');
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename file');
    }
  };

  const handleMove = async () => {
    if (!selectedFile || !newPath.trim()) {
      toast.error('Please enter a new path');
      return;
    }

    try {
      const newKey = newPath.trim().endsWith('/') 
        ? `${newPath.trim()}${selectedFile.name}`
        : `${newPath.trim()}/${selectedFile.name}`;
      await moveR2File(selectedFile.key, newKey);
      toast.success('File moved successfully');
      setShowMoveDialog(false);
      setSelectedFile(null);
      setNewPath('');
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to move file');
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    try {
      await deleteR2File(selectedFile.key);
      toast.success('File deleted successfully');
      setShowDeleteDialog(false);
      setSelectedFile(null);
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  const filteredFiles = files.filter(file => {
    if (!searchQuery) return true;
    return file.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const breadcrumbs = currentPrefix ? currentPrefix.split('/').filter(Boolean) : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">R2 File Manager</h1>
            <p className="text-[#B3B3B3] mt-1">Manage files in your R2 storage bucket</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
            <Button
              onClick={loadFiles}
              disabled={loading}
              variant="outline"
              className="border-[#3A3A3A] text-white hover:bg-[#2A2A2A]"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPrefix('')}
            className="text-[#B3B3B3] hover:text-white"
          >
            Root
          </Button>
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-[#B3B3B3]">/</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const path = breadcrumbs.slice(0, index + 1).join('/') + '/';
                  setCurrentPrefix(path);
                }}
                className="text-[#B3B3B3] hover:text-white"
              >
                {crumb}
              </Button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#B3B3B3]" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#2A2A2A] border-[#3A3A3A] text-white pl-10"
          />
        </div>

        {/* Files Table */}
        <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-[#B3B3B3]">
                <p>No files found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A] hover:bg-[#2A2A2A]">
                    <TableHead className="text-white">Name</TableHead>
                    <TableHead className="text-white">Size</TableHead>
                    <TableHead className="text-white">Modified</TableHead>
                    <TableHead className="text-white text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file) => (
                    <TableRow 
                      key={file.key} 
                      className="border-[#2A2A2A] hover:bg-[#2A2A2A] cursor-pointer"
                      onClick={() => file.isDirectory && handleNavigate(file.key)}
                    >
                      <TableCell className="text-white">
                        <div className="flex items-center gap-2">
                          {file.isDirectory ? (
                            <Folder className="h-5 w-5 text-blue-500" />
                          ) : (
                            <File className="h-5 w-5 text-[#B3B3B3]" />
                          )}
                          <span>{file.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#B3B3B3]">
                        {file.isDirectory ? '-' : formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="text-[#B3B3B3]">
                        {formatDate(file.lastModified)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#B3B3B3] hover:text-white"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#1F1F1F] border-[#2A2A2A]">
                            {!file.isDirectory && (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(file);
                                  }}
                                  className="text-white hover:bg-[#2A2A2A]"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFile(file);
                                    setNewName(file.name);
                                    setShowRenameDialog(true);
                                  }}
                                  className="text-white hover:bg-[#2A2A2A]"
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFile(file);
                                    setNewPath('');
                                    setShowMoveDialog(true);
                                  }}
                                  className="text-white hover:bg-[#2A2A2A]"
                                >
                                  <Move className="h-4 w-4 mr-2" />
                                  Move
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFile(file);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="text-red-600 hover:bg-[#2A2A2A]"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A] text-white">
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
              <DialogDescription className="text-[#B3B3B3]">
                Select a file to upload to R2 storage
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>File</Label>
                <Input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="bg-[#2A2A2A] border-[#3A3A3A] text-white"
                />
              </div>
              <div>
                <Label>Path (optional)</Label>
                <Input
                  placeholder="folder/subfolder/"
                  value={uploadPath}
                  onChange={(e) => setUploadPath(e.target.value)}
                  className="bg-[#2A2A2A] border-[#3A3A3A] text-white"
                />
                <p className="text-xs text-[#B3B3B3] mt-1">
                  Leave empty to upload to current directory
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowUploadDialog(false)}
                className="border-[#3A3A3A] text-white hover:bg-[#2A2A2A]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A] text-white">
            <DialogHeader>
              <DialogTitle>Rename File</DialogTitle>
              <DialogDescription className="text-[#B3B3B3]">
                Enter a new name for the file
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label>New Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#2A2A2A] border-[#3A3A3A] text-white"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
                className="border-[#3A3A3A] text-white hover:bg-[#2A2A2A]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Dialog */}
        <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
          <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A] text-white">
            <DialogHeader>
              <DialogTitle>Move File</DialogTitle>
              <DialogDescription className="text-[#B3B3B3]">
                Enter the new path for the file
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label>New Path</Label>
              <Input
                placeholder="folder/subfolder/"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                className="bg-[#2A2A2A] border-[#3A3A3A] text-white"
              />
              <p className="text-xs text-[#B3B3B3] mt-1">
                Enter the folder path (with trailing slash) or leave empty for root
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowMoveDialog(false)}
                className="border-[#3A3A3A] text-white hover:bg-[#2A2A2A]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMove}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Move
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A] text-white">
            <DialogHeader>
              <DialogTitle>Delete File</DialogTitle>
              <DialogDescription className="text-[#B3B3B3]">
                Are you sure you want to delete this file? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedFile && (
              <div className="bg-[#2A2A2A] p-3 rounded">
                <p className="text-white font-semibold">{selectedFile.name}</p>
                <p className="text-[#B3B3B3] text-sm">{selectedFile.key}</p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="border-[#3A3A3A] text-white hover:bg-[#2A2A2A]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}


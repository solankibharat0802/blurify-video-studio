import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { VideoEditModal } from "@/components/simple-video-edit-modal";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getBackendUrl } from "@/lib/config";
import { X, Upload, FileVideo } from "lucide-react";

interface UploadedFile {
  videoId: string;
  name: string;
  size: number;
  status: string;
  file?: File;
}

export function MultipleVideoUpload() {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [currentEditFile, setCurrentEditFile] = useState<UploadedFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canConvert, conversionsUsed, conversionsLimit, subscribed, refreshSubscription } = useSubscription();
  const { user, session } = useAuth();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Check if all files are videos
    const invalidFiles = files.filter(file => !file.type.startsWith('video/'));
    if (invalidFiles.length > 0) {
      toast.error('Please select only video files');
      return;
    }

    // Check subscription limits
    const totalVideosToProcess = selectedFiles.length + files.length;
    
    if (subscribed && totalVideosToProcess > conversionsLimit - conversionsUsed) {
      toast.error(`You can only convert ${conversionsLimit - conversionsUsed} more videos this month`);
      return;
    }

    setUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempId = `temp-${Date.now()}-${i}`;
        
        setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));

        const formData = new FormData();
        formData.append('video', file);
        
        const response = await fetch(`${getBackendUrl()}/upload-video`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        const uploadedFile: UploadedFile = {
          videoId: result.videoId,
          name: file.name,
          size: file.size,
          status: 'uploaded',
          file
        };
        
        newFiles.push(uploadedFile);
        setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));
      }
      
      setSelectedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${files.length} video(s) uploaded successfully!`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload some videos');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (videoId: string) => {
    setSelectedFiles(prev => prev.filter(file => file.videoId !== videoId));
  };

  const editFile = (file: UploadedFile) => {
    setCurrentEditFile(file);
    setIsModalOpen(true);
  };

  const handleBlur = async (videoId: string, blurMasks: any[]) => {
    console.log('Processing video with masks:', blurMasks);
    
    // Log conversion usage when processing starts
    if (user && session) {
      try {
        await supabase
          .from('conversion_logs')
          .insert({
            user_id: user.id,
            video_id: videoId,
            status: 'processing'
          });

        // Update subscription usage
        await supabase
          .from('subscriptions')
          .update({
            conversions_used: conversionsUsed + 1
          })
          .eq('user_id', user.id);

        // Update file status
        setSelectedFiles(prev => 
          prev.map(file => 
            file.videoId === videoId 
              ? { ...file, status: 'processing' }
              : file
          )
        );

        // Refresh subscription data to update UI
        await refreshSubscription();
        
        toast.success('Video processing started!');
      } catch (error) {
        console.error('Error logging conversion:', error);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded': return 'default';
      case 'processing': return 'secondary';
      case 'completed': return 'default';
      case 'error': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="h-5 w-5" />
          Multiple Video Upload
        </CardTitle>
        <CardDescription>
          Select multiple video files to apply blur effects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <Button 
            onClick={handleUploadClick}
            disabled={uploading}
            className="w-full mb-2"
          >
            {uploading ? 'Uploading...' : 'Select Videos'}
          </Button>
          
          {!subscribed ? (
            <p className="text-sm text-muted-foreground">
              Free users can upload videos but need Pro plan to convert them
            </p>
          ) : !canConvert ? (
            <p className="text-sm text-muted-foreground">
              You've used all {conversionsLimit} conversions this month
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {conversionsLimit - conversionsUsed} conversions remaining this month
            </p>
          )}
        </div>

        {/* Show upload progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Uploading...</h4>
            {Object.entries(uploadProgress).map(([id, progress]) => (
              <div key={id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>File {id.split('-')[2]}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            ))}
          </div>
        )}

        {/* Show selected files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Selected Videos ({selectedFiles.length})</h4>
            <div className="space-y-2">
              {selectedFiles.map((file) => (
                <div key={file.videoId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <FileVideo className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <Badge variant={getStatusColor(file.status)} className="text-xs">
                      {file.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'uploaded' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editFile(file)}
                        disabled={!canConvert}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(file.videoId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentEditFile && (
          <VideoEditModal
            isOpen={!!currentEditFile}
            onClose={() => {
              setIsModalOpen(false);
              setCurrentEditFile(null);
            }}
            file={currentEditFile}
            onSaveEdit={(masks) => handleBlur(currentEditFile.videoId, masks)}
          />
        )}
      </CardContent>
    </Card>
  );
}
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, File, X, Play, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VideoEditModal } from "./video-edit-modal";
import { BatchDownloadModal } from "./batch-download-modal";

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  blurMasks?: BlurMask[];
}

interface BlurMask {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startTime: number;
  endTime: number;
  intensity: number;
}

export const UploadSection = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingFile, setEditingFile] = useState<UploadedFile | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const { toast } = useToast();

  const createVideoPreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Seek to 1 second for thumbnail
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        resolve(canvas.toDataURL());
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const videoFiles = droppedFiles.filter(file => file.type.startsWith('video/'));
    
    if (videoFiles.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload video files only",
        variant: "destructive"
      });
      return;
    }

    const newFiles: UploadedFile[] = await Promise.all(
      videoFiles.map(async (file) => {
        try {
          const preview = await createVideoPreview(file);
          return {
            id: Math.random().toString(36).substr(2, 9),
            file,
            preview,
            status: 'pending' as const
          };
        } catch (error) {
          console.error('Error creating preview:', error);
          return {
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending' as const
          };
        }
      })
    );

    setFiles(prev => [...prev, ...newFiles]);
    toast({
      title: "Files uploaded",
      description: `${videoFiles.length} video(s) ready for editing`
    });
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const videoFiles = selectedFiles.filter(file => file.type.startsWith('video/'));
      
      const newFiles: UploadedFile[] = await Promise.all(
        videoFiles.map(async (file) => {
          try {
            const preview = await createVideoPreview(file);
            return {
              id: Math.random().toString(36).substr(2, 9),
              file,
              preview,
              status: 'pending' as const
            };
          } catch (error) {
            console.error('Error creating preview:', error);
            return {
              id: Math.random().toString(36).substr(2, 9),
              file,
              status: 'pending' as const
            };
          }
        })
      );

      setFiles(prev => [...prev, ...newFiles]);
      toast({
        title: "Files uploaded",
        description: `${videoFiles.length} video(s) ready for editing`
      });
    }
  }, [toast]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const handleEditVideo = (file: UploadedFile) => {
    setEditingFile(file);
  };

  const handleSaveEdit = (masks: BlurMask[]) => {
    if (editingFile) {
      setFiles(prev => prev.map(file => 
        file.id === editingFile.id 
          ? { ...file, blurMasks: masks, status: 'pending' as const }
          : file
      ));
    }
    setEditingFile(null);
  };

  const handleProcessAll = () => {
    // Start processing all videos with blur effects
    setFiles(prev => prev.map(file => ({ ...file, status: 'processing' as const, progress: 0 })));
    
    // Simulate processing for demo
    files.forEach((file, index) => {
      setTimeout(() => {
        const interval = setInterval(() => {
          setFiles(current => current.map(f => {
            if (f.id === file.id && f.status === 'processing') {
              const newProgress = (f.progress || 0) + Math.random() * 10;
              if (newProgress >= 100) {
                clearInterval(interval);
                return { ...f, status: 'completed' as const, progress: 100 };
              }
              return { ...f, progress: newProgress };
            }
            return f;
          }));
        }, 500);
      }, index * 1000);
    });
    
    setShowBatchModal(true);
  };

  const handleDownloadAll = () => {
    const completedFiles = files.filter(f => f.status === 'completed');
    
    if (completedFiles.length === 0) {
      toast({
        title: "No completed videos",
        description: "Process some videos first before downloading",
        variant: "destructive"
      });
      return;
    }

    // Create download links for each completed video
    completedFiles.forEach((file, index) => {
      setTimeout(() => {
        const url = URL.createObjectURL(file.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = `processed_${file.file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, index * 500); // Stagger downloads
    });
    
    toast({
      title: "Download started",
      description: `Downloading ${completedFiles.length} processed videos`
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <section className="py-20 px-6 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Upload Your Videos</h2>
        <p className="text-xl text-muted-foreground">
          Drag and drop multiple video files or click to select
        </p>
      </div>

      {/* Upload Zone */}
      <Card 
        className={`p-12 border-2 border-dashed transition-all duration-300 ${
          isDragging 
            ? 'border-primary bg-primary/5 shadow-glow' 
            : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="text-center space-y-6">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
            isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            <Upload className="w-8 h-8" />
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-2">Drop your videos here</h3>
            <p className="text-muted-foreground mb-6">
              Support for MP4, MOV, AVI, and other common video formats
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild>
                <label className="cursor-pointer">
                  <input 
                    type="file" 
                    multiple 
                    accept="video/*" 
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  Choose Files
                </label>
              </Button>
              <Button variant="outline" size="lg">
                Import from URL
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-8">
          <h3 className="text-2xl font-semibold mb-6">Uploaded Files ({files.length})</h3>
          <div className="grid gap-4">
            {files.map((uploadedFile) => (
              <Card key={uploadedFile.id} className="p-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-primary/10 rounded-lg overflow-hidden flex items-center justify-center">
                       {uploadedFile.preview ? (
                         <img 
                           src={uploadedFile.preview} 
                           alt="Video thumbnail" 
                           className="w-full h-full object-cover"
                         />
                       ) : (
                         <File className="w-6 h-6 text-primary" />
                       )}
                     </div>
                    
                    <div>
                      <h4 className="font-medium truncate max-w-[300px]">
                        {uploadedFile.file.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditVideo(uploadedFile)}
                    >
                      <Play className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeFile(uploadedFile.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {uploadedFile.status === 'processing' && uploadedFile.progress && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Processing...</span>
                      <span>{uploadedFile.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadedFile.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
          
          <div className="mt-6 flex gap-4 justify-center">
            <Button variant="hero" size="lg" onClick={handleProcessAll}>
              Process All Videos
            </Button>
            <Button variant="outline" size="lg" onClick={() => setShowBatchModal(true)}>
              <Download className="w-4 h-4 mr-2" />
              Batch Download
            </Button>
          </div>
        </div>
      )}

      {/* Video Edit Modal */}
      <VideoEditModal
        isOpen={!!editingFile}
        onClose={() => setEditingFile(null)}
        file={editingFile?.file || null}
        onSaveEdit={handleSaveEdit}
      />

      {/* Batch Download Modal */}
      <BatchDownloadModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        videos={files.map(file => ({
          id: file.id,
          name: file.file.name,
          status: file.status === 'pending' ? 'queued' : file.status,
          progress: file.progress || 0,
          downloadUrl: file.status === 'completed' ? `#download-${file.id}` : undefined
        }))}
        onStartProcessing={handleProcessAll}
        onDownloadAll={handleDownloadAll}
      />
    </section>
  );
};
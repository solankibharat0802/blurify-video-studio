import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, File, X, Play, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { VideoEditModal } from "./video-edit-modal";
import { BatchDownloadModal } from "./batch-download-modal";
import { supabase } from "@/integrations/supabase/client";

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  blurMasks?: BlurMask[];
  dbId?: string;
  originalFilePath?: string;
  editedFilePath?: string;
  supabaseUrl?: string; // Add this for the signed URL
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

  const uploadToSupabase = async (file: File, fileId: string): Promise<string | null> => {
    try {
      // Get current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${fileId}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error } = await supabase.storage
        .from('original-videos')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      return filePath;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const saveToDatabase = async (file: File, filePath: string, fileId: string) => {
    try {
      const videoDuration = await getVideoDuration(file);
      
      // Get current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('uploadvideo')
        .insert({
          user_id: user.id,
          original_filename: file.name,
          original_file_path: filePath,
          file_size: file.size,
          duration: videoDuration,
          status: 'uploaded'
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Database error:', error);
      return null;
    }
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration);
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
          const fileId = Math.random().toString(36).substr(2, 9);
          const preview = await createVideoPreview(file);
          
          // Upload to Supabase storage
          const filePath = await uploadToSupabase(file, fileId);
          if (!filePath) {
            throw new Error('Upload failed');
          }

          // Save to database
          const dbId = await saveToDatabase(file, filePath, fileId);
          if (!dbId) {
            throw new Error('Database save failed');
          }

          return {
            id: fileId,
            file,
            preview,
            status: 'pending' as const,
            dbId,
            originalFilePath: filePath
          };
        } catch (error) {
          console.error('Error processing file:', error);
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
            variant: "destructive"
          });
          return {
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'error' as const
          };
        }
      })
    );

    const successfulUploads = newFiles.filter(f => f.status !== 'error');
    setFiles(prev => [...prev, ...successfulUploads]);
    
    if (successfulUploads.length > 0) {
      toast({
        title: "Files uploaded",
        description: `${successfulUploads.length} video(s) uploaded to backend`
      });
    }
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
            const fileId = Math.random().toString(36).substr(2, 9);
            const preview = await createVideoPreview(file);
            
            // Upload to Supabase storage
            const filePath = await uploadToSupabase(file, fileId);
            if (!filePath) {
              throw new Error('Upload failed');
            }

            // Save to database
            const dbId = await saveToDatabase(file, filePath, fileId);
            if (!dbId) {
              throw new Error('Database save failed');
            }

            return {
              id: fileId,
              file,
              preview,
              status: 'pending' as const,
              dbId,
              originalFilePath: filePath
            };
          } catch (error) {
            console.error('Error processing file:', error);
            toast({
              title: "Upload failed",
              description: `Failed to upload ${file.name}`,
              variant: "destructive"
            });
            return {
              id: Math.random().toString(36).substr(2, 9),
              file,
              status: 'error' as const
            };
          }
        })
      );

      const successfulUploads = newFiles.filter(f => f.status !== 'error');
      setFiles(prev => [...prev, ...successfulUploads]);
      
      if (successfulUploads.length > 0) {
        toast({
          title: "Files uploaded",
          description: `${successfulUploads.length} video(s) uploaded to backend`
        });
      }
    }
  }, [toast]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const handleEditVideo = async (file: UploadedFile) => {
    // Get the video URL from Supabase storage
    if (file.originalFilePath) {
      try {
        const { data } = await supabase.storage
          .from('original-videos')
          .createSignedUrl(file.originalFilePath, 3600); // 1 hour expiry
        
        if (data?.signedUrl) {
          // Create a modified file object with the Supabase URL
          const fileWithUrl = {
            ...file,
            supabaseUrl: data.signedUrl
          };
          setEditingFile(fileWithUrl);
        } else {
          toast({
            title: "Error",
            description: "Could not load video from storage",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error getting video URL:', error);
        toast({
          title: "Error", 
          description: "Could not load video from storage",
          variant: "destructive"
        });
      }
    } else {
      // Fallback to original file if no storage path
      setEditingFile(file);
    }
  };

  const handleSaveEdit = async (masks: BlurMask[]) => {
    if (editingFile && editingFile.dbId) {
      try {
        // Mark as processing in DB and save masks
        const { error: dbError } = await supabase
          .from('uploadvideo')
          .update({ blur_masks: masks as any, status: 'processing' })
          .eq('id', editingFile.dbId);

        if (dbError) {
          throw dbError;
        }

        // Update local UI
        setFiles(prev => prev.map(file => 
          file.id === editingFile.id 
            ? { ...file, blurMasks: masks, status: 'processing' as const, progress: 0 }
            : file
        ));

        // Prefer server-side processing via Edge Function first
        try {
          toast({ title: 'Processing on server', description: 'Starting server-side processing...' });
          const { data: invokeData, error: invokeError } = await supabase.functions.invoke('process-video', {
            body: { videoId: editingFile.dbId, blurMasks: masks }
          });
          if (invokeError) throw invokeError as any;
          const editedFilePath = (invokeData as any)?.editedFilePath;
          if (!editedFilePath) throw new Error('Server did not return edited file path');

          // Update UI to completed
          setFiles(prev => prev.map(file => 
            file.id === editingFile.id 
              ? { ...file, status: 'completed' as const, progress: 100, editedFilePath }
              : file
          ));

          toast({ title: 'Video processed', description: 'Server finished processing your video.' });
          return; // Skip local processing fallback
        } catch (serverErr) {
          console.error('Server processing failed, falling back to local ffmpeg', serverErr);
        }

        // Dynamically load ffmpeg.wasm
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
        const ffmpeg = new FFmpeg();
        toast({ title: 'Initializing video processor', description: 'Downloading FFmpeg engine (first run may take ~20s)...' });
        console.log('FFmpeg: starting load');
        try {
          // Use blob URLs to avoid COOP/COEP requirements
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
          });
          console.log('FFmpeg: load finished');
        } catch (e) {
          console.error('FFmpeg load failed', e);
          toast({ title: 'Processor init failed', description: 'Could not load FFmpeg. Please retry.', variant: 'destructive' });
          throw e;
        }
        ffmpeg.on('log', ({ message }) => console.log('FFmpeg log:', message));

        // Ensure clean FS and write input
        try { await ffmpeg.deleteFile('input.mp4'); } catch {}
        try { await ffmpeg.deleteFile('output.mp4'); } catch {}
        await ffmpeg.writeFile('input.mp4', await fetchFile(editingFile.supabaseUrl ? editingFile.supabaseUrl : editingFile.file));

        // Build filter_complex from masks (coordinates are in intrinsic video pixels)
        const buildFilter = (m: BlurMask[]) => {
          let parts: string[] = [];
          let last = '[0:v]';
          m.forEach((mask, i) => {
            const base = `base${i}`;
            const blur = `blur${i}`;
            const crop = `crop${i}`;
            const out = `out${i}`;
            const x = Math.max(0, Math.round(mask.x));
            const y = Math.max(0, Math.round(mask.y));
            const w = Math.max(1, Math.round(mask.width));
            const h = Math.max(1, Math.round(mask.height));
            const radius = Math.max(1, Math.round(mask.intensity));
            const enable = `between(t,${mask.startTime},${mask.endTime})`;

            parts.push(`${last}split[${base}][${blur}]`);
            parts.push(`[${blur}]boxblur=${radius}:${radius},crop=${w}:${h}:${x}:${y}[${crop}]`);
            parts.push(`[${base}][${crop}]overlay=${x}:${y}:enable='${enable}'[${out}]`);
            last = `[${out}]`;
          });
          return { filter: parts.join('; '), out: last };
        };

        const { filter, out } = buildFilter(masks);
        console.log('Using FFmpeg filter_complex:', filter, 'out:', out);

        // Update UI progress from FFmpeg
        ffmpeg.on('progress', ({ progress }) => {
          setFiles(prev => prev.map(file =>
            file.id === editingFile.id && file.status === 'processing'
              ? { ...file, progress: Math.max(1, Math.min(99, Math.round(progress * 100))) }
              : file
          ));
        });

        const args = [
          '-i', 'input.mp4',
          '-filter_complex', filter,
          '-map', out,
          '-map', '0:a?',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          '-y', 'output.mp4'
        ];

        try {
          await ffmpeg.exec(args);
        } catch (e) {
          console.warn('FFmpeg x264 failed, falling back to mpeg4', e);
          await ffmpeg.exec([
            '-i', 'input.mp4',
            '-filter_complex', filter,
            '-map', out,
            '-map', '0:a?',
            '-c:v', 'mpeg4',
            '-q:v', '5',
            '-c:a', 'aac',
            '-movflags', '+faststart',
            '-y', 'output.mp4'
          ]);
        }

        const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
        const blob = new Blob([data], { type: 'video/mp4' });

        // Cleanup input buffer to free memory early
        try { await ffmpeg.deleteFile('input.mp4'); } catch {}

        // Upload to storage
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) throw new Error('Not authenticated');

        const fileExt = editingFile.file.name.split('.').pop();
        const editedFileName = `edited_${editingFile.id}.${fileExt}`;
        const editedFilePath = `${userId}/${editedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('edited-videos')
          .upload(editedFilePath, blob, { contentType: 'video/mp4', upsert: true });

        if (uploadError) throw uploadError;

        // Update DB to completed
        const { error: updateError } = await supabase
          .from('uploadvideo')
          .update({ edited_file_path: editedFilePath, status: 'completed' })
          .eq('id', editingFile.dbId);

        if (updateError) throw updateError;

        // Update UI
        setFiles(prev => prev.map(file => 
          file.id === editingFile.id 
            ? { ...file, status: 'completed' as const, progress: 100, editedFilePath }
            : file
        ));

        toast({ title: 'Video processed', description: 'Blur effects applied and video is ready to download' });
      } catch (error) {
        console.error('Error processing video:', error);
        setFiles(prev => prev.map(file => 
          file.id === editingFile?.id 
            ? { ...file, status: 'error' as const }
            : file
        ));
        toast({ title: 'Processing failed', description: 'Failed to process video with blur effects', variant: 'destructive' });
      }
    }
    setEditingFile(null);
  };

  const handleProcessAll = async () => {
    // Start processing all videos that have blur masks configured (client-side)
    const toProcess = files.filter(f => f.dbId && f.blurMasks && f.blurMasks.length > 0);

    if (toProcess.length === 0) {
      toast({
        title: "Nothing to process",
        description: "Please add blur masks to at least one video before processing",
        variant: "destructive"
      });
      return;
    }

    // Optimistically set status to processing
    setFiles(prev => prev.map(f => toProcess.some(tp => tp.id === f.id)
      ? { ...f, status: 'processing' as const, progress: 0 }
      : f
    ));

    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      toast({ title: 'Initializing video processor', description: 'Downloading FFmpeg engine (first run may take ~20s)...' });
      const ffmpeg = new FFmpeg();
      console.log('FFmpeg: starting load');
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
        });
        console.log('FFmpeg: load finished');
      } catch (e) {
        console.error('FFmpeg load failed', e);
        toast({ title: 'Processor init failed', description: 'Could not load FFmpeg. Please retry.', variant: 'destructive' });
        throw e;
      }
      ffmpeg.on('log', ({ message }) => console.log('FFmpeg log:', message));
      toast({ title: 'Processing started', description: `Processing ${toProcess.length} video(s)...` });

      // Common filter builder
      const buildFilter = (m: BlurMask[]) => {
        let parts: string[] = [];
        let last = '[0:v]';
        m.forEach((mask, i) => {
          const base = `base${i}`;
          const blur = `blur${i}`;
          const crop = `crop${i}`;
          const out = `out${i}`;
          const x = Math.max(0, Math.round(mask.x));
          const y = Math.max(0, Math.round(mask.y));
          const w = Math.max(1, Math.round(mask.width));
          const h = Math.max(1, Math.round(mask.height));
          const radius = Math.max(1, Math.round(mask.intensity));
          const enable = `between(t,${mask.startTime},${mask.endTime})`;

          parts.push(`${last}split[${base}][${blur}]`);
          parts.push(`[${blur}]boxblur=${radius}:${radius},crop=${w}:${h}:${x}:${y}[${crop}]`);
          parts.push(`[${base}][${crop}]overlay=${x}:${y}:enable='${enable}'[${out}]`);
          last = `[${out}]`;
        });
        return { filter: parts.join('; '), out: last };
      };

      // Get user once
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      // Process sequentially to avoid memory spikes
      for (const file of toProcess) {
        try {
          // Update DB to processing with masks
          await supabase
            .from('uploadvideo')
            .update({ blur_masks: file.blurMasks as any, status: 'processing' })
            .eq('id', file.dbId);

          // Prepare input
          try { await ffmpeg.deleteFile('input.mp4'); } catch {}
          try { await ffmpeg.deleteFile('output.mp4'); } catch {}
          await ffmpeg.writeFile('input.mp4', await fetchFile(file.file));

          const { filter, out } = buildFilter(file.blurMasks!);
          console.log('Using FFmpeg filter_complex:', filter, 'out:', out);

          // Wire progress to UI
          ffmpeg.on('progress', ({ progress }) => {
            setFiles(prev => prev.map(f => f.id === file.id && f.status === 'processing'
              ? { ...f, progress: Math.max(1, Math.min(99, Math.round(progress * 100))) }
              : f
            ));
          });

          const args = [
            '-i', 'input.mp4',
            '-filter_complex', filter,
            '-map', out,
            '-map', '0:a?',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '28',
            '-c:a', 'aac',
            '-movflags', '+faststart',
            '-y', 'output.mp4'
          ];

          try {
            await ffmpeg.exec(args);
          } catch (e) {
            // Fallback to mpeg4 if libx264 is unavailable in this build
            console.warn('FFmpeg x264 failed, falling back to mpeg4', e);
            await ffmpeg.exec([
              '-i', 'input.mp4',
              '-filter_complex', filter,
              '-map', out,
              '-map', '0:a?',
              '-c:v', 'mpeg4',
              '-q:v', '5',
              '-c:a', 'aac',
              '-movflags', '+faststart',
              '-y', 'output.mp4'
            ]);
          }

          const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
          const blob = new Blob([data], { type: 'video/mp4' });

          const fileExt = file.file.name.split('.').pop();
          const editedFileName = `edited_${file.id}.${fileExt}`;
          const editedFilePath = `${userId}/${editedFileName}`;

          const { error: uploadError } = await supabase.storage
            .from('edited-videos')
            .upload(editedFilePath, blob, { contentType: 'video/mp4', upsert: true });
          if (uploadError) throw uploadError;

          await supabase
            .from('uploadvideo')
            .update({ edited_file_path: editedFilePath, status: 'completed' })
            .eq('id', file.dbId);

          setFiles(prev => prev.map(f => f.id === file.id
            ? { ...f, status: 'completed' as const, progress: 100, editedFilePath }
            : f
          ));

          // Cleanup in-memory files
          try { await ffmpeg.deleteFile('input.mp4'); } catch {}
          try { await ffmpeg.deleteFile('output.mp4'); } catch {}
        } catch (err) {
          console.error('Processing error for file', file.id, err);
          setFiles(prev => prev.map(f => f.id === file.id
            ? { ...f, status: 'error' as const }
            : f
          ));
          await supabase
            .from('uploadvideo')
            .update({ status: 'error' })
            .eq('id', file.dbId);
        }
      }

      toast({ title: 'Batch processing complete', description: 'Finished processing videos.' });
    } catch (err) {
      console.error('Batch initialize error:', err);
      toast({ title: 'Processing failed', description: 'Failed to initialize processor', variant: 'destructive' });
    }

    setShowBatchModal(true);
  };

  const handleDownloadAll = async () => {
    const completedFiles = files.filter(f => f.status === 'completed');
    
    if (completedFiles.length === 0) {
      toast({
        title: "No completed videos",
        description: "Process some videos first before downloading",
        variant: "destructive"
      });
      return;
    }

    // Download from Supabase storage
    completedFiles.forEach(async (file, index) => {
      setTimeout(async () => {
        if (file.editedFilePath) {
          try {
            const { data, error } = await supabase.storage
              .from('edited-videos')
              .download(file.editedFilePath);

            if (error) {
              console.error('Download error:', error);
              return;
            }

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edited_${file.file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (error) {
            console.error('Download error:', error);
          }
        }
      }, index * 500); // Stagger downloads
    });
    
    toast({
      title: "Download started",
      description: `Downloading ${completedFiles.length} processed videos from backend`
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
                     {uploadedFile.status === 'processing' && uploadedFile.progress !== undefined && (
                       <div className="flex items-center gap-2 mr-4">
                         <div className="w-32">
                           <Progress value={uploadedFile.progress} />
                         </div>
                         <span className="text-sm text-muted-foreground">
                           {Math.round(uploadedFile.progress)}%
                         </span>
                       </div>
                     )}
                     
                     {uploadedFile.status === 'completed' && uploadedFile.editedFilePath && (
                       <Button 
                         variant="hero" 
                         size="sm"
                         onClick={async () => {
                           try {
                             const { data, error } = await supabase.storage
                               .from('edited-videos')
                               .download(uploadedFile.editedFilePath!);

                             if (error) {
                               console.error('Download error:', error);
                               toast({
                                 title: "Download failed",
                                 description: "Could not download the edited video",
                                 variant: "destructive"
                               });
                               return;
                             }

                             const url = URL.createObjectURL(data);
                             const a = document.createElement('a');
                             a.href = url;
                             a.download = `edited_${uploadedFile.file.name}`;
                             document.body.appendChild(a);
                             a.click();
                             document.body.removeChild(a);
                             setTimeout(() => URL.revokeObjectURL(url), 1000);
                             
                             toast({
                               title: "Download started",
                               description: "Edited video download started"
                             });
                           } catch (error) {
                             console.error('Download error:', error);
                             toast({
                               title: "Download failed",
                               description: "Could not download the edited video",
                               variant: "destructive"
                             });
                           }
                         }}
                       >
                         <Download className="w-4 h-4" />
                         Download
                       </Button>
                     )}
                     
                     <Button 
                       variant="outline" 
                       size="sm"
                       onClick={() => handleEditVideo(uploadedFile)}
                       disabled={uploadedFile.status === 'processing'}
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
                
                {uploadedFile.status === 'processing' && uploadedFile.progress !== undefined && (
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
        key={editingFile ? `${editingFile.file.name}_${editingFile.file.size}_${editingFile.file.lastModified}` : 'no-file'}
        isOpen={!!editingFile}
        onClose={() => setEditingFile(null)}
        file={editingFile ? { ...editingFile.file, supabaseUrl: editingFile.supabaseUrl } : null}
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
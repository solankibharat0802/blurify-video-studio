import { useState, useRef, useEffect, useCallback } from "react";
import { UploadCloud, Loader2, Download, Video, XCircle, Play, Pause, Trash2, Square, File as FileIcon, X } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// --- Type Definitions ---
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

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  blurMasks?: BlurMask[];
  videoId?: string;
  downloadUrl?: string;
  errorMessage?: string;
}

// --- VideoEditModal Component ---
interface VideoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSaveEdit: (masks: BlurMask[]) => void;
}

const VideoEditModal = ({ isOpen, onClose, file, onSaveEdit }: VideoEditModalProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [blurMasks, setBlurMasks] = useState<BlurMask[]>([]);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [saveError, setSaveError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && file) {
      const url = URL.createObjectURL(file);
      if (videoRef.current) videoRef.current.src = url;
      setIsPlaying(false); setCurrentTime(0); setDuration(0);
      setBlurMasks([]); setSelectedMaskId(null);
      return () => URL.revokeObjectURL(url);
    }
  }, [isOpen, file]);

  const togglePlayPause = () => { if (videoRef.current) isPlaying ? videoRef.current.pause() : videoRef.current.play(); };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const getMousePos = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true); const pos = getMousePos(e);
    setStartPos(pos); setCurrentPos(pos);
  };
  const handleMouseMove = (e: React.MouseEvent) => { if (isDrawing) setCurrentPos(getMousePos(e)); };
  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);
    if (width < 10 || height < 10) return;
    const newMask: BlurMask = {
      id: crypto.randomUUID(),
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width, height, startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration), intensity: 10,
    };
    setBlurMasks(masks => [...masks, newMask]);
    setSelectedMaskId(newMask.id);
  };

  const updateMask = (id: string, updates: Partial<BlurMask>) => {
    setBlurMasks(masks => masks.map(m => (m.id === id ? { ...m, ...updates } : m)));
  };

  const handleSave = () => {
    if (blurMasks.length === 0) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 500);
      return;
    }
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !video.videoWidth) return;
    const videoRect = video.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scale = videoRect.width / video.videoWidth;
    const offsetX = videoRect.left - containerRect.left;
    const offsetY = videoRect.top - containerRect.top;
    const transformedMasks = blurMasks.map(mask => ({
      ...mask,
      x: Math.round((mask.x - offsetX) / scale),
      y: Math.round((mask.y - offsetY) / scale),
      width: Math.round(mask.width / scale),
      height: Math.round(mask.height / scale),
    }));
    onSaveEdit(transformedMasks);
    onClose();
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;
  const selectedMask = blurMasks.find(m => m.id === selectedMaskId);

  return (
     <>
      <style>{`
        @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }
        .shake-error { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="relative z-50 flex flex-col w-full max-w-6xl h-[90vh] gap-4 bg-slate-800 text-white border border-slate-700 shadow-lg rounded-lg p-6">
          <div className="flex-shrink-0">
            <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2"><Square className="w-5 h-5" /> Edit Video: {file?.name}</h3>
            <p className="text-sm text-slate-400 mt-1">Click and drag on the video to create blur masks.</p>
          </div>
          <div className="flex flex-1 gap-6 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4">
              <div ref={containerRef} className="relative flex-1 bg-black rounded-lg overflow-hidden cursor-crosshair select-none" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <video ref={videoRef} className="w-full h-full object-contain" onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
                {blurMasks.map(mask => (currentTime >= mask.startTime && currentTime <= mask.endTime && (
                  <div key={mask.id} className={`absolute border-2 border-sky-500 backdrop-blur-md cursor-pointer ${selectedMaskId === mask.id ? 'bg-sky-500/40' : 'bg-sky-500/20'}`} style={{ left: mask.x, top: mask.y, width: mask.width, height: mask.height }} onClick={(e) => { e.stopPropagation(); setSelectedMaskId(mask.id); }} />
                )))}
                {isDrawing && (<div className="absolute border-2 border-dashed border-sky-400 bg-sky-400/20 pointer-events-none" style={{ left: Math.min(startPos.x, currentPos.x), top: Math.min(startPos.y, currentPos.y), width: Math.abs(currentPos.x - startPos.x), height: Math.abs(currentPos.y - startPos.y) }} />)}
              </div>
              <div className="flex items-center gap-4">
                <button onClick={togglePlayPause} className="p-2 border border-slate-600 rounded-md hover:bg-slate-700">{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
                <span className="text-sm text-slate-400 font-mono">{formatTime(currentTime)}</span>
                <input type="range" min="0" max={duration || 0} value={currentTime} step="0.1" onChange={handleSeek} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer thumb:bg-sky-500" />
                <span className="text-sm text-slate-400 font-mono">{formatTime(duration)}</span>
              </div>
            </div>
            <div className="w-80 flex-shrink-0 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex-1 flex flex-col">
                <h4 className="font-semibold mb-4 text-base">Blur Masks ({blurMasks.length})</h4>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {blurMasks.length > 0 ? blurMasks.map((mask, index) => (
                    <div key={mask.id} className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${selectedMaskId === mask.id ? 'bg-sky-800' : 'bg-slate-700 hover:bg-slate-600'}`} onClick={() => setSelectedMaskId(mask.id)}>
                      <span className="text-sm">Mask {index + 1}</span>
                      <button onClick={(e) => { e.stopPropagation(); setBlurMasks(b => b.filter(bm => bm.id !== mask.id)); setSelectedMaskId(null); }} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  )) : <p className="text-sm text-slate-500 text-center py-4">No masks added yet.</p>}
                </div>
              </div>
              {selectedMask && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4 flex-shrink-0">
                  <h4 className="font-semibold text-base">Edit Selected Mask</h4>
                  <div className="space-y-1"><label className="text-sm font-medium text-slate-300">Intensity: {selectedMask.intensity}</label><input type="range" min="1" max="25" value={selectedMask.intensity} onChange={e => updateMask(selectedMask.id, { intensity: parseInt(e.target.value) })} className="w-full" /></div>
                  <div className="space-y-1"><label className="text-sm font-medium text-slate-300">Start Time: {formatTime(selectedMask.startTime)}</label><input type="range" min="0" max={duration} step="0.1" value={selectedMask.startTime} onChange={e => updateMask(selectedMask.id, { startTime: parseFloat(e.target.value) })} className="w-full" /></div>
                  <div className="space-y-1"><label className="text-sm font-medium text-slate-300">End Time: {formatTime(selectedMask.endTime)}</label><input type="range" min={selectedMask.startTime} max={duration} step="0.1" value={selectedMask.endTime} onChange={e => updateMask(selectedMask.id, { endTime: parseFloat(e.target.value) })} className="w-full" /></div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-700 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-700">Cancel</button>
            <button onClick={handleSave} className={`px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed ${saveError ? 'shake-error bg-red-600' : ''}`} disabled={blurMasks.length === 0}>Save & Process</button>
          </div>
        </div>
      </div>
    </>
  );
};

// --- Main Upload Component ---
export function UploadSection() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingFile, setEditingFile] = useState<UploadedFile | null>(null);
  const { canConvert, conversionsUsed, conversionsLimit, subscribed, refreshSubscription } = useSubscription();
  const { user, session } = useAuth();

  const createVideoPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => { video.currentTime = 1; };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(video, 0, 0); resolve(canvas.toDataURL()); } 
        else { reject(new Error("Could not create canvas context")); }
        URL.revokeObjectURL(video.src);
      };
      video.onerror = (e) => { reject(e); URL.revokeObjectURL(video.src); };
      video.src = URL.createObjectURL(file);
    });
  };

  const uploadToSupabase = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    
    const fileId = crypto.randomUUID();
    const fileName = `${fileId}-${file.name}`;
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('original-videos')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    // Create database record
    const { data, error: dbError } = await supabase
      .from('uploadvideo')
      .insert({
        id: fileId,
        user_id: user.id,
        original_filename: file.name,
        original_file_path: fileName,
        file_size: file.size,
        status: 'uploaded'
      })
      .select()
      .single();
    
    if (dbError) throw dbError;
    
    return fileId;
  };
  
  const handleFiles = useCallback(async (droppedFiles: File[]) => {
    const videoFiles = droppedFiles.filter(f => f.type.startsWith('video/'));
    if (videoFiles.length === 0) {
      toast.error("Please upload video files only.");
      return;
    }

    // Check subscription and conversion limits
    if (!subscribed) {
      toast.error('Please subscribe to upload and process videos');
      return;
    }

    if (!canConvert) {
      toast.error(`You've used all ${conversionsLimit} conversions this month. Please wait for reset or upgrade.`);
      return;
    }

    const newFilesPromises = videoFiles.map(async (file) => {
      const fileId = crypto.randomUUID();
      try {
        const [preview, videoId] = await Promise.all([
          createVideoPreview(file),
          uploadToSupabase(file)
        ]);
        return { id: fileId, file, preview, status: 'pending' as const, videoId };
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        toast.error(`Failed to upload ${file.name}`);
        return null;
      }
    });
  
    const newFiles = (await Promise.all(newFilesPromises)).filter(Boolean) as UploadedFile[];
    setFiles(prev => [...prev, ...newFiles]);
  }, [subscribed, canConvert, conversionsLimit, user]);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }, [handleFiles]);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
    e.target.value = '';
  }, [handleFiles]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const removeFile = (id: string) => { setFiles(prev => prev.filter(file => file.id !== id)); };

  const handleSaveEdit = async (masks: BlurMask[]) => {
    if (!editingFile || !editingFile.videoId || !user || !session) return;

    setFiles(prev => prev.map(f => f.id === editingFile.id ? { ...f, status: 'processing', blurMasks: masks } : f));
    
    try {
      // Log conversion usage when processing starts
      await supabase
        .from('conversion_logs')
        .insert({
          user_id: user.id,
          video_id: editingFile.videoId,
          status: 'processing'
        });

      // Update subscription usage
      await supabase
        .from('subscriptions')
        .update({
          conversions_used: conversionsUsed + 1
        })
        .eq('user_id', user.id);

      // Process video using Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('process-video', {
        body: { videoId: editingFile.videoId, blurMasks: masks },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message || "Processing failed");

      setFiles(prev => prev.map(f => f.id === editingFile.id ? { ...f, status: 'completed', downloadUrl: data.downloadUrl } : f));
      toast.success(`Processing complete for ${editingFile.file.name}!`);
      
      // Refresh subscription data to update UI
      await refreshSubscription();
    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setFiles(prev => prev.map(f => f.id === editingFile.id ? { ...f, status: 'error', errorMessage } : f));
      toast.error(`Processing failed for ${editingFile.file.name}`);
    } finally {
      setEditingFile(null);
    }
  };

  const handleDownload = async (downloadUrl: string, fileName: string) => {
    try {
      const { data } = await supabase.storage
        .from('edited-videos')
        .download(downloadUrl);
      
      if (data) {
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `processed_${fileName}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const StatusBadge = ({ status }: { status: UploadedFile['status'] }) => {
    const statusStyles: Record<UploadedFile['status'], string> = {
      pending: 'text-yellow-400',
      processing: 'text-sky-400',
      completed: 'text-green-400',
      error: 'text-red-400',
    };
    return <span className={`capitalize font-semibold ${statusStyles[status]}`}>{status}</span>;
  };

  return (
    <>
      <style>{`
        .container { max-width: 800px; margin: 2rem auto; padding: 1rem; color: #e2e8f0; }
        .upload-zone { border: 2px dashed #475569; border-radius: 0.75rem; padding: 2.5rem; text-align: center; background-color: #1e293b; transition: all 0.2s ease-in-out; }
        .upload-zone.dragging, .upload-zone:hover { border-color: #38bdf8; background-color: #334155; }
        .upload-zone .icon { margin: 0 auto 1rem; width: 3rem; height: 3rem; color: #64748b; }
        .hidden { display: none; }
        .file-list { margin-top: 2rem; }
        .file-card { background-color: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .file-info { display: flex; align-items: center; gap: 1rem; }
        .thumbnail { width: 5rem; height: 3rem; border-radius: 0.5rem; object-fit: cover; background-color: #334155; }
        .thumbnail-placeholder { width: 5rem; height: 3rem; border-radius: 0.5rem; background-color: #334155; display: flex; align-items: center; justify-content: center; color: #64748b; }
        .file-actions { display: flex; align-items: center; gap: 0.5rem; }
        .button-style, .button-style-outline, .button-style-ghost { padding: 0.5rem 1rem; border-radius: 0.5rem; font-semibold; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: all 0.2s; }
        .button-style { background-color: #0ea5e9; color: white; border: 1px solid #0ea5e9; }
        .button-style:hover { background-color: #0284c7; }
        .button-style-outline { background-color: transparent; color: #e2e8f0; border: 1px solid #475569; }
        .button-style-outline:hover { background-color: #334155; border-color: #64748b; }
        .button-style-outline:disabled { opacity: 0.5; cursor: not-allowed; }
        .button-style-ghost { background-color: transparent; border: 1px solid transparent; color: #94a3b8; }
        .button-style-ghost:hover { background-color: #334155; color: #e2e8f0; }
      `}</style>
      <section className="container">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold">Upload Your Videos</h2>
          <p className="text-slate-400 mt-2">Drag and drop or click to select files</p>
          {subscribed && (
            <p className="text-sm text-slate-500 mt-2">
              Conversions used: {conversionsUsed} / {conversionsLimit}
            </p>
          )}
        </div>
        <div className={`upload-zone ${isDragging ? 'dragging' : ''} ${!subscribed ? 'opacity-50 cursor-not-allowed' : ''}`} onDrop={subscribed ? handleDrop : undefined} onDragOver={subscribed ? handleDragOver : undefined} onDragLeave={subscribed ? handleDragLeave : undefined}>
          <UploadCloud className="icon" />
          <h3 className="text-lg font-semibold">
            {!subscribed ? 'Subscribe to upload videos' : 'Drop videos here'}
          </h3>
          <p className="text-slate-500 my-2">or</p>
          <label className={`button-style ${!subscribed || !canConvert ? 'opacity-50 cursor-not-allowed' : ''}`}>
              Choose Files
              <input 
                type="file" 
                multiple 
                accept="video/*" 
                className="hidden" 
                onChange={handleFileSelect} 
                disabled={!subscribed || !canConvert}
              />
          </label>
          {!subscribed && (
            <p className="text-sm text-slate-400 mt-4">
              Please subscribe to start uploading and processing videos
            </p>
          )}
          {subscribed && !canConvert && (
            <p className="text-sm text-slate-400 mt-4">
              You've used all {conversionsLimit} conversions this month
            </p>
          )}
        </div>
        {files.length > 0 && (
          <div className="file-list">
            <h3 className="text-xl font-semibold mb-4">Uploaded Files ({files.length})</h3>
            {files.map((uploadedFile) => (
              <div key={uploadedFile.id} className="file-card">
                <div className="file-info">
                  {uploadedFile.preview ? (<img src={uploadedFile.preview} alt="preview" className="thumbnail" />) : (<div className="thumbnail-placeholder"><FileIcon /></div>)}
                  <div className="overflow-hidden">
                    <h4 className="font-semibold truncate">{uploadedFile.file.name}</h4>
                    <p className="text-sm text-slate-400">{formatFileSize(uploadedFile.file.size)} - <StatusBadge status={uploadedFile.status} /></p>
                    {uploadedFile.status === 'error' && <p className="text-xs text-red-400 mt-1 truncate">{uploadedFile.errorMessage}</p>}
                  </div>
                </div>
                <div className="file-actions">
                  {uploadedFile.status === 'completed' && uploadedFile.downloadUrl && (
                    <button className="button-style" onClick={() => handleDownload(uploadedFile.downloadUrl!, uploadedFile.file.name)}>
                      <Download size={16} /> Download
                    </button>
                  )}
                  <button className="button-style-outline" onClick={() => setEditingFile(uploadedFile)} disabled={uploadedFile.status === 'processing'}>
                    <Play size={16} /> Edit & Process
                  </button>
                  <button className="button-style-ghost" onClick={() => removeFile(uploadedFile.id)}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <VideoEditModal isOpen={!!editingFile} onClose={() => setEditingFile(null)} file={editingFile?.file || null} onSaveEdit={handleSaveEdit} />
      </section>
    </>
  );
}
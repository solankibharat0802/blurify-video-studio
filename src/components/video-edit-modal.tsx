import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Download, Plus, Trash2, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface VideoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: (File & { supabaseUrl?: string }) | null;
  onSaveEdit: (masks: BlurMask[]) => void;
}

export const VideoEditModal = ({ isOpen, onClose, file, onSaveEdit }: VideoEditModalProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [blurMasks, setBlurMasks] = useState<BlurMask[]>([]);
  const [selectedMask, setSelectedMask] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Debug blur masks state changes
  useEffect(() => {
    console.log('BlurMasks state changed:', blurMasks.length, blurMasks);
  }, [blurMasks]);

  const [fileUrl, setFileUrl] = useState<string>('');

  useEffect(() => {
    if (file && videoRef.current) {
      let url: string;
      
      // Use Supabase URL if available, otherwise create object URL from file
      if ('supabaseUrl' in file && file.supabaseUrl) {
        url = file.supabaseUrl;
      } else {
        url = URL.createObjectURL(file);
      }
      
      // Check if this is a different file by comparing file name and size
      const currentFileId = `${file.name}_${file.size}_${file.lastModified}`;
      const isNewFile = fileUrl !== currentFileId;
      setFileUrl(currentFileId);
      
      videoRef.current.src = url;
      videoRef.current.load(); // Force reload the video element
      
      // Video metadata loading handler
      const handleLoadStart = () => {
        console.log('Video loadstart event fired');
      };
      
      const handleCanPlay = () => {
        console.log('Video can play');
      };
      
      const handleError = (e: Event) => {
        console.error('Video error event:', e);
      };
      
      videoRef.current.addEventListener('loadstart', handleLoadStart);
      videoRef.current.addEventListener('canplay', handleCanPlay);
      videoRef.current.addEventListener('error', handleError);
      
      // Always reset states when new file is loaded to prevent blur masks from persisting
      if (isNewFile) {
        console.log('New file detected, clearing blur masks');
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setBlurMasks([]);
        setSelectedMask(null);
      }
      
      return () => {
        if (!('supabaseUrl' in file && file.supabaseUrl)) {
          URL.revokeObjectURL(url);
        }
        videoRef.current?.removeEventListener('loadstart', handleLoadStart);
        videoRef.current?.removeEventListener('canplay', handleCanPlay);
        videoRef.current?.removeEventListener('error', handleError);
      };
    }
  }, [file, fileUrl]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Mouse down event fired');
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log('Starting drawing at:', { x, y });
    setIsDrawing(true);
    setDragStart({ x, y });
    setDragEnd({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragEnd({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Mouse up event fired, isDrawing:', isDrawing);
    if (!isDrawing || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = Math.abs(x - dragStart.x);
    const height = Math.abs(y - dragStart.y);
    
    console.log('Blur mask dimensions:', { width, height, x, y, dragStart });
    
    if (width > 10 && height > 10) {
      const newMask: BlurMask = {
        id: `mask_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        x: Math.min(dragStart.x, x),
        y: Math.min(dragStart.y, y),
        width,
        height,
        startTime: currentTime,
        endTime: Math.min(currentTime + 5, duration || currentTime + 5),
        intensity: 10
      };
      
      console.log('Creating blur mask:', newMask);
      
      setBlurMasks(prevMasks => {
        const updated = [...prevMasks, newMask];
        console.log('NEW STATE - Updated blur masks count:', updated.length);
        return updated;
      });
      
      setSelectedMask(newMask.id);
      toast({
        title: "Blur mask added",
        description: `Blur area created at ${formatTime(currentTime)}. Total: ${blurMasks.length + 1}`
      });
    } else {
      console.log('Blur mask too small, not creating');
    }
    
    setIsDrawing(false);
    setDragEnd({ x: 0, y: 0 });
  };

  const deleteMask = (id: string) => {
    setBlurMasks(prev => prev.filter(mask => mask.id !== id));
    setSelectedMask(null);
  };

  const updateMask = (id: string, updates: Partial<BlurMask>) => {
    setBlurMasks(prev => prev.map(mask => 
      mask.id === id ? { ...mask, ...updates } : mask
    ));
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    console.log('Save clicked, blur masks count:', blurMasks.length);
    console.log('All blur masks:', blurMasks);
    
    if (blurMasks.length === 0) {
      toast({
        title: "No blur masks",
        description: "Add at least one blur mask before saving",
        variant: "destructive"
      });
      return;
    }
    
    onSaveEdit(blurMasks);
    toast({
      title: "Video saved",
      description: `${blurMasks.length} blur effect(s) will be applied during processing`
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Square className="w-5 h-5" />
            Edit Video: {file?.name}
          </DialogTitle>
          <DialogDescription>
            Click and drag on the video to create blur masks, then adjust timing and intensity
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex gap-6">
          {/* Video Player */}
          <div className="flex-1 flex flex-col">
            <div 
              ref={containerRef}
              className="relative bg-black rounded-lg overflow-hidden aspect-video cursor-crosshair select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => setIsDrawing(false)}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={(e) => {
                  console.error('Video error:', e);
                  toast({
                    title: "Video loading error",
                    description: "Could not load video file. Please try a different format.",
                    variant: "destructive"
                  });
                }}
                controls={false}
                preload="metadata"
                playsInline
                muted
              />
              
              {/* Drawing indicator and preview */}
              {isDrawing && (
                <>
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-sm z-10">
                    Drawing blur mask... ({Math.abs(dragEnd.x - dragStart.x)}×{Math.abs(dragEnd.y - dragStart.y)})
                  </div>
                  <div 
                    className="absolute border-2 border-primary bg-primary/20 z-10"
                    style={{
                      left: Math.min(dragStart.x, dragEnd.x),
                      top: Math.min(dragStart.y, dragEnd.y),
                      width: Math.abs(dragEnd.x - dragStart.x),
                      height: Math.abs(dragEnd.y - dragStart.y),
                    }}
                  />
                </>
              )}
              
              {/* Blur Mask Overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ mixBlendMode: 'multiply' }}
              />
              
              {/* Interactive Blur Masks */}
              {blurMasks.map(mask => (
                currentTime >= mask.startTime && currentTime <= mask.endTime && (
                  <div
                    key={mask.id}
                    className={`absolute border-2 border-primary cursor-move ${
                      selectedMask === mask.id ? 'bg-primary/20' : 'bg-primary/10'
                    }`}
                    style={{
                      left: mask.x,
                      top: mask.y,
                      width: mask.width,
                      height: mask.height,
                    }}
                    onClick={() => setSelectedMask(mask.id)}
                  >
                    <div className="absolute -top-6 left-0 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                      Blur {mask.intensity}px
                    </div>
                  </div>
                )
              ))}
            </div>
            
            {/* Video Controls */}
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                
                <div className="flex-1">
                  <Slider
                    value={[currentTime]}
                    onValueChange={handleSeek}
                    max={duration}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                
                <span className="text-sm text-muted-foreground min-w-[80px]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Click and drag on the video to create blur masks
                </p>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Blur Area
                </Button>
              </div>
            </div>
          </div>
          
          {/* Blur Controls */}
          <div className="w-80 space-y-6">
            <Card className="p-4" key={`blur-controls-${blurMasks.length}`}>
              <h3 className="font-semibold mb-4">Blur Masks ({blurMasks.length})</h3>
              
              <div className="mb-2">
                <p className="text-xs text-muted-foreground">
                  Total masks: {blurMasks.length}
                </p>
              </div>
              
              {blurMasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No blur masks yet. Click and drag on the video to create one.
                </p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {blurMasks.map((mask, index) => (
                    <Card 
                      key={`${mask.id}-${index}`} 
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedMask === mask.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedMask(mask.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">Blur {index + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMask(mask.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Intensity</Label>
                          <Slider
                            value={[mask.intensity]}
                            onValueChange={(value) => updateMask(mask.id, { intensity: value[0] })}
                            max={50}
                            min={1}
                            step={1}
                            className="mt-1"
                          />
                          <span className="text-xs text-muted-foreground">{mask.intensity}px</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Start</Label>
                            <Slider
                              value={[mask.startTime]}
                              onValueChange={(value) => updateMask(mask.id, { startTime: value[0] })}
                              max={duration}
                              step={0.1}
                              className="mt-1"
                            />
                            <span className="text-xs text-muted-foreground">{formatTime(mask.startTime)}</span>
                          </div>
                          
                          <div>
                            <Label className="text-xs">End</Label>
                            <Slider
                              value={[mask.endTime]}
                              onValueChange={(value) => updateMask(mask.id, { endTime: value[0] })}
                              max={duration}
                              min={mask.startTime}
                              step={0.1}
                              className="mt-1"
                            />
                            <span className="text-xs text-muted-foreground">{formatTime(mask.endTime)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button variant="hero" onClick={handleSave} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Save Edits
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
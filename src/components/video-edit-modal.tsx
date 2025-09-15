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
  file: File | null;
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
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Reset states when modal opens with a different file
  useEffect(() => {
    if (file && isOpen) {
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setBlurMasks([]);
      setSelectedMask(null);
    } else if (!isOpen) {
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setBlurMasks([]);
      setSelectedMask(null);
    }
  }, [file, isOpen]);

  useEffect(() => {
    if (file && videoRef.current) {
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
      videoRef.current.load();
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
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
    if (!isDrawing || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = Math.abs(x - dragStart.x);
    const height = Math.abs(y - dragStart.y);
    
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
      
      setBlurMasks(prevMasks => [...prevMasks, newMask]);
      setSelectedMask(newMask.id);
      
      toast({
        title: "Blur mask added",
        description: `Blur area created at ${formatTime(currentTime)}`
      });
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
    if (blurMasks.length === 0) {
      toast({
        title: "No blur masks",
        description: "Add at least one blur mask before saving",
        variant: "destructive"
      });
      return;
    }

    const videoEl = videoRef.current;
    const containerEl = containerRef.current;

    if (!videoEl || !containerEl || !videoEl.videoWidth || !videoEl.videoHeight) {
      onSaveEdit(blurMasks);
      toast({
        title: "Video saved",
        description: `${blurMasks.length} blur effect(s) will be applied during processing`
      });
      onClose();
      return;
    }

    // Convert container coordinates to intrinsic video pixel coordinates
    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;
    const videoWidth = videoEl.videoWidth;
    const videoHeight = videoEl.videoHeight;

    const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
    const displayedWidth = videoWidth * scale;
    const displayedHeight = videoHeight * scale;
    const offsetLeft = (containerWidth - displayedWidth) / 2;
    const offsetTop = (containerHeight - displayedHeight) / 2;

    const scaleX = videoWidth / displayedWidth;
    const scaleY = videoHeight / displayedHeight;

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const transformed = blurMasks.map((m) => {
      const x1 = clamp(m.x, offsetLeft, offsetLeft + displayedWidth);
      const y1 = clamp(m.y, offsetTop, offsetTop + displayedHeight);
      const x2 = clamp(m.x + m.width, offsetLeft, offsetLeft + displayedWidth);
      const y2 = clamp(m.y + m.height, offsetTop, offsetTop + displayedHeight);

      const wDisp = Math.max(1, x2 - x1);
      const hDisp = Math.max(1, y2 - y1);

      let xV = Math.round((x1 - offsetLeft) * scaleX);
      let yV = Math.round((y1 - offsetTop) * scaleY);
      let wV = Math.round(wDisp * scaleX);
      let hV = Math.round(hDisp * scaleY);

      xV = clamp(xV, 0, videoWidth - 1);
      yV = clamp(yV, 0, videoHeight - 1);
      wV = clamp(wV, 1, videoWidth - xV);
      hV = clamp(hV, 1, videoHeight - yV);

      return { ...m, x: xV, y: yV, width: wV, height: hV };
    });

    onSaveEdit(transformed);
    toast({
      title: "Video saved",
      description: `${transformed.length} blur effect(s) will be applied during processing`
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
                controls={false}
                preload="metadata"
                playsInline
                muted
              />
              
              {/* Drawing indicator */}
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
              </div>
            </div>
          </div>
          
          {/* Blur Controls */}
          <div className="w-80 space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Blur Masks ({blurMasks.length})</h3>
              
              {blurMasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No blur masks yet. Click and drag on the video to create one.
                </p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {blurMasks.map((mask, index) => (
                    <Card 
                      key={mask.id} 
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedMask === mask.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedMask(mask.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">Mask {index + 1}</span>
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
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Time: {formatTime(mask.startTime)} - {formatTime(mask.endTime)}</div>
                        <div>Position: {Math.round(mask.x)}, {Math.round(mask.y)}</div>
                        <div>Size: {Math.round(mask.width)} × {Math.round(mask.height)}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
            
            {/* Selected Mask Controls */}
            {selectedMask && (
              <Card className="p-4">
                <h4 className="font-semibold mb-4">Edit Selected Mask</h4>
                
                {(() => {
                  const mask = blurMasks.find(m => m.id === selectedMask);
                  if (!mask) return null;
                  
                  return (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm">Blur Intensity: {mask.intensity}px</Label>
                        <Slider
                          value={[mask.intensity]}
                          onValueChange={(value) => updateMask(mask.id, { intensity: value[0] })}
                          min={1}
                          max={50}
                          step={1}
                          className="mt-2"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm">Start Time: {formatTime(mask.startTime)}</Label>
                        <Slider
                          value={[mask.startTime]}
                          onValueChange={(value) => updateMask(mask.id, { startTime: value[0] })}
                          min={0}
                          max={duration}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm">End Time: {formatTime(mask.endTime)}</Label>
                        <Slider
                          value={[mask.endTime]}
                          onValueChange={(value) => updateMask(mask.id, { endTime: value[0] })}
                          min={mask.startTime}
                          max={duration}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  );
                })()}
              </Card>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {blurMasks.length} blur mask(s) created
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={blurMasks.length === 0}>
              Save & Process
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
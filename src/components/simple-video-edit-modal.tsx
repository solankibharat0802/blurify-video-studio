import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { getBackendUrl } from "@/lib/config";

export interface BlurMask {
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
  videoId: string;
  name: string;
  size: number;
  status: string;
}

interface VideoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: UploadedFile | null;
  onSaveEdit: (masks: BlurMask[]) => void;
}

export const VideoEditModal = ({ isOpen, onClose, file, onSaveEdit }: VideoEditModalProps) => {
  const [blurMasks, setBlurMasks] = useState<BlurMask[]>([]);
  const [processing, setProcessing] = useState(false);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  const addBlurMask = () => {
    const newMask: BlurMask = {
      id: crypto.randomUUID(),
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      startTime: 0,
      endTime: 5,
      intensity: 40,
    };
    setBlurMasks([...blurMasks, newMask]);
  };

  const updateMask = (id: string, updates: Partial<BlurMask>) => {
    setBlurMasks(masks => masks.map(m => (m.id === id ? { ...m, ...updates } : m)));
  };

  const removeMask = (id: string) => {
    setBlurMasks(masks => masks.filter(m => m.id !== id));
  };

  const setSpeed = (speed: number) => {
    setVideoSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    toast.success(`Video playback speed set to ${speed}x`);
  };

  const handleSave = async () => {
    if (!file || blurMasks.length === 0) {
      toast.error('Please add at least one blur mask');
      return;
    }

    setProcessing(true);
    
    try {
      const response = await fetch(`${getBackendUrl()}/process-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoId: file.videoId, 
          blurMasks: blurMasks
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Video processing started!');
        onSaveEdit(blurMasks);
        
        // Poll for completion and handle download
        const pollStatus = async () => {
          try {
            const statusResponse = await fetch(`${getBackendUrl()}/video-status/${file.videoId}`);
            const statusResult = await statusResponse.json();
            
            if (statusResult.status === 'completed') {
              const downloadUrl = `${getBackendUrl()}/download/${file.videoId}`;
              try {
                const resp = await fetch(downloadUrl);
                if (!resp.ok) throw new Error('Download failed');
                const blob = await resp.blob();
                const objectUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = objectUrl;
                link.download = `processed_${file.name}`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(objectUrl);
                toast.success('Video processed and downloaded! You can continue editing other videos.');
              } catch (e) {
                console.error('Download error:', e);
                // Fallback: open in new tab to avoid interrupting current page
                window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                toast.success('Video processed! Download started in a new tab.');
              }
            } else if (statusResult.status === 'error') {
              toast.error('Video processing failed');
            } else {
              setTimeout(pollStatus, 2000);
            }
          } catch (error) {
            console.error('Status polling error:', error);
          }
        };
        
        setTimeout(pollStatus, 2000);
        // Removed automatic modal closing to allow continued editing
      } else {
        throw new Error(result.message || 'Processing failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process video');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Video: {file?.name}</DialogTitle>
          <DialogDescription>
            Add blur masks to your video. Each mask will blur a specific region during the specified time range.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Video Preview */}
          {file && (
            <Card>
              <CardHeader>
                <CardTitle>Video Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <video
                  ref={videoRef}
                  src={`${getBackendUrl()}/video/${file.videoId}`}
                  controls
                  className="w-full max-h-64 rounded-lg"
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      videoRef.current.playbackRate = videoSpeed;
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Blur Masks ({blurMasks.length})</h3>
            <div className="flex gap-2">
              <Button onClick={addBlurMask} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Blur Mask
              </Button>
            </div>
          </div>

          {/* Video Speed Controls */}
          <Card>
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Zap className="h-4 w-4" />
                 Video Playback Speed (Preview Only)
               </CardTitle>
               <CardDescription>
                 Control playback speed for preview - does not affect processed video
               </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium">Current Speed: {videoSpeed}x</span>
                <Button 
                  onClick={() => setSpeed(1)} 
                  variant={videoSpeed === 1 ? "default" : "outline"}
                  size="sm"
                >
                  1x
                </Button>
                <Button 
                  onClick={() => setSpeed(2)} 
                  variant={videoSpeed === 2 ? "default" : "outline"}
                  size="sm"
                >
                  2x
                </Button>
                <Button 
                  onClick={() => setSpeed(5)} 
                  variant={videoSpeed === 5 ? "default" : "outline"}
                  size="sm"
                >
                  5x
                </Button>
              </div>
            </CardContent>
          </Card>

          {blurMasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No blur masks added yet. Click "Add Blur Mask" to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {blurMasks.map((mask, index) => (
                <Card key={mask.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Blur Mask {index + 1}</CardTitle>
                      <Button 
                        onClick={() => removeMask(mask.id)} 
                        variant="ghost" 
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor={`x-${mask.id}`}>X Position</Label>
                        <Input
                          id={`x-${mask.id}`}
                          type="number"
                          value={mask.x}
                          onChange={(e) => updateMask(mask.id, { x: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`y-${mask.id}`}>Y Position</Label>
                        <Input
                          id={`y-${mask.id}`}
                          type="number"
                          value={mask.y}
                          onChange={(e) => updateMask(mask.id, { y: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`width-${mask.id}`}>Width</Label>
                        <Input
                          id={`width-${mask.id}`}
                          type="number"
                          value={mask.width}
                          onChange={(e) => updateMask(mask.id, { width: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`height-${mask.id}`}>Height</Label>
                        <Input
                          id={`height-${mask.id}`}
                          type="number"
                          value={mask.height}
                          onChange={(e) => updateMask(mask.id, { height: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`start-${mask.id}`}>Start Time (seconds)</Label>
                        <Input
                          id={`start-${mask.id}`}
                          type="number"
                          step="0.1"
                          value={mask.startTime}
                          onChange={(e) => updateMask(mask.id, { startTime: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`end-${mask.id}`}>End Time (seconds)</Label>
                        <Input
                          id={`end-${mask.id}`}
                          type="number"
                          step="0.1"
                          value={mask.endTime}
                          onChange={(e) => updateMask(mask.id, { endTime: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`intensity-${mask.id}`}>Blur Intensity (1-25)</Label>
                        <Input
                          id={`intensity-${mask.id}`}
                          type="number"
                          min="1"
                          max="25"
                          value={mask.intensity}
                          onChange={(e) => updateMask(mask.id, { intensity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={blurMasks.length === 0 || processing}
            >
              {processing ? 'Processing...' : 'Process Video'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
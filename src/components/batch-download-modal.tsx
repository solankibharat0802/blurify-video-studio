import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, Clock, AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProcessingVideo {
  id: string;
  name: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  downloadUrl?: string;
  error?: string;
}

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: ProcessingVideo[];
  onStartProcessing: () => void;
  onDownloadAll: () => void;
}

export const BatchDownloadModal = ({ 
  isOpen, 
  onClose, 
  videos, 
  onStartProcessing, 
  onDownloadAll 
}: BatchDownloadModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      queued: 'secondary',
      processing: 'default',
      completed: 'default',
      error: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const completedVideos = videos.filter(v => v.status === 'completed');
  const processingVideos = videos.filter(v => v.status === 'processing');
  const errorVideos = videos.filter(v => v.status === 'error');
  const queuedVideos = videos.filter(v => v.status === 'queued');

  const totalProgress = videos.length > 0 
    ? videos.reduce((sum, video) => sum + video.progress, 0) / videos.length 
    : 0;

  const handleStartProcessing = () => {
    setIsProcessing(true);
    onStartProcessing();
    toast({
      title: "Processing started",
      description: `Processing ${videos.length} video(s) with blur effects`
    });
  };

  const handleDownloadSingle = (video: ProcessingVideo) => {
    if (video.downloadUrl) {
      const link = document.createElement('a');
      link.href = video.downloadUrl;
      link.download = `edited_${video.name}`;
      link.click();
      
      toast({
        title: "Download started",
        description: `Downloading ${video.name}`
      });
    }
  };

  const handleDownloadAll = () => {
    onDownloadAll();
    toast({
      title: "Batch download started",
      description: `Downloading ${completedVideos.length} processed video(s)`
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Batch Video Processing
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>
        
        {/* Overall Progress */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Processing Progress</h3>
              <p className="text-sm text-muted-foreground">
                {completedVideos.length} of {videos.length} videos completed
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{Math.round(totalProgress)}%</div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
          
          <Progress value={totalProgress} className="h-2" />
          
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {completedVideos.length} Completed
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              {processingVideos.length} Processing
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              {queuedVideos.length} Queued
            </span>
            {errorVideos.length > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-red-500" />
                {errorVideos.length} Failed
              </span>
            )}
          </div>
        </Card>
        
        {/* Video List */}
        <div className="flex-1 overflow-auto">
          <div className="space-y-3">
            {videos.map((video) => (
              <Card key={video.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(video.status)}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{video.name}</h4>
                      {video.error && (
                        <p className="text-sm text-red-500">{video.error}</p>
                      )}
                    </div>
                    {getStatusBadge(video.status)}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {video.status === 'processing' && (
                      <div className="text-right min-w-[60px]">
                        <div className="text-sm font-medium">{video.progress}%</div>
                        <Progress value={video.progress} className="w-16 h-1" />
                      </div>
                    )}
                    
                    {video.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadSingle(video)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          {!isProcessing && queuedVideos.length > 0 && (
            <Button
              variant="hero"
              onClick={handleStartProcessing}
              className="flex-1"
            >
              Start Processing All Videos
            </Button>
          )}
          
          {completedVideos.length > 0 && (
            <Button
              variant="accent"
              onClick={handleDownloadAll}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Download All ({completedVideos.length})
            </Button>
          )}
          
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
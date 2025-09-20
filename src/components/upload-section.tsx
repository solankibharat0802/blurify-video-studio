import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoEditModal } from "@/components/simple-video-edit-modal";
import { MultipleVideoUpload } from "@/components/multiple-video-upload";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getBackendUrl } from "@/lib/config";

interface UploadedFile {
  videoId: string;
  name: string;
  size: number;
  status: string;
}

export function UploadSection() {
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canConvert, conversionsUsed, conversionsLimit, subscribed, refreshSubscription } = useSubscription();
  const { user, session } = useAuth();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    if (!canConvert && subscribed) {
      toast.error(`You've used all ${conversionsLimit} conversions this month. Please wait for reset or upgrade.`);
      return;
    }

    if (!subscribed) {
      toast.error('Please subscribe to Pro plan to convert videos');
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('video', file);
      
      const response = await fetch(`${getBackendUrl()}/upload-video`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Upload response:', result);
      
      const uploadedFile: UploadedFile = {
        videoId: result.videoId,
        name: file.name,
        size: file.size,
        status: 'uploaded'
      };
      
      setSelectedFile(uploadedFile);
      setIsModalOpen(true);
      toast.success('Video uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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

        // Refresh subscription data to update UI
        await refreshSubscription();
      } catch (error) {
        console.error('Error logging conversion:', error);
      }
    }
  };

  return (
    <Tabs defaultValue="multiple" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="single">Single Video</TabsTrigger>
        <TabsTrigger value="multiple">Multiple Videos</TabsTrigger>
      </TabsList>
      
      <TabsContent value="single">
        <Card>
          <CardHeader>
            <CardTitle>Upload Single Video</CardTitle>
            <CardDescription>
              Select a video file to apply blur effects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button 
                onClick={handleUploadClick}
                disabled={uploading || (!subscribed && !canConvert)}
                className="w-full"
              >
                {uploading ? 'Uploading...' : !subscribed ? 'Subscribe to Upload' : 'Upload Video'}
              </Button>
              
              {!subscribed && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Subscribe to Pro plan to start converting videos
                </p>
              )}
              
              {subscribed && !canConvert && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  You've used all {conversionsLimit} conversions this month
                </p>
              )}
            </div>

            {selectedFile && (
              <VideoEditModal
                isOpen={isModalOpen}
                onClose={() => {
                  setIsModalOpen(false);
                  setSelectedFile(null);
                }}
                file={selectedFile}
                onSaveEdit={(masks) => handleBlur(selectedFile.videoId, masks)}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="multiple">
        <MultipleVideoUpload />
      </TabsContent>
    </Tabs>
  );
}
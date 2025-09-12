import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function processVideoWithBlur(inputVideoBytes: Uint8Array, blurMasks: BlurMask[]): Promise<Uint8Array> {
  // Create temporary files
  const inputPath = `/tmp/input_${Date.now()}.mp4`;
  const outputPath = `/tmp/output_${Date.now()}.mp4`;
  
  try {
    // Write input video to temp file
    await Deno.writeFile(inputPath, inputVideoBytes);
    
    // Build FFmpeg filter complex for blur effects
    let filterComplex = '[0:v]';
    
    blurMasks.forEach((mask, index) => {
      // Convert relative coordinates to absolute pixel values
      // Note: These coordinates are relative to the video container, 
      // we'll need to scale them based on actual video dimensions
      
      const blurFilter = `boxblur=${mask.intensity}:${mask.intensity}`;
      const cropFilter = `crop=${mask.width}:${mask.height}:${mask.x}:${mask.y}`;
      const timeFilter = `enable='between(t,${mask.startTime},${mask.endTime})'`;
      
      if (index === 0) {
        filterComplex += `split[original][blur${index}]; [blur${index}]${cropFilter},${blurFilter}[blurred${index}]; [original][blurred${index}]overlay=${mask.x}:${mask.y}:${timeFilter}`;
      } else {
        filterComplex += `[overlay${index-1}]split[original${index}][blur${index}]; [blur${index}]${cropFilter},${blurFilter}[blurred${index}]; [original${index}][blurred${index}]overlay=${mask.x}:${mask.y}:${timeFilter}[overlay${index}]`;
      }
    });
    
    // If we have multiple masks, end with the final overlay
    if (blurMasks.length > 1) {
      filterComplex += `[overlay${blurMasks.length-1}]`;
    }
    
    console.log('FFmpeg filter complex:', filterComplex);
    
    // Run FFmpeg command
    const ffmpegArgs = [
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-c:a', 'copy', // Copy audio without re-encoding
      '-c:v', 'libx264', // Use H.264 codec for video
      '-preset', 'fast', // Fast encoding preset
      '-y', // Overwrite output file
      outputPath
    ];
    
    console.log('Running FFmpeg with args:', ffmpegArgs);
    
    const ffmpegProcess = new Deno.Command('ffmpeg', {
      args: ffmpegArgs,
      stdout: 'piped',
      stderr: 'piped'
    });
    
    const { code, stdout, stderr } = await ffmpegProcess.output();
    
    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      console.error('FFmpeg error:', errorOutput);
      throw new Error(`FFmpeg failed with code ${code}: ${errorOutput}`);
    }
    
    console.log('FFmpeg processing completed successfully');
    
    // Read the processed video
    const processedVideo = await Deno.readFile(outputPath);
    
    // Clean up temp files
    try {
      await Deno.remove(inputPath);
      await Deno.remove(outputPath);
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError);
    }
    
    return processedVideo;
    
  } catch (error) {
    // Ensure cleanup on error
    try {
      await Deno.remove(inputPath);
      await Deno.remove(outputPath);
    } catch (cleanupError) {
      console.warn('Cleanup warning during error:', cleanupError);
    }
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId, blurMasks } = await req.json()
    
    if (!videoId || !blurMasks) {
      return new Response(
        JSON.stringify({ error: 'Missing videoId or blurMasks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`Processing video ${videoId} with ${blurMasks.length} blur masks`)

    // Get video details from database
    const { data: video, error: videoError } = await supabase
      .from('uploadvideo')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error('Video not found:', videoError)
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Download original video from storage
    const { data: videoFile, error: downloadError } = await supabase.storage
      .from('original-videos')
      .download(video.original_file_path)

    if (downloadError || !videoFile) {
      console.error('Failed to download video:', downloadError)
      await supabase
        .from('uploadvideo')
        .update({ status: 'error' })
        .eq('id', videoId)
      
      return new Response(
        JSON.stringify({ error: 'Failed to download original video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing video with blur effects using FFmpeg...')
    
    // Convert blob to Uint8Array
    const videoBytes = new Uint8Array(await videoFile.arrayBuffer());
    
    // Process video with blur effects
    const processedVideoBytes = await processVideoWithBlur(videoBytes, blurMasks);
    
    // Create processed file path
    const fileExt = video.original_filename.split('.').pop()
    const editedFileName = `edited_${videoId}.${fileExt}`
    const editedFilePath = `${video.user_id}/${editedFileName}`

    // Upload the processed video
    const { error: uploadError } = await supabase.storage
      .from('edited-videos')
      .upload(editedFilePath, processedVideoBytes, {
        contentType: 'video/mp4',
        upsert: true
      })

    if (uploadError) {
      console.error('Failed to upload processed video:', uploadError)
      await supabase
        .from('uploadvideo')
        .update({ status: 'error' })
        .eq('id', videoId)
      
      return new Response(
        JSON.stringify({ error: 'Failed to upload processed video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update database with completion status
    const { error: updateError } = await supabase
      .from('uploadvideo')
      .update({
        edited_file_path: editedFilePath,
        status: 'completed'
      })
      .eq('id', videoId)

    if (updateError) {
      console.error('Failed to update video status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update video status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Video ${videoId} processed successfully with blur effects applied`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Video processed successfully with blur effects',
        editedFilePath 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing video:', error)
    return new Response(
      JSON.stringify({ error: `Processing failed: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
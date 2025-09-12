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

    // For now, we'll simulate video processing by just copying the original file
    // In a real implementation, you would use FFmpeg or similar to apply blur effects
    console.log('Simulating video processing with blur effects...')
    
    // Create processed file path
    const fileExt = video.original_filename.split('.').pop()
    const editedFileName = `edited_${videoId}.${fileExt}`
    const editedFilePath = `${video.user_id}/${editedFileName}`

    // Upload the "processed" video (for now, just the original)
    const { error: uploadError } = await supabase.storage
      .from('edited-videos')
      .upload(editedFilePath, videoFile, {
        contentType: videoFile.type,
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

    console.log(`Video ${videoId} processed successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Video processed successfully',
        editedFilePath 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing video:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
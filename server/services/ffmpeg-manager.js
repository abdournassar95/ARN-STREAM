import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const execFileAsync = promisify(execFile);

export const ffmpegPath = ffmpegInstaller.path;
export const ffprobePath = ffprobeInstaller.path;

let cachedHwAccel = null;

export async function detectHwAccel() {
  if (cachedHwAccel !== undefined && cachedHwAccel !== null) return cachedHwAccel;
  try {
    const { stdout } = await execFileAsync(ffmpegPath, ['-hide_banner', '-hwaccels']);
    const methods = stdout.split('\n').map(l => l.trim());
    if (methods.includes('cuda')) {
      cachedHwAccel = { method: 'cuda', encoder: 'h264_nvenc', extraArgs: ['-preset', 'p4', '-rc', 'vbr', '-cq', '23'] };
    } else if (methods.includes('qsv')) {
      cachedHwAccel = { method: 'qsv', encoder: 'h264_qsv', extraArgs: ['-preset', 'faster', '-global_quality', '23'] };
    } else if (methods.includes('d3d11va')) {
      cachedHwAccel = null;
    } else if (methods.includes('dxva2')) {
      cachedHwAccel = null;
    } else {
      cachedHwAccel = null;
    }
  } catch (err) {
    cachedHwAccel = null;
  }
  if (cachedHwAccel === null) {
      // to avoid re-checking on failure, though the instruction says null. We'll cache null by checking if we have checked.
      cachedHwAccel = false; // use false for "checked, not available"
  }
  return cachedHwAccel === false ? null : cachedHwAccel;
}

// Cache probed file info in memory to eliminate repeated disk / ffprobe overhead
const probeCache = new Map();

/**
 * Probes a media file and returns detailed video/audio codec and pixel format data
 */
export async function probeMedia(filePath) {
  if (probeCache.has(filePath)) {
    return probeCache.get(filePath);
  }

  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ], { timeout: 10000 });

    const data = JSON.parse(stdout);
    const videoStream = data.streams?.find(s => s.codec_type === 'video');
    const audioStream = data.streams?.find(s => s.codec_type === 'audio');

    let duration = data.format?.duration ? Math.round(parseFloat(data.format.duration)) : null;
    if (!duration && videoStream?.duration) {
      duration = Math.round(parseFloat(videoStream.duration));
    }
    if (!duration && audioStream?.duration) {
      duration = Math.round(parseFloat(audioStream.duration));
    }
    if (!duration && videoStream?.tags?.DURATION) {
      const parts = videoStream.tags.DURATION.split(':');
      if (parts.length === 3) {
        duration = Math.round(parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]));
      }
    }

    const audioStreams = (data.streams || [])
      .filter(s => s.codec_type === 'audio')
      .map((s, idx) => ({
        index: s.index,
        trackIndex: idx,
        codec: s.codec_name,
        channels: s.channels,
        language: s.tags?.language || s.tags?.title || `مسار ${idx + 1}`,
        title: s.tags?.title || (s.tags?.language ? s.tags.language.toUpperCase() : `Audio Track ${idx + 1}`),
        isDefault: s.disposition?.default === 1
      }));

    const subtitleStreams = (data.streams || [])
      .filter(s => s.codec_type === 'subtitle')
      .map((s, idx) => ({
        index: s.index,
        trackIndex: idx,
        codec: s.codec_name,
        language: s.tags?.language || s.tags?.title || `ترجمة ${idx + 1}`,
        title: s.tags?.title || (s.tags?.language ? s.tags.language.toUpperCase() : `Subtitle ${idx + 1}`),
        isDefault: s.disposition?.default === 1,
        isEmbedded: true
      }));

    const result = {
      duration,
      container: data.format?.format_name || '',
      size: data.format?.size ? parseInt(data.format.size) : null,
      bitrate: data.format?.bit_rate ? parseInt(data.format.bit_rate) : null,
      
      // Video info
      hasVideo: Boolean(videoStream),
      videoCodec: videoStream?.codec_name || null,
      profile: videoStream?.profile || '',
      pixFmt: videoStream?.pix_fmt || '',
      width: videoStream?.width || null,
      height: videoStream?.height || null,
      fps: videoStream?.r_frame_rate || null,

      // Audio info
      hasAudio: Boolean(audioStream),
      audioCodec: audioStream?.codec_name || null,
      channels: audioStream?.channels || null,
      sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : null,
      audioTracks: audioStreams,
      embeddedSubtitles: subtitleStreams
    };

    probeCache.set(filePath, result);
    return result;
  } catch (err) {
    console.error(`[FFprobe Error] Cannot probe ${filePath}:`, err.message);
    const fallback = {
      duration: null,
      container: '',
      hasVideo: true,
      videoCodec: null,
      pixFmt: '',
      profile: '',
      audioCodec: null,
      audioTracks: [],
      embeddedSubtitles: []
    };
    probeCache.set(filePath, fallback);
    return fallback;
  }
}

/**
 * Determines whether a file can be Direct Played, Remuxed, or needs Transcoding
 */
export function determineStreamStrategy(filePath, probeData) {
  const ext = path.extname(filePath).toLowerCase();
  const vCodec = (probeData.videoCodec || '').toLowerCase();
  const pixFmt = (probeData.pixFmt || '').toLowerCase();
  const aCodec = (probeData.audioCodec || '').toLowerCase();

  // 1. Check for 10-bit H.264 (Hi10P) or other 10-bit color formats
  const is10Bit = pixFmt.includes('10') || (probeData.profile || '').toLowerCase().includes('high 10');
  if (is10Bit) {
    return {
      mode: 'transcode',
      reason: `10-bit color (${pixFmt || 'Hi10P'}) requires 8-bit transcoding for browser support`,
      videoCodec: vCodec,
      pixFmt,
      audioCodec: aCodec
    };
  }

  // 2. Incompatible video codecs that HTML5 video cannot decode
  const isCompatibleVideo = vCodec === 'h264' || vCodec === 'vp8' || vCodec === 'vp9' || vCodec === 'av1';
  if (!isCompatibleVideo && probeData.hasVideo) {
    return {
      mode: 'transcode',
      reason: `Video codec ${vCodec || 'unknown'} is not supported natively in browser`,
      videoCodec: vCodec,
      pixFmt,
      audioCodec: aCodec
    };
  }

  // 3. Audio compatibility check
  const isCompatibleAudio = !aCodec || ['aac', 'mp3', 'opus', 'vorbis', 'flac'].includes(aCodec);

  // 4. Container check: MP4/M4V/WebM with compatible video + audio can Direct Play natively
  const isWebContainer = ['.mp4', '.m4v', '.webm'].includes(ext);
  if (isWebContainer && isCompatibleVideo && isCompatibleAudio) {
    return {
      mode: 'direct',
      reason: 'Fully compatible MP4/WebM container and codecs',
      videoCodec: vCodec,
      pixFmt,
      audioCodec: aCodec
    };
  }

  // 5. If video is H.264 8-bit, but container is MKV/AVI/MOV or audio needs AAC remux:
  if (vCodec === 'h264' && (pixFmt === 'yuv420p' || !pixFmt)) {
    return {
      mode: 'remux',
      reason: `H.264 8-bit in ${ext.toUpperCase()} container - Remuxing into streaming MP4`,
      videoCodec: vCodec,
      pixFmt,
      audioCodec: aCodec
    };
  }

  // Default to transcode for any other non-standard combo
  return {
    mode: 'transcode',
    reason: `Requires standard H.264/AAC transcode (Codec: ${vCodec}, Ext: ${ext})`,
    videoCodec: vCodec,
    pixFmt,
    audioCodec: aCodec
  };
}

/**
 * Starts an On-The-Fly FFmpeg remuxing or transcoding stream piped directly to Express response
 */
export async function streamWithFFmpeg(filePath, strategy, startTime = 0, req, res) {
  const hwAccel = await detectHwAccel();
  
  if (hwAccel) {
    console.log(`[FFmpeg Stream] Using HW acceleration: ${hwAccel.method.toUpperCase()}`);
  } else {
    console.log(`[FFmpeg Stream] Using CPU encoding (no HW acceleration available)`);
  }

  const args = [];

  // Seeking before input for fast keyframe positioning
  if (startTime > 0) {
    args.push('-ss', String(startTime));
  }

  args.push('-i', filePath);

  if (strategy.mode === 'remux') {
    // Copy video stream without re-encoding (0% CPU)
    args.push('-c:v', 'copy');

    // Copy audio if compatible, else re-encode to AAC
    const aCodec = (strategy.audioCodec || '').toLowerCase();
    if (['aac', 'mp3'].includes(aCodec)) {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');
    }
  } else {
    // Full transcode to 8-bit H.264 yuv420p
    if (hwAccel) {
      args.push(
        '-c:v', hwAccel.encoder,
        ...hwAccel.extraArgs,
        '-pix_fmt', 'yuv420p',
        '-maxrate', '8M',
        '-bufsize', '16M'
      );
    } else {
      args.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-crf', '22',
        '-maxrate', '8M',
        '-bufsize', '16M',
        '-threads', '0'
      );
    }

    // Audio handling
    const aCodec = (strategy.audioCodec || '').toLowerCase();
    if (aCodec === 'aac') {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');
    }
  }

  // Fragmented MP4 flags for live streaming into HTML5 <video>
  args.push(
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  );

  console.log(`[FFmpeg Stream] Starting ${strategy.mode.toUpperCase()} for ${path.basename(filePath)} at ${startTime}s`);

  const ffmpegProcess = spawn(ffmpegPath, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const streamId = `${req.ip}-${path.basename(filePath)}-${Date.now()}`;
  global.activeStreams = global.activeStreams || {};
  global.activeStreams[streamId] = {
    id: streamId,
    type: strategy.mode,
    filePath,
    startedAt: new Date(),
    process: ffmpegProcess
  };

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'none',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Stream-Mode': strategy.mode,
    'X-Stream-Reason': strategy.reason || '',
    ...(strategy.duration ? { 'X-Media-Duration': String(strategy.duration) } : {})
  });

  ffmpegProcess.stdout.pipe(res);

  ffmpegProcess.stderr.on('data', (chunk) => {
    // Only log critical errors or status on startup
    const msg = chunk.toString();
    if (msg.includes('Error') || msg.includes('fatal')) {
      console.warn(`[FFmpeg Warning]`, msg.trim());
    }
  });

  ffmpegProcess.on('error', (err) => {
    console.error(`[FFmpeg Process Error]`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'TRANSCODE_ERROR', message: err.message } });
    }
  });

  const killProcess = () => {
    delete global.activeStreams[streamId];
    try {
      if (ffmpegProcess.stdout && !ffmpegProcess.stdout.destroyed) ffmpegProcess.stdout.destroy();
      if (ffmpegProcess.stderr && !ffmpegProcess.stderr.destroyed) ffmpegProcess.stderr.destroy();
      if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) ffmpegProcess.stdin.destroy();
    } catch (e) {}
    if (ffmpegProcess && !ffmpegProcess.killed) {
      try {
        console.log(`[FFmpeg Stream] Client disconnected. Terminating process PID ${ffmpegProcess.pid}`);
        ffmpegProcess.kill();
      } catch (e) {}
    }
  };

  req.on('close', killProcess);
  res.on('close', killProcess);
  res.on('finish', killProcess);
  res.on('error', killProcess);
}

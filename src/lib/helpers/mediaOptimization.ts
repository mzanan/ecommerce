import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

export type ImageOptimizeOptions = {
  maxWidth: number;
  maxHeight: number;
  format?: 'webp' | 'avif';
  quality?: number;
};

export type VideoOptimizeOptions = {
  targetHeight?: number;
  bitrateKbps?: number;
  fps?: number;
  format?: 'mp4';
  onProgress?: (percent: number) => void;
};

export async function optimizeImageFile(file: File, options: ImageOptimizeOptions): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const arrayBuf = await file.arrayBuffer();
  const input = Buffer.from(arrayBuf);
  const format = options.format ?? 'webp';
  const quality = options.quality ?? 75;

  const image = sharp(input, { animated: false });
  const metadata = await image.metadata();

  const width = metadata.width ?? options.maxWidth;
  const height = metadata.height ?? options.maxHeight;

  const result = await image
    .resize({
      width: Math.min(width, options.maxWidth),
      height: Math.min(height, options.maxHeight),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat(format, { quality })
    .toBuffer();

  const mimeType = format === 'avif' ? 'image/avif' : 'image/webp';
  const ext = format;
  return { buffer: result, mimeType, ext };
}

export async function optimizeVideoFile(file: File, options: VideoOptimizeOptions = {}): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  console.log('[VIDEO OPT] Starting video optimization, input size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
  
  const [{ default: ffmpegStaticPath }, { default: ffmpegLib }] = await Promise.all([
    import('ffmpeg-static').catch(() => ({ default: null as unknown as string })),
    import('fluent-ffmpeg') as Promise<{ default: typeof import('fluent-ffmpeg') }>,
  ]);
  const ffmpeg = (ffmpegLib as any) as typeof import('fluent-ffmpeg');
  
  let resolvedFfmpegPath: string | null = null;
  const candidates = [
    ffmpegStaticPath,
    process.env.FFMPEG_PATH,
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ].filter((p): p is string => !!p && typeof p === 'string');
  
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      resolvedFfmpegPath = candidate;
      console.log('[VIDEO OPT] Using ffmpeg at:', resolvedFfmpegPath);
      break;
    } catch {}
  }
  if (!resolvedFfmpegPath) {
    resolvedFfmpegPath = 'ffmpeg';
    console.log('[VIDEO OPT] Using ffmpeg from PATH');
  }
  if ((ffmpeg as any)?.setFfmpegPath) (ffmpeg as any).setFfmpegPath(resolvedFfmpegPath);

  const arrayBuf = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuf);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-opt-'));
  const inputPath = path.join(tmpDir, `input-${Date.now()}.${file.name.split('.').pop()}`);
  const outputPath = path.join(tmpDir, `output-${Date.now()}.mp4`);

  await fs.writeFile(inputPath, inputBuffer);
  console.log('[VIDEO OPT] Wrote input file to:', inputPath);

  const targetHeight = options.targetHeight ?? 720;
  const bitrate = options.bitrateKbps ?? 1200;
  const fps = options.fps ?? 24;
  
  console.log('[VIDEO OPT] Target: height=', targetHeight, 'bitrate=', bitrate, 'kbps fps=', fps);

  await new Promise<void>((resolve, reject) => {
    (ffmpeg as any)(inputPath)
      .videoCodec('libx264')
      .size(`?x${targetHeight}`)
      .videoBitrate(bitrate, true)
      .fps(fps)
      .outputOptions([
        '-preset slower',
        '-movflags +faststart',
        '-maxrate', `${Math.floor(bitrate * 1.2)}k`,
        '-bufsize', `${bitrate * 2}k`,
        '-profile:v high',
        '-level 4.1',
        '-g 48',
        '-keyint_min 48',
        '-sc_threshold 0',
        '-b_strategy 2',
        '-bf 3',
        '-refs 5',
        '-me_method umh',
        '-subq 9',
        '-trellis 2',
        '-psy-rd 1.0:0.15',
        '-aq-mode 3',
        '-aq-strength 0.8',
        '-pix_fmt yuv420p',
      ])
      .audioCodec('aac')
      .audioBitrate('128k')
      .audioChannels(2)
      .audioFrequency(48000)
      .on('start', (cmd: string) => {
        console.log('[VIDEO OPT] ffmpeg command:', cmd);
      })
      .on('progress', (progress: any) => {
        const percent = progress.percent || 0;
        console.log('[VIDEO OPT] Progress:', percent.toFixed(2), '%');
        if (options.onProgress && typeof percent === 'number') {
          options.onProgress(percent);
        }
      })
      .on('end', () => {
        console.log('[VIDEO OPT] ffmpeg finished');
        resolve();
      })
      .on('error', (err: Error) => {
        console.error('[VIDEO OPT] ffmpeg error:', err.message);
        reject(err);
      })
      .save(outputPath);
  });

  const buffer = await fs.readFile(outputPath);
  console.log('[VIDEO OPT] Output size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');

  try { await fs.unlink(inputPath); } catch {}
  try { await fs.unlink(outputPath); } catch {}
  try { await fs.rmdir(tmpDir); } catch {}

  return { buffer, mimeType: 'video/mp4', ext: 'mp4' };
}



import { Config } from '@remotion/cli/config';

// === Remotion Configuration for Boostify Music Video Creator ===

// Entry point
Config.setEntryPoint('./remotion/index.ts');

// Output defaults
Config.setCodec('h264');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(90);
Config.setPixelFormat('yuv420p');
Config.setAudioBitrate('320k');

// Rendering performance
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(60000);

// Output
Config.setOverwriteOutput(true);
Config.setOutputLocation('out/video.mp4');

// Studio config
Config.setPublicDir('./public');
Config.setLevel('info');

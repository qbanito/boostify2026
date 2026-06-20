type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioUnlockContext: AudioContext | null = null;

export type TalkToMeAudioSessionOptions = {
  preferHeadphonesForIosDevices: boolean;
  preferWebRtcForMobileDevices: boolean;
};

export type TalkToMeSessionTransport =
  | { connectionType: 'webrtc'; conversationToken: string }
  | { connectionType: 'websocket'; signedUrl: string };

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

function isPrivateNetworkHostname(hostname: string): boolean {
  return isLoopbackHostname(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^fd[0-9a-f]{2}:/i.test(hostname)
    || /^fc[0-9a-f]{2}:/i.test(hostname);
}

function tryUpgradeCurrentPageToHttps(): boolean {
  if (!isBrowser()) return false;
  if (window.location.protocol !== 'http:') return false;
  if (isPrivateNetworkHostname(window.location.hostname)) return false;

  const secureUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(secureUrl);
  return true;
}

export function isIosLikeDevice(): boolean {
  if (!isBrowser()) return false;
  const platform = navigator.platform || '';
  const userAgent = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(platform)
    || /iPad|iPhone|iPod/.test(userAgent)
    || (userAgent.includes('Mac') && 'ontouchend' in document);
}

export function isMobileTalkToMeDevice(): boolean {
  if (!isBrowser()) return false;
  const userAgent = navigator.userAgent || '';
  const hasTouch = navigator.maxTouchPoints > 1 || 'ontouchstart' in window;
  return isIosLikeDevice() || /Android|Mobile|iPhone|iPad|iPod/i.test(userAgent) || hasTouch;
}

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (!isBrowser()) return undefined;
  return window.AudioContext || (window as AudioContextWindow).webkitAudioContext;
}

async function unlockAudioPlayback(): Promise<void> {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) return;

  if (!audioUnlockContext || audioUnlockContext.state === 'closed') {
    audioUnlockContext = new AudioContextCtor();
  }

  if (audioUnlockContext.state === 'suspended') {
    await audioUnlockContext.resume();
  }

  const source = audioUnlockContext.createBufferSource();
  source.buffer = audioUnlockContext.createBuffer(1, 1, 22050);
  source.connect(audioUnlockContext.destination);
  source.start(0);
}

export function getTalkToMeAudioErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return getTalkToMeAudioErrorMessage({ message: error });
  }

  const value = error as { name?: string; message?: string };
  const name = value?.name || '';
  const message = value?.message || '';
  const signal = `${name} ${message}`.toLowerCase();

  if (/exceeds your quota|quota limit|out of credits|insufficient credits|credit limit|not enough credits/i.test(signal)) {
    return 'The artist AI has run out of ElevenLabs voice credits for now. The artist needs to top up or upgrade their ElevenLabs plan to re-enable live calls.';
  }
  if (/payment required|402|billing/i.test(signal)) {
    return 'Live calls are paused because the artist AI voice plan needs billing attention. Please check back soon.';
  }
  if (/unauthorized|invalid api key|401|403|forbidden/i.test(signal)) {
    return 'The artist AI voice service rejected the connection (authorization issue). The artist needs to re-check their ElevenLabs API key in Talk To Me settings.';
  }
  if (/429|too many requests|rate limit/i.test(signal)) {
    return 'The artist AI is receiving too many calls right now. Please wait a moment and try again.';
  }

  if (/https|secure context|secure boostify|only secure origins|insecure/i.test(signal)) {
    return 'Mobile browsers require HTTPS for microphone calls. I am opening the secure Boostify URL when possible; if you are on a local IP, use the deployed HTTPS site.';
  }

  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission denied|permission was blocked|notallowed|denied|blocked/i.test(signal)) {
    return 'Microphone permission is blocked for this site. On iPhone, open Settings > Safari > Microphone and allow it, or tap the AA/site settings icon and allow Microphone, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || /no audio capture devices|device not found|no microphone/i.test(signal)) {
    return 'No microphone was found on this device. Connect a mic or disable any browser restriction and try again.';
  }
  if (name === 'NotReadableError' || name === 'AbortError' || /could not start audio source|not readable|busy|in use|abort/i.test(signal)) {
    return 'The microphone is busy or unavailable. Close other apps or browser tabs using the mic, then try again.';
  }
  if (/audio worklet|audiocontext|playback|audio session/i.test(signal)) {
    return 'The mobile audio session could not start. Tap Call again from the browser tab, with silent mode off and media volume up.';
  }

  return message || 'Microphone or audio session failed. Please allow mic access and try again.';
}

export function getTalkToMeSessionTransport(params: {
  signedUrl?: string;
  conversationToken?: string;
  preferWebRtcForMobileDevices?: boolean;
}): TalkToMeSessionTransport {
  if (params.preferWebRtcForMobileDevices && params.conversationToken) {
    return { connectionType: 'webrtc', conversationToken: params.conversationToken };
  }
  if (params.signedUrl) {
    return { connectionType: 'websocket', signedUrl: params.signedUrl };
  }
  if (params.conversationToken) {
    return { connectionType: 'webrtc', conversationToken: params.conversationToken };
  }
  throw new Error('Could not start Talk To Me: missing ElevenLabs session credentials.');
}

export async function prepareTalkToMeAudioSession(): Promise<TalkToMeAudioSessionOptions> {
  if (!isBrowser()) return { preferHeadphonesForIosDevices: false, preferWebRtcForMobileDevices: false };

  const hostname = window.location.hostname;
  const isLocalhost = isLoopbackHostname(hostname);
  if (window.isSecureContext === false && !isLocalhost) {
    if (tryUpgradeCurrentPageToHttps()) {
      throw new Error('Redirecting to the secure HTTPS version so mobile microphone access can work.');
    }
    throw new Error(
      isPrivateNetworkHostname(hostname)
        ? 'Mobile browsers block microphone access on local network HTTP addresses. Open the deployed HTTPS Boostify URL on the phone, or run the local app through a trusted HTTPS tunnel.'
        : 'iPhone requires HTTPS for microphone audio. Open the secure Boostify URL in Safari or Chrome and try again.'
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    if (tryUpgradeCurrentPageToHttps()) {
      throw new Error('Redirecting to the secure HTTPS version so mobile microphone access can work.');
    }
    throw new Error('This browser cannot access the microphone. On iPhone, use Safari or Chrome and allow microphone access.');
  }

  try {
    await unlockAudioPlayback();
  } catch (error) {
    console.warn('[TTM] Audio unlock warning:', error);
  }

  return {
    preferHeadphonesForIosDevices: isIosLikeDevice(),
    preferWebRtcForMobileDevices: isMobileTalkToMeDevice(),
  };
}
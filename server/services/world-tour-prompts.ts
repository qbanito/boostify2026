import { WORLD_TOUR_DESTINATIONS, WORLD_TOUR_SHOTS, type TourProject, type TourPublicShow } from '../../shared/world-tour';

export function tourIdentity(project: Pick<TourProject, 'artistName' | 'lookDirection' | 'song' | 'destinationId'>, biography = '') {
  const destination = WORLD_TOUR_DESTINATIONS.find((item) => item.id === project.destinationId);
  if (!destination) throw new Error('Choose a valid concert destination.');
  return `Real live music photography of ${project.artistName}, performing ${project.song.title}. Music identity: ${project.song.genre || 'the artist own musical style'}. Artist context: ${biography.slice(0, 700)}. Venue: ${destination.setting} in ${destination.city}, ${destination.country}. Artist look: ${project.lookDirection || 'preserve the reference hairstyle, personal style and recognizable performance outfit'}. Preserve the exact identity, facial proportions, skin tone and hairstyle of the singer in the original face reference. Keep one coherent outfit, stage, band and lighting design across all frames. Skin has natural texture and subtle perspiration, hands are anatomically believable, instruments and stage equipment are physically plausible. Audience faces must be distinct from the singer and from each other. A successful headline concert, authentic shared emotion and realistic crowd density. Photographic realism, not illustration, animation, CGI, plastic skin or 3D rendering. No watermarks, fake logos or unreadable text.`;
}

export function createTourFrames(project: Pick<TourProject, 'artistName' | 'lookDirection' | 'song' | 'destinationId'>, biography = '') {
  const identity = tourIdentity(project, biography);
  return WORLD_TOUR_SHOTS.map((shot, index) => ({
    index, prompt: `${identity}\nSHOT ${index + 1}: ${shot.direction}\nCamera: ${shot.camera}. Capture one full-resolution photograph, without a collage, border or text.`,
    status: 'EMPTY' as const, approved: false,
  }));
}

export function createTourVideoPrompt(project: Pick<TourProject, 'artistName' | 'lookDirection' | 'song' | 'destinationId'>) {
  const destination = WORLD_TOUR_DESTINATIONS.find((item) => item.id === project.destinationId)!;
  const sequence = WORLD_TOUR_SHOTS.map((shot, i) => `${shot.start}-${shot.end}s, Image ${i + 2}: ${shot.direction}`).join('\n');
  return `Create a 15-second photorealistic live concert film of ${project.artistName} performing ${project.song.title} in ${destination.city}, ${destination.country}, at ${destination.setting}. Image 1 is the original artist face: preserve their identity. Images 2-10 are the chronological concert storyboard. Use the supplied audio excerpt as the song being performed. Natural expressive singing, believable microphone technique, a live band following the beat, cheering fans singing the hook, emotional audience reactions. Professional multicamera concert coverage with drone, jib, pit, side-stage, over-shoulder and telephoto angles. Each cut maintains spatial, wardrobe and lighting continuity. ${project.lookDirection}\n${sequence}\nEnd on the triumphant wide shot. Keep skin texture, realistic motion blur, exposure, lighting falloff and human imperfections. No animation, CGI or 3D aesthetic, no extra limbs, no duplicated singer in the audience, no captions or watermarks.`;
}

export function publicTourShows(project: TourProject): TourPublicShow[] {
  const destination = WORLD_TOUR_DESTINATIONS.find((item) => item.id === project.destinationId);
  if (!destination) return [];
  return project.renders.filter((render) => render.status === 'COMPLETED' && /^https:\/\//.test(render.videoUrl || '')).map((render) => ({
    id: render.id, title: `${project.artistName} - ${destination.city}`, city: destination.city,
    country: destination.country, videoUrl: render.videoUrl!, posterUrl: render.posterUrl,
    songTitle: project.song.title, duration: 15, createdAt: render.createdAt,
  }));
}

export function tourBoardError(project: TourProject): string | null {
  const anchor = project.frames[2];
  if (project.frames.length !== 9 || !anchor?.operationId || project.frames.some((frame, index) => frame.index !== index || frame.status !== 'READY' || !/^https:\/\//.test(frame.imageUrl || '') || !frame.approved || frame.anchorOperationId !== anchor.operationId)) {
    return 'Approve all nine images from the current artist anchor before rendering.';
  }
  return null;
}

export function tourVideoInput(project: TourProject) {
  const error = tourBoardError(project);
  if (error) throw new Error(error);
  return { prompt: project.videoPrompt, duration: 15, resolution: '720p', aspect_ratio: project.aspectRatio, audio: true,
    reference_image_urls: [project.faceUrl, ...project.frames.map((frame) => frame.imageUrl!)],
    enable_prompt_expansion: true, enable_thinking: true, enable_safety_checker: true };
}

export const WORLD_TOUR_VIDEO_MODEL = 'alibaba/wan-3.0/reference-to-video';
export const WORLD_TOUR_IMAGE_MODEL = 'fal-ai/nano-banana-pro/edit';
export const WORLD_TOUR_SYNC_MODEL = 'fal-ai/sync-lipsync/v3';
export const WORLD_TOUR_DURATION = 15;
export const WORLD_TOUR_HERO_INDEX = 2;
// Fal rates verified 2026-10-28. Quotes use the platform's current credit markup.
export const WORLD_TOUR_COST_USD = { image: 0.15, video: 15 * 0.05, sync: 15 / 60 * 8 };

export type TourDestination = { id: string; city: string; country: string; code: string; venue: string; setting: string; color: string; image: string };
export const WORLD_TOUR_DESTINATIONS: TourDestination[] = [
  { id: 'las-vegas', city: 'Las Vegas', country: 'United States', code: 'US', venue: 'Neon Arena', setting: 'a sold-out indoor arena, wraparound LED walls, amber spotlights, thousands of fans across steep seating tiers', color: '#d6fa6e' },
  { id: 'mexico-city', city: 'Mexico City', country: 'Mexico', code: 'MX', venue: 'Stadium Nights', setting: 'an immense open-air stadium at night, an extended stage runway, a sea of fans singing the hook', color: '#fca971' },
  { id: 'bogota', city: 'Bogota', country: 'Colombia', code: 'CO', venue: 'Mountain Festival', setting: 'a large outdoor music festival with distant Andean hills, cool evening air and deep blue stage beams', color: '#e3c36b' },
  { id: 'rio', city: 'Rio de Janeiro', country: 'Brazil', code: 'BR', venue: 'Ocean Stage', setting: 'a huge beachfront concert at blue hour, palm silhouettes, ocean horizon, warm concert lighting', color: '#77d9b3' },
  { id: 'buenos-aires', city: 'Buenos Aires', country: 'Argentina', code: 'AR', venue: 'Grand Theatre', setting: 'an ornate historic concert theatre with gilded balconies, warm tungsten lighting and a standing audience', color: '#a6cbf0' },
  { id: 'santiago', city: 'Santiago', country: 'Chile', code: 'CL', venue: 'Andes Stadium', setting: 'a vast stadium with distant mountain silhouettes, cinematic sunset fading into a dramatic light show', color: '#d594bb' },
  { id: 'lima', city: 'Lima', country: 'Peru', code: 'PE', venue: 'Plaza Sessions', setting: 'a large public plaza transformed into a professional concert venue, historic facades and cheering fans', color: '#f2a9a1' },
  { id: 'madrid', city: 'Madrid', country: 'Spain', code: 'ES', venue: 'Centerstage Arena', setting: 'a packed modern arena with a central runway, gold and crimson lights and sweeping crowd views', color: '#f3b870' },
  { id: 'lisbon', city: 'Lisbon', country: 'Portugal', code: 'PT', venue: 'Waterfront Live', setting: 'a large waterfront stage at golden hour, river reflections, warm breeze and a joyful crowd', color: '#8cd9cc' },
  { id: 'paris', city: 'Paris', country: 'France', code: 'FR', venue: 'Velvet Theatre', setting: 'an elegant Parisian music theatre with velvet balconies, a live band and atmospheric concert haze', color: '#d8a9d9' },
  { id: 'london', city: 'London', country: 'United Kingdom', code: 'GB', venue: 'Crown Arena', setting: 'a major indoor arena with premium televised-concert production, white spotlights and a packed floor', color: '#b4b4f3' },
  { id: 'berlin', city: 'Berlin', country: 'Germany', code: 'DE', venue: 'Warehouse Festival', setting: 'a large industrial open-air festival, steel rigging, graphic light beams and an energetic audience', color: '#a7b9ba' },
  { id: 'rome', city: 'Rome', country: 'Italy', code: 'IT', venue: 'Piazza After Dark', setting: 'a grand Roman public square at night, historic stone buildings and a tasteful modern concert stage', color: '#e2c19b' },
  { id: 'amsterdam', city: 'Amsterdam', country: 'Netherlands', code: 'NL', venue: 'City Lights Festival', setting: 'an outdoor urban waterfront festival, canal-city architecture, concert trusses and orange-blue stage lighting', color: '#efb786' },
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', code: 'JP', venue: 'Electric Dome', setting: 'an enormous indoor dome, immersive LED production, precise magenta-cyan lighting and synchronized audience light sticks', color: '#f7a1c2' },
  { id: 'seoul', city: 'Seoul', country: 'South Korea', code: 'KR', venue: 'Starlight Stadium', setting: 'a packed stadium, sophisticated moving lights, a sea of audience lights and a large performance runway', color: '#c1b0f4' },
  { id: 'mumbai', city: 'Mumbai', country: 'India', code: 'IN', venue: 'Monsoon Festival', setting: 'a large outdoor festival with a vibrant diverse crowd, humid evening atmosphere and rich amber stage lighting', color: '#e7bb76' },
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', code: 'AE', venue: 'Skyline Spectacle', setting: 'an upscale outdoor concert with a distant illuminated skyline, monumental stage production and a packed audience', color: '#d8c395' },
  { id: 'cape-town', city: 'Cape Town', country: 'South Africa', code: 'ZA', venue: 'Mountain Open Air', setting: 'a major outdoor concert with a broad mountain backdrop, sunset skies and warm live-music atmosphere', color: '#9ac1a0' },
  { id: 'sydney', city: 'Sydney', country: 'Australia', code: 'AU', venue: 'Harbour Nights', setting: 'a spectacular harbour-side concert at dusk, water reflections, sailboats in the distance and professional stage lighting', color: '#8fbddf' },
].map((destination) => ({ ...destination, image: `/static-assets/world-tour/venues/${destination.id}.webp` }));

export const WORLD_TOUR_SHOTS = [
  { id: 'scale', name: 'The world is watching', camera: 'Drone / 18mm', start: 0, end: 2, direction: 'A sweeping elevated establishing photograph of the entire packed venue, stage and thousands of fans. The lead performer is a small figure on stage.' },
  { id: 'entrance', name: 'Own the stage', camera: 'Jib / 35mm', start: 2, end: 3.5, direction: 'A low-angle full-body photograph of the lead artist stepping confidently onto the runway, microphone in hand, with the live band and audience visible.' },
  { id: 'identity', name: 'Every word, every feeling', camera: 'Artist close-up / 85mm', start: 3.5, end: 5.5, direction: 'An emotionally expressive close portrait of the lead singer performing into a microphone, face clearly visible, eyes engaged, natural skin texture, perspiration and authentic concert light.' },
  { id: 'motion', name: 'Feel the movement', camera: 'Stage left / 50mm', start: 5.5, end: 7, direction: 'A side-stage medium photograph of the singer moving with the beat, expressive singing and believable hands, cables, monitors and lighting rigs.' },
  { id: 'crowd', name: 'They know every word', camera: 'Crowd pit / 35mm', start: 7, end: 8.5, direction: 'An eye-level audience photograph of joyful distinct fans singing the chorus together, hands lifted, candid human expressions. None of the fans resemble the lead singer.' },
  { id: 'band', name: 'The live heartbeat', camera: 'Band / 70mm', start: 8.5, end: 10, direction: 'A candid concert photograph of the backing musicians performing live, realistic instrument positions, drummer, bassist and keyboards suited to the music genre.' },
  { id: 'connection', name: 'A thousand voices back', camera: 'Over the shoulder / 24mm', start: 10, end: 11.5, direction: 'A photograph from behind the singer looking out across the huge cheering crowd, artist silhouette and outfit consistent, physical distance and venue scale believable.' },
  { id: 'emotion', name: 'The moment they remember', camera: 'Audience telephoto / 100mm', start: 11.5, end: 13, direction: 'A candid close audience photograph of an emotional fan singing along, genuine tears of joy and a friend embracing them, distant stage bokeh, no duplicated faces.' },
  { id: 'finale', name: 'Leave them wanting more', camera: 'Hero wide / 28mm', start: 13, end: 15, direction: 'A triumphant wide concert photograph of the artist at the front of the stage, band behind, arms and microphone raised, entire audience responding under a spectacular but physically realistic lighting climax.' },
] as const;

export const worldTourShotReference = (index: number) => `/static-assets/world-tour/shots/${WORLD_TOUR_SHOTS[index]?.id || 'scale'}.webp`;

export type TourFrame = { index: number; prompt: string; status: 'EMPTY' | 'QUEUED' | 'READY' | 'FAILED'; imageUrl?: string; approved: boolean; operationId?: string; anchorOperationId?: string; error?: string };
export type TourSong = { id: string; title: string; audioUrl: string; isSingle: boolean; genre?: string; lyrics?: string; description?: string; duration?: string };
export type TourRender = { id: string; status: 'QUEUED' | 'SYNCING' | 'FINALIZING' | 'COMPLETED' | 'FAILED'; videoUrl?: string; posterUrl?: string; error?: string; precisionSync: boolean; createdAt: string };
export type TourProject = {
  id: string; artistId: number; artistName: string; destinationId: string; song: TourSong;
  faceUrl: string; lookDirection: string; aspectRatio: '16:9' | '9:16'; clipStart: number;
  frames: TourFrame[]; renders: TourRender[]; videoPrompt: string; createdAt: string; updatedAt: string;
};
export type TourPublicShow = { id: string; title: string; city: string; country: string; videoUrl: string; posterUrl?: string; songTitle: string; duration: number; createdAt: string };

/** Place a newly registered module below Podcast without moving a user's existing World Tour placement. */
export function insertWorldTour(order: string[]): string[] {
  if (order.includes('world-tour')) return order;
  const next = [...order];
  const after = next.indexOf('podcast-clips');
  next.splice(after < 0 ? next.length : after + 1, 0, 'world-tour');
  return next;
}

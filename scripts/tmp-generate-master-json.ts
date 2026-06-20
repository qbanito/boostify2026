import { writeFileSync } from 'node:fs';
import { analyzeAudio } from '../server/services/audio-analysis-service';
import { generateMasterSceneJSON, calculateTimelineStats } from '../server/services/auto-cut-engine';
import { getDirectorDPProfile } from '../server/services/cinematography-service';

async function main() {
  const song = {
    title: 'Night Drive',
    artistName: 'Boostify Demo',
    genre: 'synthwave',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
  };

  const analysisRaw = await analyzeAudio(song.audioUrl);

  const analysis = {
    ...analysisRaw,
    duration: 24,
    sections: [
      { type: 'intro', startTime: 0, endTime: 6, duration: 6, energy: 'medium', description: 'intro' },
      { type: 'verse', startTime: 6, endTime: 14, duration: 8, energy: 'high', description: 'verse' },
      { type: 'chorus', startTime: 14, endTime: 24, duration: 10, energy: 'peak', description: 'chorus' }
    ]
  } as any;

  const directorProfile = getDirectorDPProfile('Spike Jonze') || undefined;

  const baseScenes = [1, 2, 3, 4, 5, 6].map((i) => ({
    id: 'base_' + i,
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    section: i <= 2 ? 'intro' : i <= 4 ? 'verse' : 'chorus'
  }));

  const masterJSON = await generateMasterSceneJSON(
    'demo-' + Date.now(),
    analysis,
    baseScenes,
    {
      title: song.title + ' - ' + song.artistName,
      genre: song.genre,
      mood: ['energetic', 'futuristic'],
      directorProfile,
      generateVariations: false
    }
  );

  const stats = calculateTimelineStats(masterJSON);

  const payload = {
    song,
    analysisSummary: {
      bpm: analysis.bpm,
      genre: analysis.genre,
      mood: analysis.mood,
      duration: analysis.duration,
      sections: analysis.sections.length,
      keyMoments: analysis.keyMoments.length
    },
    directorApplied: directorProfile
      ? {
          name: directorProfile.director.name,
          cinematographer: directorProfile.cinematographer.name
        }
      : null,
    stats,
    masterJSON
  };

  writeFileSync('temp-request.json', JSON.stringify(payload, null, 2), 'utf8');
  console.log('WROTE temp-request.json');
  console.log('SCENES', masterJSON.totalScenes, 'VARIATIONS', masterJSON.totalVariations);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

const imageMap: Record<string, string> = {
  'hero-launch': 'hero-launch.png',
  'neural-network-core': 'neural-network-core.png',
  'motion-capture-hologram': 'motion-capture-hologram.png',
  'motion-trails': 'motion-trails.png',
  'body-movement-analysis': 'body-movement-analysis.png',
  'training-lab': 'training-lab.png',
  'dataset-visualization': 'dataset-visualization.png',
  '700-videos-collage': '700-videos-collage.png',
  'architecture-diagram': 'architecture-diagram.png',
  'ai-engine': 'ai-engine.png',
  'choreography-output': 'choreography-output.png',
  'virtual-avatar': 'virtual-avatar.png',
  'brand-identity': 'brand-identity.png',
  'cinematic-poster': 'cinematic-poster.png',
  'particle-dataset': 'particle-dataset.png',
  'holographic-stage': 'holographic-stage.png',
  'motion-spine': 'motion-spine.png',
  'kinetic-typography': 'kinetic-typography.png',
  'holographic-dancer-crystal': 'holographic-dancer-crystal.png',
  'glass-orb-motion': 'glass-orb-motion.png'
};

router.get('/motion-dna/:imageName', (req, res) => {
  const { imageName } = req.params;
  const fileName = imageMap[imageName];
  
  if (!fileName) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  const imagePath = path.join(process.cwd(), 'attached_assets', 'motion-dna', fileName);
  
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image file not found' });
  }
  
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  
  const imageStream = fs.createReadStream(imagePath);
  imageStream.pipe(res);
});

export default router;

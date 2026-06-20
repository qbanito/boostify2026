import { generateAndSaveImage } from "../server/services/gemini-image";

// Selected prompts from each category (2 per category)
const prompts = [
  // Technology Core
  { id: "tech-1", filename: "neural-network-core.png", prompt: "Futuristic neural network core glowing with orange and purple energy, representing motion analysis, dynamic lines swirling around a central AI brain, cinematic lighting, hyper-realistic render, Boostify MotionDNA aesthetic" },
  { id: "tech-2", filename: "motion-capture-hologram.png", prompt: "3D hologram of a motion-capture skeleton model performing dynamic dance movements, surrounded by floating data points and waveform graphs, deep black background with neon orange accents" },
  
  // Movement Analysis
  { id: "move-1", filename: "motion-trails.png", prompt: "Abstract visualization of human motion trails captured over time, long exposure style, neon ribbons forming dancing silhouettes, high-tech atmosphere" },
  { id: "move-2", filename: "body-movement-analysis.png", prompt: "AI analyzing body movement with geometric overlays, pose estimation joints, lines connecting elbows knees shoulders, glowing minimal interface" },
  
  // Model Training
  { id: "train-1", filename: "training-lab.png", prompt: "AI training lab environment with giant transparent screens showing datasets of body movements, video fragments floating in space" },
  { id: "train-2", filename: "dataset-visualization.png", prompt: "Dataset visualization made of thousands of tiny frames from real music videos forming the shape of a dancer in motion" },
  
  // System Architecture
  { id: "arch-1", filename: "architecture-diagram.png", prompt: "Boostify MotionDNA architecture diagram turned into an artistic tech visualization, modules connected with glowing veins" },
  { id: "arch-2", filename: "ai-engine.png", prompt: "Backend AI engine as a futuristic machine with moving gears made of data streams, glowing orange and pink" },
  
  // Movement Output
  { id: "output-1", filename: "choreography-output.png", prompt: "Artist silhouette moving gracefully with motion-trail effects, showing MotionDNA-generated choreography, glowing background" },
  { id: "output-2", filename: "virtual-avatar.png", prompt: "Virtual avatar performing movements guided by MotionDNA, surrounded by UI panels and movement grids" },
  
  // Brand Theme
  { id: "brand-1", filename: "brand-identity.png", prompt: "Boostify MotionDNA identity artwork in deep black background with orange gradients, abstract movement shapes" },
  { id: "brand-2", filename: "cinematic-poster.png", prompt: "High-end cinematic poster for MotionDNA featuring holographic dancer silhouette and glowing motion vectors" },
  
  // Dataset Visualization
  { id: "data-1", filename: "700-videos-collage.png", prompt: "Collage-style visualization of 700+ music videos transformed into a motion dataset, blurred frames forming dynamic shapes" },
  { id: "data-2", filename: "particle-dataset.png", prompt: "Dataset rendered as millions of tiny particles forming a moving dancer silhouette" },
  
  // Concept Art
  { id: "concept-1", filename: "holographic-stage.png", prompt: "Futuristic stage made of holograms where movement is projected as colored lines, cinematic wide shot" },
  { id: "concept-2", filename: "motion-spine.png", prompt: "MotionDNA represented as a glowing spine-like structure moving through digital space" },
  
  // Marketing Visuals
  { id: "market-1", filename: "hero-launch.png", prompt: "Hero image for a tech product launch featuring motion trails, holographic UI and AI dancer silhouette" },
  { id: "market-2", filename: "kinetic-typography.png", prompt: "3D kinetic typography poster with the text 'MotionDNA – Boostify' made of floating motion vectors" },
  
  // Premium Visuals
  { id: "premium-1", filename: "holographic-dancer-crystal.png", prompt: "Ultra-premium render showing a holographic dancer emerging from a crystal-like AI core" },
  { id: "premium-2", filename: "glass-orb-motion.png", prompt: "Futuristic glass orb containing swirling movement data and silhouettes" },
];

async function generateAllImages() {
  console.log(`Starting generation of ${prompts.length} images...`);
  
  for (let i = 0; i < prompts.length; i++) {
    const { id, filename, prompt } = prompts[i];
    console.log(`\n[${i + 1}/${prompts.length}] Generating: ${filename}`);
    console.log(`Prompt: ${prompt.substring(0, 80)}...`);
    
    try {
      const filePath = await generateAndSaveImage(prompt, filename);
      console.log(`✓ Saved to: ${filePath}`);
    } catch (error) {
      console.error(`✗ Error generating ${filename}:`, error);
    }
    
    // Wait a bit between requests to avoid rate limiting
    if (i < prompts.length - 1) {
      console.log(`Waiting 3 seconds before next generation...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`\n✓ Image generation complete!`);
}

generateAllImages().catch(console.error);

/**
 * One-off script to seed initial news articles.
 * Run: npx tsx seed-news.ts
 */
import 'dotenv/config';
import { generateDailyArticle } from './server/services/news-generator';

const topics = [
  { topic: "Autonomous Artist Systems", angle: "How autonomous agents are replacing traditional music management", category: "autonomous-artists" },
  { topic: "AI Music Generation", angle: "How Boostify's music generator creates studio-quality tracks in minutes", category: "ai-music" },
  { topic: "Web3 & Blockchain in Music", angle: "How tokenized music rights are creating new revenue streams", category: "web3" },
  { topic: "Platform Technology", angle: "Inside Boostify's multi-agent architecture for music growth", category: "technology" },
  { topic: "Music Industry Innovation", angle: "The future of sync licensing: AI-powered matching and negotiation", category: "innovation" },
];

async function main() {
  console.log(`\n🗞️  Seeding ${topics.length} news articles...\n`);

  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    console.log(`[${i + 1}/${topics.length}] Generating: "${t.angle}"...`);
    try {
      const result = await generateDailyArticle(t);
      if (result.success) {
        console.log(`  ✅ Created: "${result.title}" (ID: ${result.articleId})`);
      } else {
        console.log(`  ❌ Failed: ${result.error}`);
      }
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  console.log('\n✅ Done seeding news articles!\n');
  process.exit(0);
}

main();

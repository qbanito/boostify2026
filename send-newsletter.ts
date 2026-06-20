/**
 * Quick script to send all Boostify news articles individually to specified email
 * Usage: npx tsx send-newsletter.ts
 */
import 'dotenv/config';
import { sendAllArticlesSeparately, sendArticleToIndustryContacts } from './server/services/news-newsletter';

async function main() {
  console.log('📰 Sending all articles individually to convoycubano@gmail.com...\n');
  
  const result = await sendAllArticlesSeparately(30, ['convoycubano@gmail.com']);

  console.log('\n── Result ──');
  console.log(`Success: ${result.success}`);
  if ('sent' in result) console.log(`Emails sent: ${result.sent} (${result.articlesCount} articles)`);
  if ('results' in result && result.results) {
    for (const r of result.results as any[]) {
      console.log(`  ${r.success ? '✅' : '❌'} [${r.provider}] ${r.title} → ${r.messageId || r.error || ''}`);
    }
  }
  if ('error' in result) console.log(`Error: ${result.error}`);

  // Send latest article to 20 industry contacts from Supabase
  console.log('\n📧 Sending latest article to 20 music industry contacts...\n');
  const { db } = await import('./server/db');
  const { newsArticles } = await import('./db/schema');
  const { desc } = await import('drizzle-orm');
  const [latest] = await db.select({ id: newsArticles.id, title: newsArticles.title })
    .from(newsArticles)
    .orderBy(desc(newsArticles.id))
    .limit(1);

  if (latest) {
    const outreach = await sendArticleToIndustryContacts(latest.id);
    console.log(`── Industry Outreach ──`);
    console.log(`Article: ${latest.title}`);
    console.log(`Sent: ${outreach.sent} | Failed: ${outreach.failed} | Skipped: ${outreach.skipped} | Total: ${outreach.total}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

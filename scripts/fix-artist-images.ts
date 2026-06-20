/**
 * Fix artist profile images - update existing artists with real images
 */
import 'dotenv/config';
import { db, pool } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Real images from Unsplash for demo artists
const ARTIST_IMAGES: Record<string, { profile: string; cover: string }> = {
  'luna_echo': {
    profile: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1200&h=400&fit=crop'
  },
  'urban_flow': {
    profile: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=400&fit=crop'
  },
  'electric_dreams': {
    profile: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop'
  },
  'soul_harmony': {
    profile: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=400&fit=crop'
  },
  'maya_rivers': {
    profile: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=400&fit=crop'
  },
  'jah_vibes': {
    profile: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1200&h=400&fit=crop'
  },
  'david_chen': {
    profile: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&h=400&fit=crop'
  },
  'sophia_kim': {
    profile: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=1200&h=400&fit=crop'
  },
  'marcus_stone': {
    profile: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=1200&h=400&fit=crop'
  },
  'isabella_santos': {
    profile: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop',
    cover: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&h=400&fit=crop'
  }
};

async function fixArtistImages() {
  console.log('🔄 Fixing artist profile images...\n');
  
  try {
    for (const [username, images] of Object.entries(ARTIST_IMAGES)) {
      const result = await db.update(users)
        .set({
          profileImage: images.profile,
          coverImage: images.cover,
        })
        .where(eq(users.username, username))
        .returning({ id: users.id, username: users.username });
      
      if (result.length > 0) {
        console.log(`✅ Updated ${username} (ID: ${result[0].id})`);
      } else {
        console.log(`⚠️ Artist ${username} not found`);
      }
    }
    
    console.log('\n🎉 Done! All artist images updated.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixArtistImages();

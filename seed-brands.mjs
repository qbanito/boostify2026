/**
 * Seed demo brands + products for Brand Collaborations panel
 */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function seed() {
  console.log('🏢 Seeding demo brands...');

  // Insert 3 demo brands
  const brands = await sql`
    INSERT INTO brand_profiles (name, slug, industry, description, website, contact_email, logo, instagram_handle, tiktok_handle, follower_count)
    VALUES
      ('Nike', 'nike', 'fashion', 'Just Do It. Global leader in athletic footwear and apparel.', 'https://nike.com', 'partnerships@nike.com', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/200px-Logo_NIKE.svg.png', '@nike', '@nike', 300000000),
      ('Red Bull', 'red-bull', 'food_beverage', 'Red Bull gives you wings. Energy drinks and extreme sports.', 'https://redbull.com', 'music@redbull.com', 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Red_Bull_Racing_logo.svg/200px-Red_Bull_Racing_logo.svg.png', '@redbull', '@redbull', 58000000),
      ('Beats by Dre', 'beats-by-dre', 'tech', 'Premium headphones and audio for music lovers.', 'https://beatsbydre.com', 'collabs@beatsbydre.com', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Beats_Electronics_logo.svg/200px-Beats_Electronics_logo.svg.png', '@beatsbydre', '@beatsbydre', 15000000)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, name
  `;

  if (brands.length === 0) {
    console.log('ℹ️  Brands already exist, fetching...');
    const existing = await sql`SELECT id, name FROM brand_profiles WHERE slug IN ('nike', 'red-bull', 'beats-by-dre')`;
    brands.push(...existing);
  }

  console.log(`✅ Brands: ${brands.map(b => b.name).join(', ')}`);

  const nikeId = brands.find(b => b.name === 'Nike')?.id;
  const redbullId = brands.find(b => b.name === 'Red Bull')?.id;
  const beatsId = brands.find(b => b.name === 'Beats by Dre')?.id;

  // Insert products for each brand
  if (nikeId) {
    await sql`
      INSERT INTO brand_products (brand_id, name, description, image_url, price, category, product_url)
      VALUES
        (${nikeId}, 'Air Max 90', 'Iconic streetwear sneaker with visible Air cushioning', 'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/0d64f603-a1da-4be1-a651-c9e4c0a630c7/AIR+MAX+90.png', '130.00', 'Shoes', 'https://nike.com/air-max-90'),
        (${nikeId}, 'Nike Dunk Low', 'Classic basketball shoe turned streetwear staple', 'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/e3e67ac4-8a31-43b5-b61d-1bedf3e38d8a/NIKE+DUNK+LOW+RETRO.png', '115.00', 'Shoes', 'https://nike.com/dunk-low'),
        (${nikeId}, 'Nike Tech Fleece Hoodie', 'Premium lightweight warmth with modern design', 'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/3a72de12-68ec-4ffd-a6c4-0de3ac042544/TECH+FLEECE+HOODIE.png', '130.00', 'Apparel', 'https://nike.com/tech-fleece')
      ON CONFLICT DO NOTHING
    `;
    console.log('  ✅ Nike products added');
  }

  if (redbullId) {
    await sql`
      INSERT INTO brand_products (brand_id, name, description, image_url, price, category, product_url)
      VALUES
        (${redbullId}, 'Red Bull Energy 4-Pack', 'Original energy drink that gives you wings', 'https://m.media-amazon.com/images/I/71VV9vCQXzL._SL1500_.jpg', '7.99', 'Drinks', 'https://redbull.com/original'),
        (${redbullId}, 'Red Bull Sugar Free', 'Same wings, zero sugar', 'https://m.media-amazon.com/images/I/71s-7K+cOuL._SL1500_.jpg', '7.99', 'Drinks', 'https://redbull.com/sugar-free')
      ON CONFLICT DO NOTHING
    `;
    console.log('  ✅ Red Bull products added');
  }

  if (beatsId) {
    await sql`
      INSERT INTO brand_products (brand_id, name, description, image_url, price, category, product_url)
      VALUES
        (${beatsId}, 'Beats Studio Pro', 'Premium wireless noise-cancelling headphones for studio-quality sound', 'https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg', '349.99', 'Headphones', 'https://beatsbydre.com/headphones/studio-pro'),
        (${beatsId}, 'Beats Fit Pro', 'True wireless earbuds with Active Noise Cancelling', 'https://m.media-amazon.com/images/I/51gxGC08ytL._AC_SL1500_.jpg', '199.99', 'Earbuds', 'https://beatsbydre.com/earbuds/fit-pro'),
        (${beatsId}, 'Beats Pill Speaker', 'Portable Bluetooth speaker with 24-hour battery', 'https://m.media-amazon.com/images/I/61Hmo8+3XlL._AC_SL1500_.jpg', '149.99', 'Speakers', 'https://beatsbydre.com/speakers/pill')
      ON CONFLICT DO NOTHING
    `;
    console.log('  ✅ Beats products added');
  }

  console.log('\n🎉 Demo data seeded! Go to Brand Collaborations → Brands tab to see them.');
}

seed().catch(console.error);

import { db } from "./firebase-admin";

async function seedCourses() {
  const coursesData = [
    {
      title: "Music Marketing Mastery: Digital Promotion Strategies",
      description: "Master the art of digital music marketing and promotion. Learn how to build a strong online presence, engage with fans, and promote your music effectively across various digital platforms.",
      createdBy: "system",
      createdAt: new Date(),
      content: {
        curriculum: [
          {
            title: "Digital Marketing Fundamentals for Musicians",
            description: "Understanding the basics of digital marketing in the music industry",
            estimatedMinutes: 45
          },
          {
            title: "Building Your Social Media Strategy",
            description: "Creating and managing effective social media presence for musicians",
            estimatedMinutes: 60
          },
          {
            title: "Content Creation for Musicians",
            description: "Creating engaging content for various social platforms",
            estimatedMinutes: 75
          },
          {
            title: "Email Marketing for Artists",
            description: "Building and managing an effective email marketing campaign",
            estimatedMinutes: 45
          },
          {
            title: "Music Release Strategy",
            description: "Planning and executing successful music releases",
            estimatedMinutes: 90
          },
          {
            title: "Spotify Playlist Pitching",
            description: "Techniques for getting your music on popular playlists",
            estimatedMinutes: 60
          },
          {
            title: "YouTube Channel Optimization",
            description: "Growing your presence on YouTube",
            estimatedMinutes: 75
          },
          {
            title: "Instagram Marketing for Musicians",
            description: "Maximizing your Instagram presence",
            estimatedMinutes: 60
          },
          {
            title: "TikTok Strategy for Artists",
            description: "Creating viral content on TikTok",
            estimatedMinutes: 45
          },
          {
            title: "Digital Advertising for Musicians",
            description: "Running effective ad campaigns on social media",
            estimatedMinutes: 90
          }
        ]
      }
    },
    {
      title: "Music Business Essentials: Legal and Financial Management",
      description: "Essential knowledge about music business, legal aspects, and financial management for music industry professionals. Learn about contracts, royalties, publishing, and business planning.",
      createdBy: "system",
      createdAt: new Date(),
      content: {
        curriculum: [
          {
            title: "Music Industry Structure",
            description: "Understanding the key players and relationships in the music industry",
            estimatedMinutes: 60
          },
          {
            title: "Music Copyright Basics",
            description: "Understanding music copyright and intellectual property",
            estimatedMinutes: 90
          },
          {
            title: "Publishing Rights and Royalties",
            description: "Managing music publishing and collecting royalties",
            estimatedMinutes: 75
          },
          {
            title: "Record Label Contracts",
            description: "Understanding and negotiating record deals",
            estimatedMinutes: 90
          },
          {
            title: "Music Distribution Agreements",
            description: "Digital distribution and streaming platform agreements",
            estimatedMinutes: 60
          },
          {
            title: "Financial Planning for Musicians",
            description: "Budgeting, accounting, and financial management",
            estimatedMinutes: 75
          },
          {
            title: "Music Business Revenue Streams",
            description: "Understanding different income sources in music",
            estimatedMinutes: 60
          },
          {
            title: "Music Licensing and Sync",
            description: "Licensing music for TV, film, and advertising",
            estimatedMinutes: 90
          },
          {
            title: "Building Your Music Business Plan",
            description: "Creating a comprehensive business plan for your music career",
            estimatedMinutes: 75
          },
          {
            title: "Legal Requirements and Business Structure",
            description: "Setting up your music business legally",
            estimatedMinutes: 60
          }
        ]
      }
    }
  ];

  try {
    // Borrar cursos existentes
    const coursesRef = db.collection('courses');
    const snapshot = await coursesRef.get();
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('Existing courses deleted successfully');

    // Crear nuevos cursos
    for (const courseData of coursesData) {
      await db.collection('courses').add(courseData);
    }

    console.log('New courses seeded successfully');
  } catch (error) {
    console.error('Error seeding courses:', error);
  }
}

seedCourses();
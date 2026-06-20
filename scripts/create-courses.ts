import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { generateCourseContent } from '../client/src/lib/api/openrouter';
import { getRelevantImage } from '../client/src/lib/unsplash-service';

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "boostify-music",
  // Las credenciales se proporcionarán como variables de entorno
};

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const sampleCourses = [
  {
    title: "Music Marketing Mastery",
    description: "Learn advanced digital marketing strategies specifically tailored for musicians and music industry professionals. From social media optimization to email campaigns, discover how to effectively promote your music in the digital age.",
    category: "Marketing",
    level: "Intermediate",
    price: 199
  },
  {
    title: "Music Business Essentials",
    description: "Master the fundamentals of the music business. Learn about copyright law, royalties, music licensing, and how to navigate contracts. Essential knowledge for any music professional.",
    category: "Business",
    level: "Beginner",
    price: 249
  },
  {
    title: "Advanced Music Production & Engineering",
    description: "Deep dive into professional music production techniques. From advanced mixing and mastering to studio workflow optimization, take your production skills to the next level.",
    category: "Production",
    level: "Advanced",
    price: 299
  },
  {
    title: "Artist Brand Development",
    description: "Learn how to build and maintain a strong artist brand. Cover everything from visual identity to social media presence, and create a compelling artist narrative that resonates with your audience.",
    category: "Branding",
    level: "Intermediate",
    price: 179
  },
  {
    title: "Digital Music Distribution Mastery",
    description: "Master the digital distribution landscape. Learn about streaming platforms, playlist pitching, release strategies, and how to maximize your music's reach in the digital age.",
    category: "Distribution",
    level: "Beginner",
    price: 149
  }
];

const generateRandomCourseData = () => {
  return {
    rating: Number((Math.random() * (5 - 3.5) + 3.5).toFixed(1)), // Random rating between 3.5-5.0
    totalReviews: Math.floor(Math.random() * (1000 - 50 + 1)) + 50, // Random reviews between 50-1000
    enrolledStudents: Math.floor(Math.random() * (5000 - 100 + 1)) + 100, // Random students between 100-5000
  };
};

async function createSampleCourses() {
  try {
    let createdCount = 0;

    for (const course of sampleCourses) {
      console.log(`Creating course ${createdCount + 1}/5: ${course.title}`);

      // Generate course thumbnail
      const imagePrompt = `professional education ${course.title} ${course.category} music industry course cover, modern design, minimalist`;
      const thumbnailUrl = await getRelevantImage(imagePrompt);

      const prompt = `Generate a professional music course with these characteristics:
        - Title: "${course.title}"
        - Description: "${course.description}"
        - Level: ${course.level}
        - Category: ${course.category}

        The course should be detailed and practical, focused on the current music industry. Include specific actionable steps and real-world examples.`;

      const courseContent = await generateCourseContent(prompt);
      const randomData = generateRandomCourseData();

      const courseData = {
        ...course,
        content: courseContent,
        thumbnail: thumbnailUrl,
        lessons: courseContent.curriculum.length,
        duration: `${Math.ceil(courseContent.curriculum.length / 2)} weeks`,
        ...randomData,
        createdAt: new Date(),
        createdBy: "admin"
      };

      await db.collection('courses').add(courseData);
      createdCount++;
      console.log(`Successfully created course: ${course.title}`);
    }

    console.log(`Successfully created all ${createdCount} courses`);
  } catch (error) {
    console.error('Error creating courses:', error);
    throw error;
  }
}

// Execute the function
createSampleCourses()
  .then(() => {
    console.log('All courses created successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create courses:', error);
    process.exit(1);
  });

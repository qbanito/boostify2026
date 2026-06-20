import { collection, addDoc, Timestamp } from "firebase/firestore";
import { logger } from "./logger";
import { db } from "../firebase";
import { generateCourseContent } from "./api/openrouter";
import { getRelevantImage } from "./unsplash-service";

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
    rating: Number((Math.random() * (5 - 3.5) + 3.5).toFixed(1)),
    totalReviews: Math.floor(Math.random() * (1000 - 50 + 1)) + 50,
    enrolledStudents: Math.floor(Math.random() * (5000 - 100 + 1)) + 100,
  };
};

export async function createSampleCourses(userId: string) {
  let createdCount = 0;
  const errors: Array<{course: string, error: string}> = [];

  try {
    if (!db) {
      throw new Error("Firebase database not initialized");
    }

    logger.info("Starting sample course creation...");

    for (const course of sampleCourses) {
      try {
        logger.info(`Creating course ${createdCount + 1}/5: ${course.title}`);

        // Generate course thumbnail
        let thumbnailUrl: string;
        try {
          const imagePrompt = `professional education ${course.title} ${course.category} music industry course cover, modern design, minimalist`;
          thumbnailUrl = await getRelevantImage(imagePrompt);
          logger.info("Generated thumbnail URL:", thumbnailUrl);
        } catch (imageError) {
          logger.error(`Error generating thumbnail for ${course.title}:`, imageError);
          thumbnailUrl = "https://images.unsplash.com/photo-1511379938547-c1f69419868d"; // Fallback image
        }

        const prompt = `Generate a professional music course with these characteristics:
          - Title: "${course.title}"
          - Description: "${course.description}"
          - Level: ${course.level}
          - Category: ${course.category}

          The course should be detailed and practical, focused on the current music industry. Include specific actionable steps and real-world examples.`;

        logger.info(`Generating course content for: ${course.title}`);
        const courseContent = await generateCourseContent(prompt);
        logger.info("Course content generated successfully");

        const randomData = generateRandomCourseData();

        const courseData = {
          ...course,
          content: courseContent,
          thumbnail: thumbnailUrl,
          lessons: courseContent.curriculum.length,
          duration: `${Math.ceil(courseContent.curriculum.length / 2)} weeks`,
          ...randomData,
          createdAt: Timestamp.now(),
          createdBy: userId
        };

        await addDoc(collection(db, 'courses'), courseData);
        createdCount++;
        logger.info(`Successfully created course: ${course.title}`);
      } catch (courseError) {
        logger.error(`Error creating course ${course.title}:`, courseError);
        errors.push({
          course: course.title,
          error: courseError instanceof Error ? courseError.message : 'Unknown error'
        });
        continue; // Continue with next course even if one fails
      }
    }

    if (errors.length > 0) {
      logger.warn(`Completed with ${errors.length} errors:`, errors);
      if (createdCount === 0) {
        throw new Error(`Failed to create any courses. Errors: ${JSON.stringify(errors)}`);
      }
    }

    logger.info(`Successfully created ${createdCount} courses`);
    return { createdCount, errors };
  } catch (error) {
    logger.error('Error in createSampleCourses:', error);
    throw error;
  }
}
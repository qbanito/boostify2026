import { auth } from "../firebase";
import { logger } from "./logger";
import { createSampleCourses } from "./create-sample-courses";

async function createCourses() {
  try {
    // User ID from the logs
    const userId = "coqofMnNMQUmnqU39h5EEO05Lwi1";
    
    logger.info("Starting course creation...");
    await createSampleCourses(userId);
    logger.info("Course creation completed!");
    
    // Reload the page to see the new courses
    window.location.reload();
  } catch (error) {
    logger.error("Failed to create courses:", error);
  }
}

// Execute the function
createCourses();

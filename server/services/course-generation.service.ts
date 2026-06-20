import { db } from "@db";
import { 
  courses, 
  courseLessons, 
  courseQuizzes, 
  quizQuestions, 
  contentGenerationQueue,
  lessonProgress,
  courseEnrollments
} from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import * as openaiCourse from "./openai-course.service";
import * as courseMedia from "./course-media.service";

export interface ProgressiveCourseRequest {
  topic: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  lessonsCount: number;
  instructorId: number;
  price: string;
  dripStrategy: "date" | "enrollment" | "sequential" | "prerequisite";
  targetHours?: number; // optional: keep auto-generating lessons until this many hours of content
}

// ─── Auto-generation bounds (cost control) ───────────────────────────────
// Courses auto-generate lessons only until they reach the course's advertised
// length (its target hours). This stops the previously-unbounded growth so
// token/media costs stay predictable.
const MAX_LESSONS = 60;            // absolute hard cap on lessons per course
const MAX_TARGET_MINUTES = 720;    // 12h hard cap on a course's target length
const MIN_TARGET_MINUTES = 45;     // never aim below ~45min of content

/**
 * Resolve how many minutes of content a course should ultimately contain
 * (its "target hours"). Parses explicit hours/minutes from the duration field,
 * otherwise falls back to the sum of the current lesson durations (the
 * advertised length). Always clamped to safe bounds.
 */
function getCourseTargetMinutes(
  course: { duration?: string | null },
  allLessons: Array<{ duration?: number | null }>
): number {
  const sumMinutes = allLessons.reduce((s, l) => s + (l.duration || 0), 0);
  const raw = (course?.duration || '').toLowerCase();
  let target = sumMinutes;

  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/);
  const minMatch = raw.match(/(\d+)\s*(minutes?|mins?|min)\b/);
  if (hourMatch) {
    target = Math.round(parseFloat(hourMatch[1]) * 60);
  } else if (minMatch) {
    target = parseInt(minMatch[1], 10);
  }

  if (!Number.isFinite(target) || target <= 0) target = sumMinutes || MIN_TARGET_MINUTES;
  return Math.min(Math.max(target, MIN_TARGET_MINUTES), MAX_TARGET_MINUTES);
}

export async function createProgressiveCourse(request: ProgressiveCourseRequest) {
  try {
    console.log("🎯 Starting progressive course generation for:", request.topic);

    // Use OpenAI for text generation — ask for more lessons (15-25) for long courses
    const lessonsCount = Math.max(request.lessonsCount, 15);
    console.log("📝 Generating course outline with OpenAI...");
    const outline = await openaiCourse.generateCourseOutline(
      request.topic,
      request.level,
      lessonsCount
    );

    console.log("💾 Creating course in database...");
    const [course] = await db.insert(courses).values({
      instructorId: request.instructorId,
      title: outline.title,
      description: outline.description,
      price: request.price,
      category: outline.category,
      level: request.level,
      duration: request.targetHours
        ? `${request.targetHours} hours`
        : `${outline.lessons.reduce((sum, l) => sum + l.duration, 0)} minutes`,
      lessonsCount: outline.lessons.length,
      thumbnail: null,
      dripStrategy: request.dripStrategy,
      isAIGenerated: true,
      generationStatus: "generating",
      status: "draft"
    }).returning();

    console.log("✅ Course created with ID:", course.id);

    console.log("📚 Creating lesson placeholders...");
    const lessonPromises = outline.lessons.map((lesson, index) => {
      const dripConfig: any = {};
      
      if (request.dripStrategy === "sequential") {
        dripConfig.prerequisiteLessonId = index > 0 ? index : null;
      } else if (request.dripStrategy === "enrollment") {
        dripConfig.dripDaysOffset = index * 3;
      }

      return db.insert(courseLessons).values({
        courseId: course.id,
        title: lesson.title,
        description: lesson.description,
        content: "Content will be generated when you unlock this lesson...",
        duration: lesson.duration,
        orderIndex: index,
        ...dripConfig,
        isGenerated: false,
        generationStatus: "pending"
      }).returning();
    });

    const lessonsResults = await Promise.all(lessonPromises);
    const createdLessons = lessonsResults.map(r => r[0]);

    // Generate thumbnail with FAL Flux Dev (high quality)
    console.log("🎨 Generating course thumbnail with FAL...");
    try {
      const thumbnailUrl = await courseMedia.generateCourseThumbnail(
        outline.title,
        outline.category
      );
      if (thumbnailUrl) {
        await db.update(courses)
          .set({ thumbnail: thumbnailUrl })
          .where(eq(courses.id, course.id));
      }
    } catch (error) {
      console.warn("⚠️ Thumbnail generation failed, using placeholder");
    }

    // Mark as completed
    await db.update(courses)
      .set({ generationStatus: "completed", status: "published" })
      .where(eq(courses.id, course.id));

    console.log("✅ Course structure created successfully!");

    return {
      course,
      lessons: createdLessons,
      message: "Course created! Content will be generated progressively as students advance."
    };
  } catch (error: any) {
    console.error("❌ Error creating progressive course:", error);
    throw new Error(`Course generation failed: ${error.message}`);
  }
}

export async function generateLessonOnDemand(
  lessonId: number,
  userId: number
) {
  try {
    const [lesson] = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.id, lessonId));

    if (!lesson) {
      throw new Error("Lesson not found");
    }

    if (lesson.isGenerated) {
      return { lesson, alreadyGenerated: true };
    }

    console.log(`🎓 Generating content for lesson: ${lesson.title}`);

    const [course] = await db.select()
      .from(courses)
      .where(eq(courses.id, lesson.courseId));

    const previousLessons = await db.select()
      .from(courseLessons)
      .where(
        and(
          eq(courseLessons.courseId, lesson.courseId),
          sql`${courseLessons.orderIndex} < ${lesson.orderIndex}`
        )
      );

    // OpenAI for text content (comprehensive, 1500+ words)
    const lessonContent = await openaiCourse.generateLessonContent(
      lesson.title,
      course.title,
      previousLessons.map(l => l.title)
    );

    // FAL for lesson illustration image
    console.log(`🎨 Generating lesson image with FAL...`);
    let imageUrl: string | null = null;
    try {
      imageUrl = await courseMedia.generateLessonImage(
        lesson.title,
        course.title,
        lessonContent.description
      );
    } catch (e) {
      console.warn('⚠️ Lesson image generation failed');
    }

    // FAL for audio narration (full spoken lesson, derived from content)
    console.log(`🎙️ Generating lesson narration with FAL TTS...`);
    let audioUrl: string | null = null;
    try {
      audioUrl = await courseMedia.generateLessonAudio(
        lesson.title,
        course.title,
        lessonContent.content,
        lessonContent.keyPoints
      );
    } catch (e) {
      console.warn('⚠️ Lesson narration generation failed');
    }

    // YouTube for a relevant lesson video (free, no token cost)
    console.log(`🎬 Finding a relevant lesson video on YouTube...`);
    let videoUrl: string | null = null;
    let videoMeta: { embedUrl: string; title: string; channel: string } | null = null;
    try {
      const video = await courseMedia.generateLessonVideo(lesson.title, course.title, course.category || undefined);
      if (video) {
        videoUrl = video.embedUrl;
        videoMeta = { embedUrl: video.embedUrl, title: video.title, channel: video.channel };
      }
    } catch (e) {
      console.warn('⚠️ Lesson video search failed');
    }

    // OpenAI for quiz questions
    console.log(`📝 Generating quiz questions with OpenAI...`);
    const quizQuestionsData = await openaiCourse.generateQuizQuestions(
      lesson.title,
      lessonContent.content,
      5
    );

    // Store materials with audio narration + key points + video metadata
    const materials: any = {};
    if (audioUrl) {
      materials.audioUrl = audioUrl;
      materials.audioIntroUrl = audioUrl; // backwards compatibility with existing UI
    }
    if (lessonContent.keyPoints?.length) {
      materials.keyPoints = lessonContent.keyPoints;
    }
    if (videoMeta) {
      materials.video = videoMeta;
    }

    await db.update(courseLessons)
      .set({
        content: lessonContent.content,
        description: lessonContent.description,
        imageUrl: imageUrl,
        videoUrl: videoUrl,
        materials: Object.keys(materials).length ? materials : null,
        isGenerated: true,
        generationStatus: "completed"
      })
      .where(eq(courseLessons.id, lessonId));

    const [quiz] = await db.insert(courseQuizzes).values({
      lessonId: lesson.id,
      title: `${lesson.title} - Quiz`,
      description: `Test your understanding of ${lesson.title}`,
      passingScore: 70,
      orderIndex: 0,
      isGenerated: true
    }).returning();

    await Promise.all(
      quizQuestionsData.map((q, index) =>
        db.insert(quizQuestions).values({
          quizId: quiz.id,
          question: q.question,
          questionType: q.questionType as any,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: q.points,
          orderIndex: index
        })
      )
    );

    // Auto-expand course toward its target hours (bounded — stops at the
    // course's advertised length so cost stays controlled).
    const allLessons = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, lesson.courseId));

    const remainingUngenerated = allLessons.filter(l => !l.isGenerated).length;
    const totalMinutes = allLessons.reduce((s, l) => s + (l.duration || 0), 0);
    const targetMinutes = getCourseTargetMinutes(course, allLessons);

    if (
      remainingUngenerated <= 2 &&
      totalMinutes < targetMinutes &&
      allLessons.length < MAX_LESSONS
    ) {
      // Add expansion lessons in background (don't block response)
      expandCourse(course.id, course.title, allLessons.map(l => l.title), targetMinutes).catch(
        err => console.warn('⚠️ Course expansion failed:', err.message)
      );
    } else if (totalMinutes >= targetMinutes) {
      console.log(`🏁 Course "${course.title}" reached its target length (${totalMinutes}/${targetMinutes} min) — no further expansion.`);
    }

    const [updatedLesson] = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.id, lessonId));

    console.log(`✅ Lesson content generated successfully!`);

    return {
      lesson: updatedLesson,
      quiz,
      alreadyGenerated: false
    };
  } catch (error: any) {
    console.error("❌ Error generating lesson content:", error);
    
    await db.update(courseLessons)
      .set({
        generationStatus: "failed"
      })
      .where(eq(courseLessons.id, lessonId));

    throw new Error(`Lesson generation failed: ${error.message}`);
  }
}

export async function checkLessonUnlockStatus(
  userId: number,
  lessonId: number
): Promise<{ unlocked: boolean; reason?: string }> {
  try {
    const [lesson] = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.id, lessonId));

    if (!lesson) {
      return { unlocked: false, reason: "Lesson not found" };
    }

    const [course] = await db.select()
      .from(courses)
      .where(eq(courses.id, lesson.courseId));

    const [enrollment] = await db.select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.userId, userId),
          eq(courseEnrollments.courseId, lesson.courseId),
          eq(courseEnrollments.status, "active")
        )
      );

    if (!enrollment) {
      return { unlocked: false, reason: "Not enrolled in course" };
    }

    if (course.dripStrategy === "sequential") {
      if (lesson.orderIndex === 0) {
        return { unlocked: true };
      }

      const previousLessons = await db.select()
        .from(courseLessons)
        .where(
          and(
            eq(courseLessons.courseId, lesson.courseId),
            sql`${courseLessons.orderIndex} < ${lesson.orderIndex}`
          )
        );

      for (const prevLesson of previousLessons) {
        const [progress] = await db.select()
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, userId),
              eq(lessonProgress.lessonId, prevLesson.id),
              eq(lessonProgress.completed, true)
            )
          );

        if (!progress) {
          return { 
            unlocked: false, 
            reason: `Complete "${prevLesson.title}" first` 
          };
        }
      }

      return { unlocked: true };
    }

    if (course.dripStrategy === "enrollment" && lesson.dripDaysOffset !== null) {
      const daysSinceEnrollment = Math.floor(
        (Date.now() - enrollment.enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceEnrollment < lesson.dripDaysOffset) {
        return { 
          unlocked: false, 
          reason: `Unlocks in ${lesson.dripDaysOffset - daysSinceEnrollment} days` 
        };
      }

      return { unlocked: true };
    }

    if (course.dripStrategy === "date" && lesson.dripDate) {
      if (new Date() < lesson.dripDate) {
        return { 
          unlocked: false, 
          reason: `Unlocks on ${lesson.dripDate.toLocaleDateString()}` 
        };
      }

      return { unlocked: true };
    }

    return { unlocked: true };
  } catch (error: any) {
    console.error("Error checking lesson unlock status:", error);
    return { unlocked: false, reason: "Error checking unlock status" };
  }
}

/**
 * Auto-expand a course by generating additional lessons until it reaches its
 * target length (target hours). Bounded so it never grows past the advertised
 * duration or the absolute lesson cap — keeps generation costs predictable.
 */
async function expandCourse(
  courseId: number,
  courseTitle: string,
  existingTitles: string[],
  targetMinutes: number
) {
  try {
    // Re-read current state so we don't overshoot the target.
    const current = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId));
    let totalMinutes = current.reduce((s, l) => s + (l.duration || 0), 0);

    if (totalMinutes >= targetMinutes || current.length >= MAX_LESSONS) {
      console.log(`🏁 "${courseTitle}" already at target (${totalMinutes}/${targetMinutes} min) — skip expansion.`);
      return;
    }

    console.log(`📈 Expanding "${courseTitle}" toward target (${totalMinutes}/${targetMinutes} min)...`);
    const newLessons = await openaiCourse.generateExpansionLessons(
      courseTitle,
      existingTitles,
      5
    );

    const currentMax = current.length;
    let inserted = 0;

    for (let i = 0; i < newLessons.length; i++) {
      // Stop as soon as the target length (or hard cap) is reached.
      if (totalMinutes >= targetMinutes || currentMax + inserted >= MAX_LESSONS) break;

      const dur = newLessons[i].duration || 15;
      await db.insert(courseLessons).values({
        courseId,
        title: newLessons[i].title,
        description: newLessons[i].description,
        content: "Content will be generated when you unlock this lesson...",
        duration: dur,
        orderIndex: currentMax + inserted,
        isGenerated: false,
        generationStatus: "pending",
      });
      totalMinutes += dur;
      inserted++;
    }

    if (inserted > 0) {
      await db.update(courses)
        .set({ lessonsCount: currentMax + inserted })
        .where(eq(courses.id, courseId));
      console.log(`✅ "${courseTitle}" expanded with ${inserted} lessons (now ${totalMinutes}/${targetMinutes} min)`);
    } else {
      console.log(`🏁 "${courseTitle}" target reached — no lessons added.`);
    }
  } catch (error: any) {
    console.error("❌ Course expansion error:", error.message);
  }
}

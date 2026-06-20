import { Router, Request } from 'express';
import { db } from '@db';
import { 
  courses, 
  courseLessons, 
  courseQuizzes,
  quizQuestions,
  quizAttempts,
  lessonProgress,
  courseEnrollments,
  courseInstructors,
  subscriptions,
  users
} from '@db/schema';
import { authenticate } from '../middleware/auth';
import { eq, and, desc, or } from 'drizzle-orm';
import * as courseGenService from '../services/course-generation.service';
import * as courseMedia from '../services/course-media.service';

const router = Router();

// ─── Auth helper — resolves Clerk/Firebase string ID to PG integer ───
// Auto-provisions a `users` row when an authenticated identity (Clerk/Firebase)
// has no DB record yet, so enrolling always resolves to a real integer id
// instead of returning null and 401-ing the request.
async function getUserPgId(req: Request): Promise<number | null> {
  const u: any = (req as any).user || {};
  const clerkId: string | undefined = (req as any).auth?.userId || u.uid;
  const rawId = u.id;
  const email: string | null = u.email ?? null;

  // 1. Already a numeric PG id on the request → use it directly.
  const numId = Number(rawId);
  if (!isNaN(numId) && numId > 0) return numId;

  // 2. Look up by Clerk id / Firebase id / username.
  const candidates = [clerkId, rawId].filter(Boolean).map(String);
  for (const cand of candidates) {
    const [row] = await db.select({ id: users.id }).from(users)
      .where(or(eq(users.clerkId, cand), eq(users.firestoreId, cand), eq(users.username, cand)))
      .limit(1);
    if (row) return row.id;
  }

  // 3. No DB row but we have an authenticated identity → create one.
  const provisionId = clerkId || (rawId ? String(rawId) : null);
  if (!provisionId) return null;
  try {
    const isClerk = provisionId.startsWith('user_');
    const artistName = email?.split('@')[0] || 'Artist';
    const [created] = await db.insert(users).values({
      clerkId: isClerk ? provisionId : undefined,
      firestoreId: !isClerk ? provisionId : undefined,
      username: provisionId,
      email,
      artistName,
      role: u.role === 'admin' ? 'admin' : 'artist',
    }).returning({ id: users.id });
    return created.id;
  } catch (err: any) {
    // Race / unique conflict — re-read.
    const [row] = await db.select({ id: users.id }).from(users)
      .where(or(eq(users.clerkId, provisionId), eq(users.firestoreId, provisionId), eq(users.username, provisionId)))
      .limit(1);
    if (row) return row.id;
    console.error('[education] getUserPgId provisioning failed:', err.message);
    return null;
  }
}

// Resolve a numeric course id OR a title-slug to the integer course id.
async function resolveCourseId(identifier: string): Promise<number | null> {
  const numericId = parseInt(identifier);
  if (!isNaN(numericId)) return numericId;
  const allCourses = await db.select().from(courses);
  const match = allCourses.find(c => {
    const titleSlug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return titleSlug === identifier || c.title.toLowerCase().includes(identifier.replace(/-/g, ' '));
  });
  return match?.id ?? null;
}

// Robustly decide whether the selected option index matches the stored correct
// answer. The generator may store the answer as the option text, a letter
// (A–D), or an index string, so we accept all three encodings.
function isCorrectAnswer(
  correctAnswer: string,
  selectedIdx: number | undefined,
  selectedText: string | undefined,
  options: string[]
): boolean {
  if (selectedIdx === undefined || selectedIdx === null) return false;
  const ca = String(correctAnswer ?? '').trim();
  if (!ca) return false;
  if (selectedText !== undefined && selectedText.trim().toLowerCase() === ca.toLowerCase()) return true;
  if (/^\d+$/.test(ca) && parseInt(ca, 10) === selectedIdx) return true;
  if (/^[a-zA-Z]$/.test(ca) && ca.toUpperCase().charCodeAt(0) - 65 === selectedIdx) return true;
  const caIdx = options.findIndex(o => String(o).trim().toLowerCase() === ca.toLowerCase());
  if (caIdx >= 0 && caIdx === selectedIdx) return true;
  return false;
}

router.get('/api/education/courses', async (req, res) => {
  try {
    const allCourses = await db.select().from(courses).orderBy(desc(courses.createdAt));
    res.json(allCourses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.get('/api/education/courses/:id', async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    
    const [course] = await db.select()
      .from(courses)
      .where(eq(courses.id, courseId));

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const lessons = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(courseLessons.orderIndex);

    res.json({ course, lessons });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

router.post('/api/education/generate-course', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { topic, level, lessonsCount, price, dripStrategy } = req.body;

    if (!topic || !level) {
      return res.status(400).json({ error: 'Topic and level are required' });
    }

    let [instructor] = await db.select()
      .from(courseInstructors)
      .where(eq(courseInstructors.userId, userId));

    if (!instructor) {
      [instructor] = await db.insert(courseInstructors).values({
        userId,
        specialization: 'Music Education',
        yearsOfExperience: 1,
      }).returning();
    }

    const result = await courseGenService.createProgressiveCourse({
      topic,
      level: level as "Beginner" | "Intermediate" | "Advanced",
      lessonsCount: lessonsCount || 8,
      instructorId: instructor.id,
      price: price || "0.00",
      dripStrategy: dripStrategy || "sequential"
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error generating course:', error);
    res.status(500).json({ 
      error: 'Failed to generate course', 
      message: error.message 
    });
  }
});

router.post('/api/education/enroll/:courseId', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const courseId = parseInt(req.params.courseId);

    const [course] = await db.select()
      .from(courses)
      .where(eq(courses.id, courseId));

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [existingEnrollment] = await db.select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.userId, userId),
          eq(courseEnrollments.courseId, courseId)
        )
      );

    if (existingEnrollment) {
      return res.json({ 
        enrollment: existingEnrollment, 
        alreadyEnrolled: true 
      });
    }

    const [enrollment] = await db.insert(courseEnrollments).values({
      userId,
      courseId,
      status: "active",
      progress: 0
    }).returning();

    const [firstLesson] = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(courseLessons.orderIndex)
      .limit(1);

    if (firstLesson) {
      await db.insert(lessonProgress).values({
        userId,
        lessonId: firstLesson.id,
        unlockedAt: new Date(),
        completed: false
      });
    }

    res.status(201).json({ enrollment, alreadyEnrolled: false });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

router.get('/api/education/lessons/:lessonId', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const lessonId = parseInt(req.params.lessonId);

    const unlockStatus = await courseGenService.checkLessonUnlockStatus(
      userId,
      lessonId
    );

    if (!unlockStatus.unlocked) {
      return res.status(403).json({ 
        error: 'Lesson locked', 
        reason: unlockStatus.reason 
      });
    }

    const [lesson] = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.id, lessonId));

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (!lesson.isGenerated) {
      console.log(`📖 Generating lesson content on-demand for lesson ${lessonId}`);
      const result = await courseGenService.generateLessonOnDemand(
        lessonId,
        userId
      );
      
      return res.json({ 
        lesson: result.lesson, 
        quiz: result.quiz,
        generated: true 
      });
    }

    const quizzes = await db.select()
      .from(courseQuizzes)
      .where(eq(courseQuizzes.lessonId, lessonId));

    const [progress] = await db.select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      );

    res.json({ lesson, quizzes, progress });
  } catch (error: any) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ 
      error: 'Failed to fetch lesson',
      message: error.message 
    });
  }
});

router.post('/api/education/lessons/:lessonId/complete', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const lessonId = parseInt(req.params.lessonId);

    // Check if progress already exists
    const [existing] = await db.select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      );

    if (existing) {
      // Update existing
      await db.update(lessonProgress)
        .set({ completed: true, completedAt: new Date() })
        .where(eq(lessonProgress.id, existing.id));
    } else {
      // Insert new
      await db.insert(lessonProgress).values({
        userId,
        lessonId,
        completed: true,
        completedAt: new Date()
      });
    }

    const [lesson] = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.id, lessonId));

    const allLessons = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, lesson.courseId))
      .orderBy(courseLessons.orderIndex);

    const nextLesson = allLessons[lesson.orderIndex + 1];

    if (nextLesson) {
      // Check if next lesson progress already exists
      const [nextExisting] = await db.select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, userId),
            eq(lessonProgress.lessonId, nextLesson.id)
          )
        );
      if (!nextExisting) {
        await db.insert(lessonProgress).values({
          userId,
          lessonId: nextLesson.id,
          unlockedAt: new Date(),
          completed: false
        });
      }
    }

    res.json({ success: true, nextLesson });
  } catch (error) {
    console.error('Error completing lesson:', error);
    res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

router.get('/api/education/quizzes/:quizId', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const quizId = parseInt(req.params.quizId);

    const [quiz] = await db.select()
      .from(courseQuizzes)
      .where(eq(courseQuizzes.id, quizId));

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = await db.select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.orderIndex);

    res.json({ quiz, questions });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

router.post('/api/education/quizzes/:quizId/submit', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const quizId = parseInt(req.params.quizId);
    const { answers } = req.body;

    const [quiz] = await db.select()
      .from(courseQuizzes)
      .where(eq(courseQuizzes.id, quizId));

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = await db.select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));

    let score = 0;
    let totalPoints = 0;

    questions.forEach(q => {
      totalPoints += q.points;
      if (answers[q.id] === q.correctAnswer) {
        score += q.points;
      }
    });

    const percentage = (score / totalPoints) * 100;
    const passed = percentage >= quiz.passingScore;

    const [attempt] = await db.insert(quizAttempts).values({
      userId,
      quizId,
      score,
      totalPoints,
      passed,
      answers
    }).returning();

    res.json({ attempt, percentage, passed });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

router.get('/api/education/my-courses', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const enrollments = await db.select()
      .from(courseEnrollments)
      .where(eq(courseEnrollments.userId, userId))
      .orderBy(desc(courseEnrollments.enrolledAt));

    const enrolledCourses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const [course] = await db.select()
          .from(courses)
          .where(eq(courses.id, enrollment.courseId));

        const lessons = await db.select()
          .from(courseLessons)
          .where(eq(courseLessons.courseId, enrollment.courseId));

        const completedLessons = await db.select()
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, userId),
              eq(lessonProgress.completed, true)
            )
          );

        return {
          ...course,
          enrollment,
          progress: Math.round((completedLessons.length / lessons.length) * 100),
          totalLessons: lessons.length,
          completedLessons: completedLessons.length
        };
      })
    );

    res.json(enrolledCourses);
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled courses' });
  }
});

router.post('/api/education/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const imageUrl = await courseMedia.generateLessonImage(prompt, 'Boostify Academy');
    
    res.json({ imageUrl });
  } catch (error: any) {
    console.error('Error generating image:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      message: error.message 
    });
  }
});

// Academy slug-based enrollment — auto-creates DB entry if needed
router.post('/api/education/enroll-academy/:slug', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required — user not found in database' });
    }

    const slug = req.params.slug;
    const { title, description, level, category, price, lessonsCount, lessonTitles, lessonDescriptions, lessonDurations } = req.body;

    if (!title || !slug) {
      return res.status(400).json({ error: 'Course data required' });
    }

    // Check if we already have this slug in the DB
    const [existing] = await db.select().from(courses)
      .where(eq(courses.title, title))
      .limit(1);

    let courseId: number;

    if (existing) {
      courseId = existing.id;
    } else {
      // Create the course in DB
      let [instructor] = await db.select()
        .from(courseInstructors)
        .where(eq(courseInstructors.userId, userId));

      if (!instructor) {
        [instructor] = await db.insert(courseInstructors).values({
          userId,
          specialization: category || 'Music Education',
          yearsOfExperience: 1,
        }).returning();
      }

      const [newCourse] = await db.insert(courses).values({
        instructorId: instructor.id,
        title,
        description: description || '',
        price: String(price != null ? price : '0.00'),
        category: category || 'General',
        level: level || 'Beginner',
        duration: `${lessonsCount || 8} lessons`,
        lessonsCount: lessonsCount || 8,
        thumbnail: null,
        dripStrategy: 'sequential',
        isAIGenerated: false,
        generationStatus: 'completed',
        status: 'published',
      }).returning();

      courseId = newCourse.id;

      // Create lesson placeholders — generated dynamically (text + image + audio)
      // the first time the student opens each lesson.
      const titles = lessonTitles || [];
      const descriptions = lessonDescriptions || [];
      const durations = lessonDurations || [];
      for (let i = 0; i < titles.length; i++) {
        await db.insert(courseLessons).values({
          courseId,
          title: titles[i],
          description: descriptions[i] || '',
          content: 'Content will be generated when you open this lesson...',
          duration: durations[i] || 15,
          orderIndex: i,
          isGenerated: false,
          generationStatus: 'pending',
        });
      }
    }

    // Check existing enrollment
    const [existingEnrollment] = await db.select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.userId, userId),
          eq(courseEnrollments.courseId, courseId)
        )
      );

    if (existingEnrollment) {
      return res.json({ enrollment: existingEnrollment, alreadyEnrolled: true });
    }

    // Create enrollment
    const [enrollment] = await db.insert(courseEnrollments).values({
      userId,
      courseId,
      status: 'active',
      progress: 0,
    }).returning();

    // Unlock first lesson
    const [firstLesson] = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(courseLessons.orderIndex)
      .limit(1);

    if (firstLesson) {
      // Check if progress entry already exists
      const [existingProg] = await db.select()
        .from(lessonProgress)
        .where(and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, firstLesson.id)
        ));
      if (!existingProg) {
        await db.insert(lessonProgress).values({
          userId,
          lessonId: firstLesson.id,
          unlockedAt: new Date(),
          completed: false,
        });
      }
    }

    res.status(201).json({ enrollment, alreadyEnrolled: false, courseId });
  } catch (error: any) {
    console.error('Error enrolling in academy course:', error?.message || error);
    console.error('Stack:', error?.stack);
    res.status(500).json({ 
      error: 'Failed to enroll in academy course',
      details: error?.message || String(error)
    });
  }
});

// Generate thumbnails for academy courses (batch — admin use)
router.post('/api/education/generate-thumbnails', async (req, res) => {
  try {
    const { courses: coursesData } = req.body;
    if (!coursesData || !Array.isArray(coursesData)) {
      return res.status(400).json({ error: 'courses array required' });
    }

    const results = await courseMedia.generateAcademyThumbnails(coursesData);
    res.json({ thumbnails: results, generated: Object.keys(results).length });
  } catch (error: any) {
    console.error('Error generating thumbnails:', error);
    res.status(500).json({ error: 'Failed to generate thumbnails', message: error.message });
  }
});

// ─── GET enrollment status for a course (by courseId or slug-matched title) ───
router.get('/api/education/enrollment/:identifier', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.json(null); // Can't check enrollment without numeric user ID
    }

    const identifier = req.params.identifier;
    const numericId = parseInt(identifier);

    let courseId: number | null = null;

    if (!isNaN(numericId)) {
      // Numeric DB course ID
      courseId = numericId;
    } else {
      // Slug — find the course by searching for it in DB (enrolled academy courses are stored with their title)
      const allCourses = await db.select().from(courses);
      const match = allCourses.find(c => {
        // Match by slug pattern in title or by checking the slug itself
        const titleSlug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return titleSlug === identifier || c.title.toLowerCase().includes(identifier.replace(/-/g, ' '));
      });
      if (match) courseId = match.id;
    }

    if (!courseId) {
      return res.json(null); // Not enrolled / course not found in DB yet
    }

    const [enrollment] = await db.select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.userId, userId),
          eq(courseEnrollments.courseId, courseId)
        )
      );

    if (!enrollment) {
      return res.json(null);
    }

    res.json({ ...enrollment, resolvedCourseId: courseId });
  } catch (error) {
    console.error('Error checking enrollment:', error);
    res.status(500).json({ error: 'Failed to check enrollment' });
  }
});

// ─── GET lesson progress for a course ──────────────────────
router.get('/api/education/progress/:identifier', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.json([]);
    }

    const identifier = req.params.identifier;
    const numericId = parseInt(identifier);

    let courseId: number | null = null;

    if (!isNaN(numericId)) {
      courseId = numericId;
    } else {
      const allCourses = await db.select().from(courses);
      const match = allCourses.find(c => {
        const titleSlug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return titleSlug === identifier || c.title.toLowerCase().includes(identifier.replace(/-/g, ' '));
      });
      if (match) courseId = match.id;
    }

    if (!courseId) {
      return res.json([]);
    }

    // Get all lessons for this course
    const lessons = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(courseLessons.orderIndex);

    // Get progress for all these lessons
    const progressEntries = await Promise.all(
      lessons.map(async (lesson, index) => {
        const [prog] = await db.select()
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, userId),
              eq(lessonProgress.lessonId, lesson.id)
            )
          );
        return {
          lessonId: lesson.id,
          lessonIndex: index,
          completed: prog?.completed || false,
          completedAt: prog?.completedAt || null,
          isUnlocked: !!prog,
        };
      })
    );

    res.json(progressEntries);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// ─── GET lessons for a course (by courseId or slug) ────────
router.get('/api/education/course-lessons/:identifier', authenticate, async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const numericId = parseInt(identifier);

    let courseId: number | null = null;

    if (!isNaN(numericId)) {
      courseId = numericId;
    } else {
      const allCourses = await db.select().from(courses);
      const match = allCourses.find(c => {
        const titleSlug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return titleSlug === identifier || c.title.toLowerCase().includes(identifier.replace(/-/g, ' '));
      });
      if (match) courseId = match.id;
    }

    if (!courseId) {
      return res.json([]);
    }

    const lessons = await db.select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(courseLessons.orderIndex);

    res.json(lessons);
  } catch (error) {
    console.error('Error fetching course lessons:', error);
    res.status(500).json({ error: 'Failed to fetch course lessons' });
  }
});

// Generate a single course thumbnail (cached in DB → generated once for all clients)
router.post('/api/education/generate-thumbnail', async (req, res) => {
  try {
    const { title, category, slug, description, force } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title required' });
    }

    // Academy courses (with a slug) are cached in Firestore so the image is
    // generated a single time and reused for every future visitor.
    const url = slug
      ? await courseMedia.getOrCreateAcademyThumbnail(slug, title, category || 'Music', description, !!force)
      : await courseMedia.generateCourseThumbnail(title, category || 'Music', { slug, description });

    if (!url) {
      return res.status(502).json({ error: 'Thumbnail generation failed' });
    }

    res.json({ thumbnailUrl: url, cached: !!slug });
  } catch (error: any) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail', message: error.message });
  }
});

// Return all cached academy thumbnails at once (slug → URL) so the catalog can
// hydrate instantly from the database without regenerating per browser.
router.get('/api/education/academy-thumbnails', async (_req, res) => {
  try {
    const thumbnails = await courseMedia.getCachedAcademyThumbnails();
    res.json({ thumbnails });
  } catch (error: any) {
    console.error('Error fetching academy thumbnails:', error);
    res.json({ thumbnails: {} });
  }
});

// Academy hero banner — generated once (OpenAI-first) and cached for all clients.
router.get('/api/education/academy-hero', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const url = await courseMedia.getOrCreateAcademyHero(force);
    res.json({ url: url || null });
  } catch (error: any) {
    console.error('Error fetching academy hero:', error);
    res.json({ url: null });
  }
});

// ─── QUIZ: the quiz for a lesson (generates lesson + quiz on demand) ───────
router.get('/api/education/quizzes/:lessonId', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const lessonId = parseInt(req.params.lessonId);
    if (isNaN(lessonId)) return res.status(400).json({ error: 'Invalid lesson id' });

    let [quiz] = await db.select().from(courseQuizzes)
      .where(eq(courseQuizzes.lessonId, lessonId)).limit(1);

    // No quiz yet → make sure the lesson (and therefore its quiz) is generated.
    if (!quiz) {
      const [lesson] = await db.select().from(courseLessons)
        .where(eq(courseLessons.id, lessonId));
      if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
      if (!lesson.isGenerated) {
        try {
          await courseGenService.generateLessonOnDemand(lessonId, userId);
        } catch (e: any) {
          console.warn('Quiz on-demand lesson generation failed:', e?.message);
        }
        [quiz] = await db.select().from(courseQuizzes)
          .where(eq(courseQuizzes.lessonId, lessonId)).limit(1);
      }
    }

    res.json(quiz || {});
  } catch (error: any) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// ─── QUIZ: questions for a quiz (correct answers stripped for fairness) ────
router.get('/api/education/quiz-questions/:quizId', authenticate, async (req, res) => {
  try {
    const quizId = parseInt(req.params.quizId);
    if (isNaN(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });

    const questions = await db.select().from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.orderIndex);

    res.json(questions.map(q => ({
      id: q.id,
      quizId: q.quizId,
      question: q.question,
      questionText: q.question, // UI expects `questionText`
      questionType: q.questionType,
      options: (q.options as string[]) || [],
      points: q.points,
      orderIndex: q.orderIndex,
    })));
  } catch (error: any) {
    console.error('Error fetching quiz questions:', error);
    res.status(500).json({ error: 'Failed to fetch quiz questions' });
  }
});

// ─── QUIZ: submit answers, grade server-side, record the attempt ──────────
router.post('/api/education/submit-quiz', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { quizId, answers } = req.body as { quizId: number; answers: Record<string, number> };
    if (!quizId) return res.status(400).json({ error: 'quizId is required' });

    const [quiz] = await db.select().from(courseQuizzes)
      .where(eq(courseQuizzes.id, quizId)).limit(1);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const questions = await db.select().from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.orderIndex);
    if (questions.length === 0) return res.status(400).json({ error: 'Quiz has no questions' });

    let earned = 0;
    let totalPoints = 0;
    const review = questions.map(q => {
      const pts = q.points || 1;
      totalPoints += pts;
      const options = (q.options as string[]) || [];
      const selectedIdx = answers?.[String(q.id)];
      const selectedText = typeof selectedIdx === 'number' ? options[selectedIdx] : undefined;
      const correct = isCorrectAnswer(q.correctAnswer, selectedIdx, selectedText, options);
      if (correct) earned += pts;
      return { questionId: q.id, correct, correctAnswer: q.correctAnswer, explanation: q.explanation };
    });

    const score = totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0;
    const passingScore = quiz.passingScore || 70;
    const passed = score >= passingScore;

    await db.insert(quizAttempts).values({
      userId,
      quizId,
      score,
      totalPoints,
      passed,
      answers: (answers || {}) as any,
    });

    res.json({ score, passed, earned, totalPoints, passingScore, review });
  } catch (error: any) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// ─── DIPLOMA / CERTIFICATE — issued when every lesson is completed ─────────
router.get('/api/education/certificate/:identifier', authenticate, async (req, res) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const courseId = await resolveCourseId(req.params.identifier);
    if (!courseId) return res.status(404).json({ error: 'Course not found' });

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const lessons = await db.select().from(courseLessons)
      .where(eq(courseLessons.courseId, courseId));
    const totalLessons = lessons.length;

    let completed = 0;
    let lastCompletedAt: Date | null = null;
    for (const l of lessons) {
      const [p] = await db.select().from(lessonProgress)
        .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, l.id)));
      if (p?.completed) {
        completed++;
        if (p.completedAt && (!lastCompletedAt || p.completedAt > lastCompletedAt)) {
          lastCompletedAt = p.completedAt;
        }
      }
    }

    const eligible = totalLessons > 0 && completed >= totalLessons;

    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const recipientName =
      u?.artistName || u?.username || (u?.email ? u.email.split('@')[0] : 'Boostify Artist');

    // Mark the enrollment completed the moment all lessons are done.
    if (eligible) {
      await db.update(courseEnrollments)
        .set({ status: 'completed', progress: 100, completedAt: lastCompletedAt || new Date() })
        .where(and(
          eq(courseEnrollments.userId, userId),
          eq(courseEnrollments.courseId, courseId)
        ));
    }

    res.json({
      eligible,
      certificateId: `BST-${course.id}-${userId}`,
      courseTitle: course.title,
      recipientName,
      totalLessons,
      lessonsCompleted: completed,
      progressPct: totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0,
      completedAt: lastCompletedAt,
      issuedAt: eligible ? new Date() : null,
      issuer: 'Boostify Academy',
    });
  } catch (error: any) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

export default router;

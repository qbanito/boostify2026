import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';

export interface CourseData {
  id?: string;
  title: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  thumbnail: string | null;
  price: string;
  estimatedHours: number;
  objectives: string[];
  topics: string[];
  skills: string[];
  prerequisites: string[];
  preview: Array<{ title: string; description: string; duration: string }>;
  fullCurriculum?: any;
  quiz?: any;
  isPublished: boolean;
  createdAt?: string;
}

export interface EnrolledCourse extends CourseData {
  enrolledAt: string;
  progress: number;
  fullContent?: any;
}

const COURSES_COLLECTION = 'ai_courses';
const ENROLLMENTS_COLLECTION = 'course_enrollments';

// Guardar 20 cursos generados en Firestore
export async function saveCourses(courses: CourseData[]): Promise<string[]> {
  const courseIds: string[] = [];
  
  for (const course of courses) {
    try {
      const docRef = await addDoc(collection(db, COURSES_COLLECTION), {
        ...course,
        createdAt: serverTimestamp(),
        isPublished: true
      });
      courseIds.push(docRef.id);
      console.log(`✅ Curso guardado: ${course.title}`);
    } catch (error) {
      console.error(`❌ Error guardando curso ${course.title}:`, error);
    }
  }
  
  return courseIds;
}

// Obtener todos los cursos publicados
export async function fetchAllCourses(): Promise<CourseData[]> {
  try {
    const q = query(collection(db, COURSES_COLLECTION), where('isPublished', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CourseData[];
  } catch (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
}

// Obtener un curso por ID
export async function fetchCourseById(courseId: string): Promise<CourseData | null> {
  try {
    const docRef = doc(db, COURSES_COLLECTION, courseId);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return {
      id: snapshot.id,
      ...snapshot.data()
    } as CourseData;
  } catch (error) {
    console.error('Error fetching course:', error);
    return null;
  }
}

// Enroll en un curso
export async function enrollCourse(userId: string, courseId: string): Promise<boolean> {
  try {
    const enrollmentRef = await addDoc(collection(db, ENROLLMENTS_COLLECTION), {
      userId,
      courseId,
      enrolledAt: serverTimestamp(),
      progress: 0,
      fullContent: null,
      completed: false
    });
    
    console.log(`✅ Usuario enrollado en curso: ${enrollmentRef.id}`);
    return true;
  } catch (error) {
    console.error('Error enrolling in course:', error);
    return false;
  }
}

// Obtener cursos del usuario
export async function fetchUserCourses(userId: string): Promise<EnrolledCourse[]> {
  try {
    const q = query(collection(db, ENROLLMENTS_COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const enrollments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const courses: EnrolledCourse[] = [];
    
    for (const enrollment of enrollments) {
      const courseData = await fetchCourseById(enrollment.courseId);
      if (courseData) {
        courses.push({
          ...courseData,
          enrolledAt: enrollment.enrolledAt,
          progress: enrollment.progress || 0,
          fullContent: enrollment.fullContent
        });
      }
    }
    
    return courses;
  } catch (error) {
    console.error('Error fetching user courses:', error);
    return [];
  }
}

// Actualizar contenido completo del curso (al comprar)
export async function updateCourseFullContent(
  userId: string,
  courseId: string,
  fullContent: any
): Promise<boolean> {
  try {
    const q = query(
      collection(db, ENROLLMENTS_COLLECTION),
      where('userId', '==', userId),
      where('courseId', '==', courseId)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.error('Enrollment not found');
      return false;
    }
    
    const enrollmentDoc = snapshot.docs[0];
    await updateDoc(enrollmentDoc.ref, {
      fullContent,
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ Contenido completo actualizado`);
    return true;
  } catch (error) {
    console.error('Error updating course content:', error);
    return false;
  }
}

// Actualizar progreso del curso
export async function updateCourseProgress(
  userId: string,
  courseId: string,
  progress: number
): Promise<boolean> {
  try {
    const q = query(
      collection(db, ENROLLMENTS_COLLECTION),
      where('userId', '==', userId),
      where('courseId', '==', courseId)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return false;
    }
    
    const enrollmentDoc = snapshot.docs[0];
    await updateDoc(enrollmentDoc.ref, {
      progress: Math.min(progress, 100),
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error updating progress:', error);
    return false;
  }
}

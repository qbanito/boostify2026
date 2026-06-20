import { db } from "@db";
import { logger } from "../logger";
import { bookings, audioDemos } from "@db/schema";
import { auth } from "../firebase";

export async function createBooking(bookingData: {
  musicianId: string;
  tempo: string;
  key: string;
  style: string;
  additionalNotes?: string;
  projectDeadline: string;
  audioUrl?: string;
}) {
  if (!auth.currentUser) {
    throw new Error("Must be logged in to create a booking");
  }

  try {
    // First, create the audio demo record if we have an audio URL
    let audioDemoId = null;
    if (bookingData.audioUrl) {
      const [audioDemo] = await db
        .insert(audioDemos)
        .values({
          userId: parseInt(auth.currentUser.uid),
          musicianId: bookingData.musicianId,
          prompt: `${bookingData.style} music at ${bookingData.tempo} BPM in ${bookingData.key}`,
          audioUrl: bookingData.audioUrl,
          status: 'completed',
          duration: 30, // Default duration from our generation
        })
        .returning();

      audioDemoId = audioDemo.id;
    }

    // Then create the booking with a reference to the audio demo
    const [booking] = await db
      .insert(bookings)
      .values({
        userId: parseInt(auth.currentUser.uid),
        musicianId: bookingData.musicianId,
        tempo: bookingData.tempo,
        key: bookingData.key,
        style: bookingData.style,
        additionalNotes: bookingData.additionalNotes,
        projectDeadline: new Date(bookingData.projectDeadline),
        audioDemoId,
      })
      .returning();

    return booking;
  } catch (error) {
    logger.error("Error creating booking:", error);
    throw error;
  }
}

/** Studio-only exemption; never infer this from the artist profile or client input. */
export function isArtistStudioCreditExempt(email: unknown): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === 'convoycubano@gmail.com';
}

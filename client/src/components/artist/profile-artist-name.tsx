import { motion, useReducedMotion } from 'framer-motion';

/** Word reveal adapted from Vengeance UI Stagger Text (MIT); see VENGEANCE-UI-LICENSE.txt. */
export function ProfileArtistName({ name }: { name: string }) {
  const reduced = useReducedMotion();
  const parts = name.split(/(\s+)/).filter(Boolean);
  return <><span className="sr-only">{name}</span><span aria-hidden="true" className="profile-name-reveal">{parts.map((word, index) => /^\s+$/.test(word) ? <span key={index} className="profile-name-space"> </span> : <span key={index} className="profile-name-word"><motion.span initial={reduced ? false : { y: '105%' }} animate={{ y: 0 }} transition={{ duration: reduced ? 0 : .55, delay: reduced ? 0 : index * .035, ease: [0.22, 1, 0.36, 1] }}>{word}</motion.span></span>)}</span></>;
}

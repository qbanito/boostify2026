import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

export function ProfileStageArt({ image }: { image: string }) {
  const reducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 65]);
  return <motion.div className="profile-stage-art" aria-hidden="true" style={reducedMotion ? undefined : { y }}>
    <img src={image} alt="" loading="eager" onError={event => { event.currentTarget.parentElement?.setAttribute('hidden', ''); }} />
  </motion.div>;
}

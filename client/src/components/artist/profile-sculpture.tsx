import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

class VisualBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Sculpture({ reduced, color }: { reduced: boolean; color: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current || reduced) return;
    group.current.rotation.y += Math.min(delta, .05) * .14;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * .3) * .18;
  });
  return <group ref={group} rotation={[.35,.2,.18]}>
    <mesh><icosahedronGeometry args={[1.05, 1]} /><meshBasicMaterial color={color} wireframe transparent opacity={.34} /></mesh>
    {[0,1,2].map(i => <mesh key={i} rotation={[i * 1.05, .45 + i * .6, i * .35]}><torusGeometry args={[1.55 + i * .18,.012,8,96]} /><meshBasicMaterial color={color} transparent opacity={.55 - i * .1} /></mesh>)}
    <ambientLight intensity={1.2} /><pointLight position={[2, 3, 4]} intensity={22} color={color} />
    <mesh><sphereGeometry args={[.83,32,32]} /><meshPhysicalMaterial color={color} roughness={.17} metalness={.55} transparent opacity={.28} depthWrite={false} /></mesh>
    <mesh><sphereGeometry args={[.58,20,20]} /><meshBasicMaterial color={color} transparent opacity={.13} /></mesh>
  </group>;
}

/** Decorative, non-interactive visual: profile actions and content remain outside WebGL. */
export default function ProfileSculpture({ color }: {color: string}) {
  const reduced = Boolean(useReducedMotion());
  return <div className="profile-sculpture" aria-hidden="true"><VisualBoundary><Suspense fallback={null}><Canvas camera={{position:[0,0,5.5],fov:42}} dpr={[1,1.3]} gl={{alpha:true,antialias:false,powerPreference:'low-power'}} frameloop={reduced ? 'demand' : 'always'} fallback={null}><Sculpture reduced={reduced} color={color}/></Canvas></Suspense></VisualBoundary></div>;
}

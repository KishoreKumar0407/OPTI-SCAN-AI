import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

const EyeModel = ({ blur }: { blur: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.2;
    }
  });

  return (
    <group>
      <Sphere args={[1, 64, 64]} ref={meshRef}>
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </Sphere>
      <Sphere args={[0.4, 32, 32]} position={[0, 0, 0.8]}>
        <meshStandardMaterial color="#000000" />
      </Sphere>
      {/* Lens Simulation */}
      <mesh position={[0, 0, 1.2]}>
        <planeGeometry args={[2, 2]} />
        <meshPhysicalMaterial 
          transparent 
          opacity={0.3} 
          transmission={1} 
          thickness={0.5} 
          roughness={blur} 
          color="#e0f2fe"
        />
      </mesh>
    </group>
  );
};

export const RefractorSim = () => {
  const [blur, setBlur] = useState(0.5);

  return (
    <div className="w-full h-[400px] bg-slate-900 rounded-3xl overflow-hidden relative">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <EyeModel blur={blur} />
        <OrbitControls enableZoom={false} />
      </Canvas>
      
      <div className="absolute bottom-8 left-8 right-8 space-y-4">
        <div className="flex justify-between text-white text-xs font-bold uppercase tracking-widest">
          <span>Lens Focus</span>
          <span>{Math.round((1 - blur) * 100)}% Sharpness</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={blur}
          onChange={(e) => setBlur(parseFloat(e.target.value))}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <p className="text-white/60 text-[10px] text-center italic">
          Adjust the slider until the eye appears perfectly sharp. This simulates an autorefractor measurement.
        </p>
      </div>
    </div>
  );
};

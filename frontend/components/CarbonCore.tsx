"use client";
import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useRouter } from "next/navigation";

type NodeDef = { key: string; label: string; href: string; angle: number; color: string };

const NODES: NodeDef[] = [
  { key: "evidence", label: "Evidence", href: "/marketplace", angle: 0, color: "#4CE0A0" },
  { key: "dna", label: "Carbon DNA", href: "/marketplace", angle: (Math.PI * 2) / 8, color: "#4CE0A0" },
  { key: "audit", label: "AI Audit", href: "/marketplace", angle: (Math.PI * 4) / 8, color: "#FF6B6B" },
  { key: "risk", label: "Risk", href: "/marketplace", angle: (Math.PI * 6) / 8, color: "#F2C14E" },
  { key: "stress", label: "Stress", href: "/marketplace", angle: (Math.PI * 8) / 8, color: "#F2C14E" },
  { key: "revalidation", label: "Revalidation", href: "/marketplace", angle: (Math.PI * 10) / 8, color: "#4CE0A0" },
  { key: "integrity", label: "Integrity", href: "/admin", angle: (Math.PI * 12) / 8, color: "#FF6B6B" },
  { key: "market", label: "Market", href: "/marketplace", angle: (Math.PI * 14) / 8, color: "#2DD4BF" },
];

const RADIUS = 2.6;

function OrbitNode({ node }: { node: NodeDef }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Group>(null!);

  const pos = useMemo(() => {
    const x = Math.cos(node.angle) * RADIUS;
    const z = Math.sin(node.angle) * RADIUS;
    const y = Math.sin(node.angle * 1.7) * 0.5;
    return new THREE.Vector3(x, y, z);
  }, [node.angle]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = hovered ? 1.6 : 1;
      ref.current.scale.setScalar(s + Math.sin(clock.elapsedTime * 2 + node.angle) * 0.05);
    }
  });

  return (
    <group ref={ref} position={pos}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => router.push(node.href)}
      >
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={hovered ? 1.4 : 0.6} />
      </mesh>
      {hovered && (
        <Html center distanceFactor={8}>
          <div className="px-2 py-1 rounded-md bg-surface2 border border-border text-[11px] font-mono text-text whitespace-nowrap pointer-events-none">
            {node.label}
          </div>
        </Html>
      )}
      <Line points={[[0, 0, 0], pos.clone().negate()]} color={node.color} transparent opacity={0.18} lineWidth={1} />
    </group>
  );
}

function Core() {
  const group = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.15;
  });

  const points = useMemo(
    () => NODES.map((n) => [Math.cos(n.angle) * RADIUS, Math.sin(n.angle * 1.7) * 0.5, Math.sin(n.angle) * RADIUS] as [number, number, number]),
    []
  );

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.15, 2]} />
        <meshStandardMaterial color="#0E1714" emissive="#4CE0A0" emissiveIntensity={0.25} roughness={0.35} metalness={0.4} wireframe />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshStandardMaterial color="#122019" emissive="#4CE0A0" emissiveIntensity={0.12} roughness={0.6} />
      </mesh>
      {NODES.map((n) => (
        <OrbitNode key={n.key} node={n} />
      ))}
      {points.map((p, i) => {
        const next = points[(i + 1) % points.length];
        return <Line key={i} points={[p, next]} color="#1C2A24" transparent opacity={0.35} lineWidth={1} />;
      })}
    </group>
  );
}

export default function CarbonCore() {
  return (
    <div className="w-full h-[420px] md:h-[480px]">
      <Canvas camera={{ position: [0, 0.6, 5.2], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 4, 4]} intensity={40} color="#4CE0A0" />
        <pointLight position={[-4, -2, -4]} intensity={20} color="#2DD4BF" />
        <Core />
      </Canvas>
    </div>
  );
}

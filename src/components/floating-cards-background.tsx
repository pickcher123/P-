'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, limit } from 'firebase/firestore';

const FALLBACK_IMAGES = [
  'https://picsum.photos/seed/card1/300/450',
  'https://picsum.photos/seed/card2/300/400',
  'https://picsum.photos/seed/card3/250/350',
  'https://picsum.photos/seed/card4/320/480',
  'https://picsum.photos/seed/card5/350/500',
  'https://picsum.photos/seed/card6/280/420',
];

interface CardData {
    id: string;
    imageUrl: string;
}

export function FloatingCardsBackground() {
  const firestore = useFirestore();
  const cardsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'allCards'), limit(50));
  }, [firestore]);

  const { data: dbCards } = useCollection<CardData>(cardsQuery);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set((clientX / innerWidth) - 0.5);
      mouseY.set((clientY / innerHeight) - 0.5);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Create random positions and types for cards
  const cards = useMemo(() => {
    const images = (dbCards && dbCards.length > 0) 
      ? dbCards.map(c => c.imageUrl) 
      : FALLBACK_IMAGES;

    const count = 10;
    
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      image: images[i % images.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotate: Math.random() * 80 - 40,
      scale: 0.3 + Math.random() * 0.7,
      delay: Math.random() * 5,
      duration: 15 + Math.random() * 12,
      floatRange: 40 + Math.random() * 60,
      depth: 0.8 + Math.random() * 2.5,
      opacity: 0.15 + Math.random() * 0.15, // Slightly higher opacity for better visibility
    }));
  }, [dbCards]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none" style={{ perspective: '1200px' }}>
      {/* Background Gradients for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background/60 to-background z-[1]" />
      
      {/* Floating Cards Container */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {cards.map((card) => (
          <FloatingCard 
            key={card.id} 
            card={card} 
            springX={springX} 
            springY={springY} 
          />
        ))}
      </div>

      {/* Decorative large circles for depth */}
      <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
      <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] mix-blend-screen animate-blob" />

      {/* Subtle overlay to keep UI readable */}
      <div className="absolute inset-0 bg-background/20 backdrop-blur-[1.5px] z-[2]" />
    </div>
  );
}

function FloatingCard({ card, springX, springY }: { card: any, springX: any, springY: any }) {
  // Parallax movement based on mouse and card depth
  const moveX = useTransform(springX, (v: number) => v * 220 * card.depth); // Increased parallax
  const moveY = useTransform(springY, (v: number) => v * 220 * card.depth);

  return (
    <motion.div
      className="absolute rounded-xl overflow-hidden border border-white/30 shadow-2xl" // Brighter border
      style={{
        left: `${card.x}%`,
        top: `${card.y}%`,
        width: `${190 * card.scale}px`, // Slightly larger
        aspectRatio: '2/3',
        opacity: card.opacity,
        x: moveX,
        y: moveY,
      }}
      initial={{ opacity: 0, scale: 0.1, rotateX: card.rotate, rotateY: card.rotate / 2 }}
      animate={{
        opacity: [card.opacity, card.opacity * 1.6, card.opacity],
        scale: card.scale,
        rotateZ: [card.rotate - 12, card.rotate + 12, card.rotate - 12],
        rotateX: [card.rotate / 2, -card.rotate / 2, card.rotate / 2],
        translateY: [-card.floatRange, card.floatRange, -card.floatRange],
      }}
      transition={{
        opacity: { duration: 6, repeat: Infinity, ease: "linear" },
        scale: { duration: card.duration, repeat: Infinity, ease: "easeInOut" },
        rotateZ: { duration: card.duration, repeat: Infinity, ease: "linear" },
        rotateX: { duration: card.duration * 1.2, repeat: Infinity, ease: "easeInOut" },
        translateY: { duration: card.duration, repeat: Infinity, ease: "easeInOut", delay: card.delay },
      }}
    >
      <Image
        src={card.image}
        alt=""
        fill
        className="object-cover h-full w-full brightness-110 contrast-110 saturate-[1.1]" // Enhanced visual
        sizes="200px"
        referrerPolicy="no-referrer"
      />
      {/* Holographic reflection effect */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent" // Stronger reflection
        animate={{
          x: ['-200%', '200%'],
          y: ['-200%', '200%'],
        }}
        transition={{
          duration: card.duration / 3,
          repeat: Infinity,
          ease: "linear",
          delay: card.delay,
        }}
      />
    </motion.div>
  );
}

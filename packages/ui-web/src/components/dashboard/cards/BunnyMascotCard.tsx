import { useState, useEffect, useCallback, useRef } from 'react';
import {
  animations,
  autoPlayNames,
  clickPlayNames,
  getAllKeyframes,
  type AnimationName,
  type AnimationContext,
  type Particle,
} from './bunny-animations';

const BUBBLES = [
  'Hello! I\'m OpenBunny~',
  'Need help? Just ask!',
  'Let\'s build something cool!',
  'Hop hop hop...',
  '*munches carrot* 🥕',
  'Debugging in progress...',
  'AI-powered bunny at your service!',
  'Have a great day!',
  'Zzz... just resting my eyes...',
  '*nom nom nom* 🥕🥕',
  'Dance party! 🎶',
  'Carrots are the best fuel!',
];

const AUTO_INTERVAL = 6000;
const allKeyframes = getAllKeyframes();

export default function BunnyMascotCard() {
  const [anim, setAnim] = useState<AnimationName>('idle');
  const [bubble, setBubble] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [carrotVisible, setCarrotVisible] = useState(false);
  const [carrotBite, setCarrotBite] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const autoTimer = useRef<ReturnType<typeof setInterval>>(null);
  const lastBubbleIdx = useRef(-1);
  const particleId = useRef(0);

  const pickBubble = useCallback(() => {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * BUBBLES.length);
    } while (idx === lastBubbleIdx.current && BUBBLES.length > 1);
    lastBubbleIdx.current = idx;
    return BUBBLES[idx];
  }, []);

  const spawnParticles = useCallback((emoji: string, count = 4) => {
    const newParticles = Array.from({ length: count }, () => ({
      id: particleId.current++,
      x: (Math.random() - 0.5) * 80,
      y: -(Math.random() * 60 + 20),
      emoji,
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)));
    }, 1200);
  }, []);

  const playAnim = useCallback((type: AnimationName) => {
    const def = animations[type];
    setAnim(type);
    if (def.onStart) {
      def.onStart({ spawnParticles, setCarrotVisible, setCarrotBite, setAnim });
      return;
    }
    setTimeout(() => setAnim('idle'), def.duration);
  }, [spawnParticles]);

  const showBubble = useCallback((text?: string) => {
    if (bubbleTimer.current != null) clearTimeout(bubbleTimer.current);
    setBubble(text ?? pickBubble());
    bubbleTimer.current = setTimeout(() => setBubble(null), 3000);
  }, [pickBubble]);

  useEffect(() => {
    autoTimer.current = setInterval(() => {
      const pick = autoPlayNames[Math.floor(Math.random() * autoPlayNames.length)];
      playAnim(pick);
      if (Math.random() < 0.35) showBubble();
    }, AUTO_INTERVAL);
    return () => { if (autoTimer.current != null) clearInterval(autoTimer.current); };
  }, [playAnim, showBubble]);

  const handleClick = () => {
    const pick = clickPlayNames[Math.floor(Math.random() * clickPlayNames.length)];
    playAnim(pick);
    showBubble();
  };

  const current = animations[anim];
  const ctx: AnimationContext = { anim, isHovered, particles, carrotVisible, carrotBite };

  return (
    <>
      <style>{allKeyframes}</style>

      <div
        className="relative flex flex-col items-center justify-center h-full select-none cursor-pointer overflow-hidden"
        onClick={handleClick}
        onMouseEnter={() => { setIsHovered(true); playAnim('shake'); }}
        onMouseLeave={() => setIsHovered(false)}
        style={isHovered ? { animation: 'rainbow-border 3s linear infinite', borderWidth: 2, borderStyle: 'solid', borderRadius: 16 } : undefined}
      >
        {/* Ambient glow */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 120, height: 120, top: '50%', left: '50%',
            background: anim === 'glow'
              ? 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)'
              : anim === 'dance'
              ? 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, rgba(249,115,22,0.1) 40%, transparent 70%)'
              : 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 60%)',
            animation: 'halo-pulse 3s ease-in-out infinite',
            transition: 'background 0.5s ease',
          }}
        />

        {/* Hover sparkles */}
        {isHovered && (
          <>
            <span className="absolute text-xs" style={{ top: '12%', left: '20%', animation: 'sparkle 1s ease-in-out infinite' }}>✨</span>
            <span className="absolute text-xs" style={{ top: '8%', right: '22%', animation: 'sparkle 1s ease-in-out 0.3s infinite' }}>⭐</span>
            <span className="absolute text-xs" style={{ bottom: '20%', left: '16%', animation: 'sparkle 1s ease-in-out 0.6s infinite' }}>💫</span>
            <span className="absolute text-xs" style={{ bottom: '16%', right: '18%', animation: 'sparkle 1s ease-in-out 0.9s infinite' }}>✨</span>
          </>
        )}

        {/* Animation-specific overlays (sleep Zzz, eat carrot, etc.) */}
        {Object.values(animations).map(a => a.overlay?.(ctx))}

        {/* Flying particles */}
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute text-sm pointer-events-none"
            style={{
              top: '40%', left: '50%',
              '--px': `${p.x}px`, '--py': `${p.y}px`,
              animation: 'particle-fly 1.2s ease-out forwards',
            } as React.CSSProperties}
          >
            {p.emoji}
          </span>
        ))}

        {/* Bunny */}
        <div
          className={`text-9xl transition-transform duration-200 ${current.animClass}`}
          style={{
            animation: anim === 'idle' ? 'float 3s ease-in-out infinite' : undefined,
            perspective: anim === 'spin' ? 400 : undefined,
          }}
        >
          {current.emoji ?? '🐰'}
        </div>

        {/* Shadow */}
        <div
          className="mt-2 rounded-full bg-foreground/10 transition-all duration-300"
          style={{
            width: current.shadowWidth ?? 36,
            height: 6,
            opacity: current.shadowOpacity ?? 0.7,
          }}
        />

        {/* Chat bubble */}
        {bubble && (
          <div
            className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium whitespace-nowrap shadow-lg"
            style={{ animation: 'bubble-in 0.25s ease-out' }}
          >
            {bubble}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
          </div>
        )}
      </div>
    </>
  );
}

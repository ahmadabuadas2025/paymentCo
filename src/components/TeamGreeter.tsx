// Team greeter: each time the main tab changes, the next Group 1 member pops up in the
// bottom-right corner for 5 seconds and says hi.
//
// Images live in public/team/ and are git-ignored (stock / clip-art). If an image is missing,
// the member's initials are shown instead, so a fresh clone still works.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const TEAM = [
  { name: 'Ahmad', file: 'ahmad.png' },
  { name: 'Nicholas', file: 'nicholas.png' },
  { name: 'Bolotbek', file: 'bolotbek.png' },
  { name: 'Huei-En', file: 'huei-en.png' },
];

const SHOW_MS = 5000;

export default function TeamGreeter({ trigger }: { trigger: string }) {
  const [shown, setShown] = useState<{ member: number; key: number } | null>(null);
  const next = useRef(0);
  const first = useRef(true);

  // Rotate through the team on every tab change (not on the first page load).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const member = next.current;
    next.current = (next.current + 1) % TEAM.length;
    setShown({ member, key: Date.now() });
    const timer = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40" aria-live="polite">
      <AnimatePresence>
        {shown && <Greeting key={shown.key} {...TEAM[shown.member]} onClose={() => setShown(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Greeting({ name, file, onClose }: { name: string; file: string; onClose: () => void }) {
  const [missing, setMissing] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClose}
      aria-label={`Hi, I am ${name}. Click to dismiss.`}
      className="pointer-events-auto flex items-end gap-2 text-left"
      initial={{ opacity: 0, x: 80, y: 20, scale: 0.85 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {/* speech bubble */}
      <motion.div
        className="relative mb-16 rounded-2xl border-2 border-gold bg-night-card px-4 py-2 font-serif text-lg font-bold text-[#E8ECE9] shadow-xl"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        Hi, I am {name}
        <span className="absolute -right-2 bottom-3 h-3 w-3 rotate-45 border-r-2 border-t-2 border-gold bg-night-card" aria-hidden="true" />
      </motion.div>

      {/* character on a light card, since the artwork has a white background */}
      <motion.div
        className="h-36 w-36 overflow-hidden rounded-2xl border-2 border-gold bg-white shadow-2xl"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {missing ? (
          <div className="flex h-full w-full items-center justify-center bg-brand font-serif text-4xl font-bold text-gold">
            {name.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <img
            src={`${import.meta.env.BASE_URL}team/${file}`}
            alt={`${name}'s character`}
            className="h-full w-full object-contain p-1"
            onError={() => setMissing(true)}
          />
        )}
      </motion.div>
    </motion.button>
  );
}

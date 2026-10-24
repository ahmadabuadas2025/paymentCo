// Team greeter: when a main tab opens, that tab's Group 1 member appears in the bottom-right
// corner for 5 seconds and says hi.
//
// Images live in src/assets/team/ (transparent PNGs) and are git-ignored because they are
// stock / clip-art. import.meta.glob only picks up files that exist, so a fresh clone without
// the images still builds; the greeting then shows the message alone.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const images = import.meta.glob<string>('../assets/team/*.png', { eager: true, import: 'default' });
const imageFor = (file: string) => images[`../assets/team/${file}`];

const AHMAD = { name: 'Ahmad', file: 'ahmad.png' };
const BOLOTBEK = { name: 'Bolotbek', file: 'bolotbek.png' };
const HUEI_EN = { name: 'Huei-En', file: 'huei-en.png' };
const NICHOLAS = { name: 'Nicholas', file: 'nicholas.png' };

/** Who greets on each tab (tabs numbered 1-8 as in the nav). */
const BY_TAB = [AHMAD, BOLOTBEK, HUEI_EN, NICHOLAS, BOLOTBEK, AHMAD, NICHOLAS, HUEI_EN];

const SHOW_MS = 5000;

/** `tab` is the 0-based index of the active main tab. */
export default function TeamGreeter({ tab }: { tab: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [tab]);

  const member = BY_TAB[tab % BY_TAB.length];

  return (
    <div className="pointer-events-none fixed bottom-2 right-4 z-40" aria-live="polite">
      <AnimatePresence mode="wait">
        {visible && <Greeting key={tab} {...member} onClose={() => setVisible(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Greeting({ name, file, onClose }: { name: string; file: string; onClose: () => void }) {
  const src = imageFor(file);
  return (
    <motion.button
      type="button"
      onClick={onClose}
      aria-label={`Hi, I am ${name}. Click to dismiss.`}
      className="pointer-events-auto flex items-end gap-1 text-left"
      initial={{ opacity: 0, x: 80, y: 20, scale: 0.85 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {/* speech bubble */}
      <motion.div
        className={`relative rounded-2xl border-2 border-gold bg-night-card px-4 py-2 font-serif text-lg font-bold text-[#E8ECE9] shadow-xl ${src ? 'mb-28' : 'mb-2'}`}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        Hi, I am {name}
        {src && <span className="absolute -right-2 bottom-3 h-3 w-3 rotate-45 border-r-2 border-t-2 border-gold bg-night-card" aria-hidden="true" />}
      </motion.div>

      {/* just the character: transparent artwork, no card behind it */}
      {src && (
        <motion.img
          src={src}
          alt=""
          className="h-48 w-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.button>
  );
}

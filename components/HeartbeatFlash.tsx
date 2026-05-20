"use client";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  /**
   * Timestamp del battito corrente. Cambia ad ogni beat → fa partire un nuovo flash.
   * null = nessun flash.
   */
  trigger: number | null;
}

/**
 * Flash rosso full-screen sincronizzato col battito cardiaco.
 * Ad ogni `trigger` lo schermo "esplode" di rosso per ~150ms (frazione di secondo),
 * dando la sensazione di una bomba che sta per detonare.
 *
 * Usato solo negli ultimi 10s del gioco e in tutto l'overtime — vedi GameClient.
 */
export default function HeartbeatFlash({ trigger }: Props) {
  return (
    <AnimatePresence>
      {trigger !== null && (
        <motion.div
          key={trigger}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0] }}
          transition={{
            duration: 0.15,
            ease: "easeOut",
            times: [0, 0.3, 1],
          }}
          className="pointer-events-none fixed inset-0 z-[60] bg-crack"
        />
      )}
    </AnimatePresence>
  );
}

import { motion } from "framer-motion";
import Logo from "./Logo";
import { APP } from "../../config/appConfig";

const BARS = [0, 1, 2, 3, 4, 5, 6];

/** Branded splash shown briefly on initial app load. Theme/accent aware. */
export default function LoadingScreen() {
  return (
    <motion.div
      className="loading-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="loading-inner"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="loading-logo"><Logo size={42} /></div>
        <div className="loading-bars">
          {BARS.map((i) => (
            <span key={i} className="loading-bar" style={{ animationDelay: `${i * 0.11}s` }} />
          ))}
        </div>
        <div className="loading-brand">{APP.name}</div>
      </motion.div>
    </motion.div>
  );
}

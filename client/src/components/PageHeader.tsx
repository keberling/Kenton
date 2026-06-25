import { motion } from "framer-motion";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="window flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <p className="hud-label t-accent">{eyebrow}</p>
        <h2 className="font-display mt-1 text-3xl font-bold tracking-tight t-fg sm:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed t-muted">{description}</p>
        )}
      </div>
      {action}
    </motion.header>
  );
}
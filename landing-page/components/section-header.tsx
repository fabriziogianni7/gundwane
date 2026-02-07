type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="text-center mb-16">
      <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xl text-slate-600 dark:text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}

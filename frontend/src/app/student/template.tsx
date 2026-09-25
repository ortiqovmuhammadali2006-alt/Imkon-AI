// Har bir sahifa ochilganda yumshoq paydo bo'lish (layout va ovozli boshqaruv qayta yaratilmaydi)
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-slide-up">{children}</div>;
}

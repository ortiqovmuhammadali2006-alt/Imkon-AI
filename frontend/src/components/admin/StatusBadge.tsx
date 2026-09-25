export default function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="badge bg-emerald-100 text-emerald-700">Faol</span>
  ) : (
    <span className="badge bg-red-100 text-red-700">Bloklangan</span>
  );
}

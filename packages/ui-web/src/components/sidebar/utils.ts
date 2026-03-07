export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const sameYear = date.getFullYear() === now.getFullYear();

  const dateStr = date.toLocaleDateString(undefined, {
    year: sameYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return `${dateStr} ${time}`;
}

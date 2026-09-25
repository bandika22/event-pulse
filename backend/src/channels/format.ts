import type { Notification } from './types.js';

export function plainTextLines(n: Notification): string[] {
  return [
    n.title,
    `${n.severity} · ${n.category}${n.synthetic ? ' (synthetic demo data)' : ''}`,
    `Occurred: ${n.occurredAt}`,
    `Why: ${n.reason}`,
    `Alert: ${n.alertName}`,
    ...(n.url ? [`Source: ${n.url}`] : []),
  ];
}

import { DEMO_USER_ID, getStore } from "./store.ts";

export const xpEarningPolicy = {
  dailyEarnableXpLimit: 50,
  timezone: "Africa/Lagos",
  capBehavior: "block_quiz_until_reset",
} as const;

export function getUserDateParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: xpEarningPolicy.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    dateKey: `${year}-${month}-${day}`,
  };
}

export function getUserDateKey(now = new Date()) {
  return getUserDateParts(now).dateKey;
}

export function getUserWeekKey(now = new Date()) {
  const { year, month, day } = getUserDateParts(now);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() - dayOfWeek + 1);

  return localDate.toISOString().slice(0, 10);
}

export function getNextWeeklyResetAt(now = new Date()) {
  const weekStart = new Date(`${getUserWeekKey(now)}T00:00:00+01:00`);
  return new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function getStartOfUserDay(now = new Date()) {
  const { dateKey } = getUserDateParts(now);

  return new Date(`${dateKey}T00:00:00+01:00`);
}

export function getNextDailyResetAt(now = new Date()) {
  const start = getStartOfUserDay(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export function formatDailyResetAt(resetAtIso: string) {
  const resetAt = new Date(resetAtIso);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: xpEarningPolicy.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZoneName: "short",
  }).format(resetAt);
}

export function buildDailyCapBlockedMessage(resetAtIso: string) {
  return `You have reached today's quiz XP limit. Quiz XP unlocks at ${formatDailyResetAt(resetAtIso)}.`;
}

export function buildDailyCapSavedMessage(resetAtIso: string) {
  return `You have reached today's quiz XP limit. Your progress is saved. You can answer the remaining questions after ${formatDailyResetAt(resetAtIso)}.`;
}

export function getDailyEarnedXp(userId = DEMO_USER_ID, now = new Date()) {
  const store = getStore();
  const start = getStartOfUserDay(now);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return store.xpTransactions.reduce((total, transaction) => {
    const createdAt = new Date(transaction.createdAt);
    const countsForToday =
      transaction.userId === userId &&
      transaction.direction === "earn" &&
      transaction.sourceType === "quiz_question" &&
      transaction.createdAt &&
      createdAt >= start &&
      createdAt < end;

    return countsForToday ? total + transaction.amount : total;
  }, 0);
}

export function getDailyXpRemaining(userId = DEMO_USER_ID, now = new Date()) {
  return Math.max(0, xpEarningPolicy.dailyEarnableXpLimit - getDailyEarnedXp(userId, now));
}

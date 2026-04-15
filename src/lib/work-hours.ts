import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

interface WorkHoursUser {
  workHoursStart?: string | null;
  workHoursEnd?: string | null;
  name: string;
}

export function getWorkHoursWarning(user: WorkHoursUser): string | null {
  if (!user.workHoursStart || !user.workHoursEnd) return null;

  const now = dayjs();
  const [startH, startM] = user.workHoursStart.split(":").map(Number);
  const [endH, endM] = user.workHoursEnd.split(":").map(Number);

  const start = now.startOf("day").hour(startH).minute(startM);
  const end = now.startOf("day").hour(endH).minute(endM);

  let isInWorkHours: boolean;
  if (start.isBefore(end)) {
    isInWorkHours = now.isAfter(start) && now.isBefore(end);
  } else {
    isInWorkHours = now.isAfter(start) || now.isBefore(end);
  }

  if (!isInWorkHours) {
    return `⏰ It's outside ${user.name}'s work hours (${user.workHoursStart} – ${user.workHoursEnd})`;
  }
  return null;
}

export function getAttendanceStatus(
  checkInTime: Date,
  workHoursStart: string,
  lateThresholdMin: number,
  veryLateThresholdMin: number
): "PRESENT" | "LATE" | "VERY_LATE" {
  const [h, m] = workHoursStart.split(":").map(Number);
  const expectedStart = dayjs(checkInTime).startOf("day").hour(h).minute(m);
  const actualCheckIn = dayjs(checkInTime);
  const minutesLate = actualCheckIn.diff(expectedStart, "minute");
  
  if (minutesLate >= veryLateThresholdMin) return "VERY_LATE";
  if (minutesLate >= lateThresholdMin) return "LATE";
  return "PRESENT";
}

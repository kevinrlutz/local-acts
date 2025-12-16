export const parseEventDate = (dateInput: string, timeInput?: string) => {
  const normalizedDate = dateInput.trim();
  const [yearStr, monthStr, dayStr] = normalizedDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    throw new Error("Enter a valid event date (YYYY-MM-DD).");
  }

  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    throw new Error("Enter a valid day for the selected month.");
  }

  let hours = 12;
  let minutes = 0;
  let hasTime = false;

  const normalizedTime = timeInput?.trim();
  if (normalizedTime) {
    const match = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      throw new Error("Enter a valid time in HH:MM format.");
    }
    hours = Number(match[1]);
    minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      throw new Error("Enter a valid time in HH:MM format.");
    }
    hasTime = true;
  }

  const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(eventDate.getTime())) {
    throw new Error("Enter a valid event date.");
  }

  return { eventDate, hasTime } as const;
};

export const validateTicketUrl = (ticketUrl?: string) => {
  const trimmed = ticketUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Enter a valid ticket URL (http/https).");
    }
    return trimmed;
  } catch (err) {
    throw new Error("Enter a valid ticket URL (http/https).");
  }
};

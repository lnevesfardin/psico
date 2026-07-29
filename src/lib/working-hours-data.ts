export type WorkingHours = {
  days: number[]; // 0=Domingo ... 6=Sábado
  startTime: string; // "09:00"
  endTime: string; // "20:00"
};

export const weekdayLabels = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const weekdayShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const defaultWorkingHours: WorkingHours = {
  days: [1, 2, 3, 4, 5, 6],
  startTime: "09:00",
  endTime: "20:00",
};

export function generateTimeSlots(startTime: string, endTime: string): string[] {
  const startHour = Number(startTime.split(":")[0]);
  const endHour = Number(endTime.split(":")[0]);
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

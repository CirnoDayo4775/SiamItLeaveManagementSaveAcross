
// ใช้ i18n keys แทน hardcoded text
export const leaveTypes = [
  { value: "sick", labelKey: "leaveTypes.Sick", requiresAttachment: true },
  { value: "vacation", labelKey: "leaveTypes.Vacation", requiresAttachment: false },
  { value: "personal", labelKey: "leaveTypes.Personal", requiresAttachment: false, hasTimeOption: true },
  { value: "maternity", labelKey: "leaveTypes.Maternity", requiresAttachment: true },
  { value: "emergency", labelKey: "leaveTypes.Emergency", requiresAttachment: true },
];

export const employeeTypes = [
  { value: "intern", labelKey: "employeeTypes.intern" },
  { value: "employee", labelKey: "employeeTypes.employee" },
];

export const personalLeaveOptions = [
  { value: "day", labelKey: "leave.dayLeave" },
  { value: "hour", labelKey: "leave.hourLeave" },
];

export const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

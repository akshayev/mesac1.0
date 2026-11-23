import type { CusatGradeInfo } from "@/types";

/**
 * CUSAT B.Tech grade points used by the GPA calculator (src/components/GpaCalculator.tsx).
 * Unverified against the current university ordinance; the team should confirm before launch.
 */
export const CUSAT_GRADE_SCALE: CusatGradeInfo[] = [
  { letter: "S", points: 10, percentageRange: "90% – 100%", description: "Outstanding" },
  { letter: "A", points: 9, percentageRange: "80% – 89%", description: "Excellent" },
  { letter: "B", points: 8, percentageRange: "70% – 79%", description: "Very Good" },
  { letter: "C", points: 7, percentageRange: "60% – 69%", description: "Good" },
  { letter: "D", points: 6, percentageRange: "50% – 59%", description: "Fair" },
  { letter: "E", points: 5, percentageRange: "45% – 49%", description: "Pass" },
  { letter: "F", points: 0, percentageRange: "< 45%", description: "Failed" },
];

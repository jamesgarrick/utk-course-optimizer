// lib/planCalculator.ts
export function calculateMinimalHours(programA: any, programB: any) {
  // Create a map to merge courses from both programs by course id
  const courseMap: { [key: string]: any } = {};

  [...programA.requiredCourses, ...programB.requiredCourses].forEach(
    (course: any) => {
      if (!courseMap[course.id]) {
        courseMap[course.id] = course;
      }
      // If needed, you can add more logic here for when course variants differ.
    }
  );

  const courses = Object.values(courseMap);
  const totalHours = courses.reduce(
    (sum: number, course: any) => sum + course.hours,
    0
  );

  return { courses, totalHours };
}

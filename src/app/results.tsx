// pages/results.tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import CourseCard from "../components/CourseCard";
import { calculateMinimalHours } from "../lib/planCalculator";

const ResultsPage = () => {
  const router = useRouter();
  const { programA, programB } = router.query;
  const [result, setResult] = useState<{
    courses: any[];
    totalHours: number;
  } | null>(null);

  useEffect(() => {
    if (programA && programB) {
      const pA = JSON.parse(programA as string);
      const pB = JSON.parse(programB as string);
      const plan = calculateMinimalHours(pA, pB);
      setResult(plan);
    }
  }, [programA, programB]);

  if (!result) {
    return <div>Loading results...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Program Merge Result</h1>
      <h2>Total Credit Hours: {result.totalHours}</h2>
      <h3>Required Courses:</h3>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {result.courses.map((course: any) => (
          <li key={course.id}>
            <CourseCard course={course} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ResultsPage;

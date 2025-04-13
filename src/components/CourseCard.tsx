// components/CourseCard.tsx
import React from "react";

interface Course {
  id: string;
  name: string;
  hours: number;
}

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  return (
    <div style={{ border: "1px solid #ccc", margin: "5px", padding: "10px" }}>
      <h3>{course.name}</h3>
      <p>Credit Hours: {course.hours}</p>
    </div>
  );
};

export default CourseCard;

// components/ProgramSelector.tsx
import React from "react";

const programsData = [
  {
    id: "program1",
    name: "Example Major",
    requiredCourses: [
      { id: "ENGL101", name: "ENGL 101 - English Composition I", hours: 3 },
      { id: "MATH101", name: "MATH 101 - Calculus I", hours: 4 },
      {
        id: "CS101",
        name: "CS 101 - Introduction to Computer Science",
        hours: 3,
      },
    ],
  },
  {
    id: "program2",
    name: "Example Minor",
    requiredCourses: [
      { id: "ENGL101", name: "ENGL 101 - English Composition I", hours: 3 },
      { id: "PHYS101", name: "PHYS 101 - Introduction to Physics", hours: 4 },
      {
        id: "CS101",
        name: "CS 101 - Introduction to Computer Science",
        hours: 3,
      },
    ],
  },
  // You can add more sample programs here.
];

interface ProgramSelectorProps {
  onChange: (program: any) => void;
}

const ProgramSelector: React.FC<ProgramSelectorProps> = ({ onChange }) => {
  const handleSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = event.target.value;
    const selectedProgram = programsData.find((p) => p.id === selectedId);
    onChange(selectedProgram);
  };

  return (
    <select onChange={handleSelection} defaultValue="">
      <option value="" disabled>
        Select a Program
      </option>
      {programsData.map((program) => (
        <option key={program.id} value={program.id}>
          {program.name}
        </option>
      ))}
    </select>
  );
};

export default ProgramSelector;

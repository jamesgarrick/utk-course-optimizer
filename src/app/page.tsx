// pages/index.tsx
import { useState } from "react";
import { useRouter } from "next/router";
import ProgramSelector from "../components/ProgramSelector";

const Home = () => {
  const router = useRouter();
  const [programA, setProgramA] = useState<any>(null);
  const [programB, setProgramB] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Pass selected programs as query parameters (JSON stringified for simplicity)
    router.push({
      pathname: "/results",
      query: {
        programA: JSON.stringify(programA),
        programB: JSON.stringify(programB),
      },
    });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>UTK Program Merge Planner</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <h2>Select Program A</h2>
          <ProgramSelector onChange={setProgramA} />
        </div>
        <div style={{ marginTop: "20px" }}>
          <h2>Select Program B</h2>
          <ProgramSelector onChange={setProgramB} />
        </div>
        <button
          style={{ marginTop: "20px" }}
          type="submit"
          disabled={!programA || !programB}
        >
          Calculate Minimal Hours
        </button>
      </form>
    </div>
  );
};

export default Home;

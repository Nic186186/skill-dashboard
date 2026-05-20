import SkillDashboard from "./SkillDashboard";
import { getSkills, getSkillSummary } from "@/lib/skills";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const skills = getSkills();
  const summary = getSkillSummary(skills);

  return (
    <main className="dashboard-shell">
      <SkillDashboard skills={skills} summary={summary} />
    </main>
  );
}

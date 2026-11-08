import type { Assignment } from "./db.js";
import { collections } from "./db.js";
import { ObjectId } from "mongodb";

export type AssignResult =
  | { kind: "assigned"; assignment: Assignment }
  | { kind: "judge-busy" } 
  | { kind: "none-available" }; 


export async function assignNext(
  judgeId: string
): Promise<AssignResult> {

  const { assignments } = collections();

  const activeAssignment = await assignments.findOne({
    judgeId: judgeId,
    status: "QUEUED"
  });

  if (activeAssignment) {
    return { kind: "judge-busy" };
  }

  const { projects } = collections();

  const allProjects = await projects.find().toArray();
  const allAssignments = await assignments.find().toArray();

  const previouslyAssigned = new Set(
    allAssignments
      .filter(a => a.judgeId === judgeId)
      .map(a => a.projectId)
  );

  const currentlyQueued = new Set(
    allAssignments
      .filter(a => a.status === "QUEUED")
      .map(a => a.projectId)
  );

  const availableProjects = allProjects.filter(
    project =>
      !previouslyAssigned.has(project._id) &&
      !currentlyQueued.has(project._id)
  );

  if (availableProjects.length === 0) {
    return { kind: "none-available" };
  }

  const projectCounts = availableProjects.map(project => {
    const count = allAssignments.filter(
      a => a.projectId === project._id &&
          a.status === "COMPLETED"
    ).length;

    return { project, count };
  });

  const minCount = Math.min(
    ...projectCounts.map(p => p.count)
  );

  const candidates = projectCounts.filter(
    p => p.count === minCount
  );

  const selected = candidates[
    Math.floor(Math.random() * candidates.length)
  ].project;

  const newAssignment = {
    _id: new ObjectId(),
    judgeId: judgeId,
    projectId: selected._id,
    status: "QUEUED" as const,
    createdAt: new Date()
  };

  await assignments.insertOne(newAssignment);

  return {
    kind: "assigned",
    assignment: newAssignment
  };

  return { kind: "none-available" };
}

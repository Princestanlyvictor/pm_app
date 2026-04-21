import { useState } from "react";
import type { RoadmapPayload, RoadmapMilestone } from "../../types/projectWorkspace";

interface ProjectRoadmapTabProps {
  roadmap: RoadmapPayload | null;
  loading: boolean;
  canEdit: boolean;
  onRefresh: () => void;
  onAddStage: (name: string, description: string) => Promise<void>;
  onAddMilestone: (payload: { name: string; stage_id?: string; deadline?: string; description?: string }) => Promise<void>;
  onUpdateMilestone: (milestoneId: string, payload: { status?: "planned" | "in_progress" | "completed" }) => Promise<void>;
}

export default function ProjectRoadmapTab({
  roadmap,
  loading,
  canEdit,
  onRefresh,
  onAddStage,
  onAddMilestone,
  onUpdateMilestone,
}: ProjectRoadmapTabProps) {
  const [stageName, setStageName] = useState("");
  const [stageDescription, setStageDescription] = useState("");
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneStageId, setMilestoneStageId] = useState("");
  const [milestoneDeadline, setMilestoneDeadline] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");

  const handleAddStage = async () => {
    if (!stageName.trim()) {
      alert("Stage name is required");
      return;
    }
    await onAddStage(stageName, stageDescription);
    setStageName("");
    setStageDescription("");
  };

  const handleAddMilestone = async () => {
    if (!milestoneName.trim()) {
      alert("Milestone name is required");
      return;
    }
    await onAddMilestone({
      name: milestoneName,
      stage_id: milestoneStageId || undefined,
      deadline: milestoneDeadline || undefined,
      description: milestoneDescription || undefined,
    });
    setMilestoneName("");
    setMilestoneStageId("");
    setMilestoneDeadline("");
    setMilestoneDescription("");
  };

  if (loading) {
    return <div style={{ backgroundColor: "#fff", padding: 16, borderRadius: 12 }}>Loading roadmap...</div>;
  }

  if (!roadmap) {
    return <div style={{ backgroundColor: "#fff", padding: 16, borderRadius: 12 }}>No roadmap found for this project.</div>;
  }

  const milestonesByStage = roadmap.milestones.reduce<Record<string, RoadmapMilestone[]>>((acc, milestone) => {
    const key = milestone.stage_id || "unassigned";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(milestone);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Roadmap & Stages</h3>
        <button
          type="button"
          onClick={onRefresh}
          style={{ border: "none", borderRadius: 8, padding: "8px 12px", backgroundColor: "#FF7A00", color: "white", cursor: "pointer", fontWeight: 700 }}
        >
          Refresh
        </button>
      </div>

      {canEdit && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 14 }}>
            <h4 style={{ marginTop: 0 }}>Add Stage</h4>
            <input value={stageName} onChange={(event) => setStageName(event.target.value)} placeholder="Stage name" style={{ width: "100%", padding: 9, border: "1px solid #d9dcea", borderRadius: 8, marginBottom: 8 }} />
            <textarea value={stageDescription} onChange={(event) => setStageDescription(event.target.value)} placeholder="Description" style={{ width: "100%", minHeight: 70, padding: 9, border: "1px solid #d9dcea", borderRadius: 8, marginBottom: 8 }} />
            <button type="button" onClick={handleAddStage} style={{ border: "none", borderRadius: 8, padding: "9px 12px", backgroundColor: "#0E0A3C", color: "white", cursor: "pointer", fontWeight: 700 }}>
              Add Stage
            </button>
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 14 }}>
            <h4 style={{ marginTop: 0 }}>Add Milestone</h4>
            <input value={milestoneName} onChange={(event) => setMilestoneName(event.target.value)} placeholder="Milestone name" style={{ width: "100%", padding: 9, border: "1px solid #d9dcea", borderRadius: 8, marginBottom: 8 }} />
            <select value={milestoneStageId} onChange={(event) => setMilestoneStageId(event.target.value)} style={{ width: "100%", padding: 9, border: "1px solid #d9dcea", borderRadius: 8, marginBottom: 8 }}>
              <option value="">Unassigned Stage</option>
              {roadmap.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
            <input type="date" value={milestoneDeadline} onChange={(event) => setMilestoneDeadline(event.target.value)} style={{ width: "100%", padding: 9, border: "1px solid #d9dcea", borderRadius: 8, marginBottom: 8 }} />
            <textarea value={milestoneDescription} onChange={(event) => setMilestoneDescription(event.target.value)} placeholder="Description" style={{ width: "100%", minHeight: 60, padding: 9, border: "1px solid #d9dcea", borderRadius: 8, marginBottom: 8 }} />
            <button type="button" onClick={handleAddMilestone} style={{ border: "none", borderRadius: 8, padding: "9px 12px", backgroundColor: "#0E0A3C", color: "white", cursor: "pointer", fontWeight: 700 }}>
              Add Milestone
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {roadmap.stages.map((stage) => (
          <div key={stage.id} style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 14 }}>
            <h4 style={{ margin: 0 }}>{stage.name}</h4>
            <p style={{ margin: "6px 0", color: "#6B7280", fontSize: 13 }}>{stage.description || "No description"}</p>
            <div style={{ backgroundColor: "#ECEEF5", borderRadius: 999, overflow: "hidden", height: 9, marginBottom: 8 }}>
              <div style={{ width: `${stage.progress_percent || 0}%`, height: "100%", backgroundColor: "#FF7A00" }} />
            </div>
            <div style={{ color: "#6B7280", fontSize: 12, marginBottom: 8 }}>
              {stage.completed_count || 0}/{stage.task_count || 0} tasks complete
            </div>

            {(milestonesByStage[stage.id] || []).length > 0 ? (
              milestonesByStage[stage.id].map((milestone) => (
                <div key={milestone.id} style={{ border: "1px solid #F0F1F6", borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{milestone.name}</div>
                  <div style={{ color: "#6B7280", fontSize: 12 }}>{milestone.deadline || "No deadline"}</div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 12, backgroundColor: "#EFF2FF", padding: "3px 8px", borderRadius: 999 }}>{milestone.status}</span>
                    {canEdit && (
                      <select
                        value={milestone.status}
                        onChange={(event) => onUpdateMilestone(milestone.id, { status: event.target.value as "planned" | "in_progress" | "completed" })}
                        style={{ marginLeft: 8, padding: "4px 6px", borderRadius: 6, border: "1px solid #d9dcea" }}
                      >
                        <option value="planned">planned</option>
                        <option value="in_progress">in_progress</option>
                        <option value="completed">completed</option>
                      </select>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#9CA3AF", fontSize: 12 }}>No milestones in this stage.</div>
            )}
          </div>
        ))}
      </div>

      {(milestonesByStage.unassigned || []).length > 0 && (
        <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 14 }}>
          <h4 style={{ marginTop: 0 }}>Unassigned Milestones</h4>
          {(milestonesByStage.unassigned || []).map((milestone) => (
            <div key={milestone.id} style={{ borderBottom: "1px solid #F0F1F6", padding: "8px 0" }}>
              <div style={{ fontWeight: 600 }}>{milestone.name}</div>
              <div style={{ color: "#6B7280", fontSize: 12 }}>{milestone.deadline || "No deadline"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

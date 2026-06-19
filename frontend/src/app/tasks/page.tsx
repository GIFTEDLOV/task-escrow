import TaskMarket from "@/components/TaskMarket";

export default function TasksPage() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#6b6763",
          margin: "0 0 28px",
        }}
      >
        Tasks
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <TaskMarket />
      </div>
    </div>
  );
}

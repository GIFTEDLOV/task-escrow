"use client";

import { useState } from "react";
import PostTask from "./PostTask";
import TaskBoard from "./TaskBoard";

export default function TaskMarket() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  return (
    <>
      <PostTask onSuccess={() => setRefreshTrigger((n) => n + 1)} />
      <TaskBoard refreshTrigger={refreshTrigger} />
    </>
  );
}

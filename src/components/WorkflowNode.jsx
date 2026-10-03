import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { byType } from "../data/nodes";
import { Icon } from "./UI";
export default memo(function WorkflowNode({ data, selected }) {
  const def = byType[data.kind];
  const trigger = def.category === "Triggers";
  return (
    <div
      className={`w-[218px] rounded-lg border bg-white shadow-sm transition-shadow ${selected ? "border-zinc-800 ring-4 ring-zinc-900/5" : "border-zinc-200"} ${data.disabled ? "opacity-45" : ""}`}
    >
      {!trigger && <Handle type="target" position={Position.Left} />}
      <div className="flex items-center gap-3 p-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 w-10 h-10 grid place-items-center">
          <Icon name={def.icon} size={20} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold truncate">{data.label}</div>
          <div className="text-[10px] text-zinc-400 mt-1">
            {def.category} · {def.name}
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-zinc-100 flex justify-between text-[10px] text-zinc-400">
        <span>
          {data.disabled
            ? "Disabled"
            : data.credentialId
              ? "Connected"
              : def.credential
                ? "Connection required"
                : "Ready to configure"}
        </span>
        <Icon
          name={
            data.status === "SUCCESS"
              ? "Check"
              : data.status === "ERROR"
                ? "CircleAlert"
                : "Ellipsis"
          }
          size={12}
        />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

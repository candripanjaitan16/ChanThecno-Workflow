import { useState } from "react";
import { definitions } from "../data/nodes";
import { Icon } from "./UI";
export default function NodeLibrary({ onAdd, onClose }) {
  const [search, setSearch] = useState("");
  return (
    <aside className="absolute top-4 left-4 bottom-4 z-20 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg flex flex-col">
      <header className="p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Add a node</h3>
          <p className="text-[11px] text-zinc-400 mt-1">
            Build your next connection.
          </p>
        </div>
        <button aria-label="Close node library" onClick={onClose}>
          <Icon name="X" />
        </button>
      </header>
      <div className="px-3 pb-3">
        <div className="flex gap-2 border border-zinc-200 rounded-md px-2 items-center">
          <Icon name="Search" size={14} />
          <input
            autoFocus
            placeholder="Search nodes…"
            className="w-full py-2 text-xs outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-y-auto px-2 pb-3">
        {[...new Set(definitions.map((n) => n.category))].map((category) => {
          const nodes = definitions.filter(
            (n) =>
              n.category === category &&
              `${n.name} ${n.category}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          );
          return (
            nodes.length > 0 && (
              <section key={category}>
                <h4 className="panel-title px-2 pt-3 pb-2">{category}</h4>
                {nodes.map((n) => (
                  <button
                    key={n.type}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("application/chanthecno", n.type)
                    }
                    onClick={() => onAdd(n.type)}
                    className="flex items-center gap-3 w-full text-left rounded-md p-2 hover:bg-zinc-50"
                  >
                    <span className="p-2 border border-zinc-200 rounded-md">
                      <Icon name={n.icon} size={15} />
                    </span>
                    <span>
                      <strong className="text-xs font-medium block">
                        {n.name}
                      </strong>
                      <span className="text-[10px] text-zinc-400 line-clamp-1">
                        {n.description}
                      </span>
                    </span>
                  </button>
                ))}
              </section>
            )
          );
        })}
      </div>
      <footer className="border-t border-zinc-100 p-3 text-[10px] text-zinc-400">
        Click to add or drag onto the canvas
      </footer>
    </aside>
  );
}

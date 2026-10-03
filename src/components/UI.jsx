import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Box,
  Braces,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  Ellipsis,
  Filter,
  FlaskConical,
  GitBranch,
  GitMerge,
  Globe,
  KeyRound,
  Layers2,
  LayoutTemplate,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Split,
  StickyNote,
  Table2,
  Terminal,
  Trash2,
  Type,
  Undo2,
  Variable,
  Webhook,
  Workflow,
  X,
} from "lucide-react";
const Icons = {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Box,
  Braces,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  Ellipsis,
  Filter,
  FlaskConical,
  GitBranch,
  GitMerge,
  Globe,
  KeyRound,
  Layers2,
  LayoutTemplate,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Split,
  StickyNote,
  Table2,
  Terminal,
  Trash2,
  Type,
  Undo2,
  Variable,
  Webhook,
  Workflow,
  X,
};
export function Icon({ name, size = 16, ...props }) {
  const Component = Icons[name] || Icons.Box;
  return <Component size={size} strokeWidth={1.7} {...props} />;
}
export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 bg-zinc-900 text-white grid place-items-center rounded-lg">
        <Icon name="Workflow" size={20} />
      </div>
      <div>
        <div className="font-semibold tracking-tight text-base">
          ChanThecno<span className="text-zinc-400">.</span>
        </div>
        <div className="text-[9px] tracking-[.2em] text-zinc-400 uppercase">
          Workflow Studio
        </div>
      </div>
    </div>
  );
}
export function Badge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-medium rounded px-2 py-1 ${status === "ERROR" ? "bg-red-50 text-red-700" : status === "SUCCESS" || status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${status === "RUNNING" ? "animate-pulse" : ""}`}
      />
      {status}
    </span>
  );
}
export function Empty({ icon = "Workflow", title, children }) {
  return (
    <div className="py-20 text-center">
      <div className="inline-flex p-4 rounded-xl bg-zinc-100 mb-4">
        <Icon name={icon} size={25} />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="text-sm text-zinc-500">{children}</div>
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/25 backdrop-blur-xs grid place-items-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <header className="p-5 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose}>
            <Icon name="X" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

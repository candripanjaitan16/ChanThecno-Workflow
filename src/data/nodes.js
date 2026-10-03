const field = (key, label, type = "text", value = "") => ({
  key,
  label,
  type,
  value,
});
const aiFields = [
  field("model", "Model", "text", "gpt-4o-mini"),
  field("system", "System prompt", "textarea", "You are a helpful assistant."),
  field("prompt", "User prompt", "textarea", "{{input}}"),
  field("temperature", "Temperature", "number", 0.7),
  field("maxTokens", "Max tokens", "number", 512),
];
const httpFields = [
  field("url", "HTTPS endpoint"),
  field("method", "Method", "select:GET,POST,PUT,PATCH,DELETE", "GET"),
  field("headers", "Headers (JSON)", "json", "{}"),
  field("query", "Query (JSON)", "json", "{}"),
  field("body", "Body (JSON)", "json", "{}"),
];
export const definitions = [
  {
    type: "manual",
    name: "Manual Trigger",
    category: "Triggers",
    icon: "Play",
    description: "Start a workflow on demand",
    fields: [],
  },
  {
    type: "webhook",
    name: "Webhook",
    category: "Triggers",
    icon: "Webhook",
    description: "Receive an authenticated HTTP event",
    fields: [],
  },
  {
    type: "schedule",
    name: "Schedule",
    category: "Triggers",
    icon: "Clock3",
    description: "Run at an interval via scheduler",
    fields: [field("interval", "Interval (minutes)", "number", 60)],
  },
  {
    type: "event",
    name: "Event Trigger",
    category: "Triggers",
    icon: "Radio",
    description: "Receive events through the webhook API",
    fields: [field("event", "Event name", "text", "customer.created")],
  },
  ...["openai", "anthropic", "google", "ai"].map((type) => ({
    type,
    name: {
      openai: "OpenAI",
      anthropic: "Anthropic",
      google: "Google AI",
      ai: "Custom AI API",
    }[type],
    category: "AI",
    icon: "Sparkles",
    description: "Generate text using your connected provider",
    credential: type,
    fields: [
      ...aiFields.map((f) =>
        f.key === "model"
          ? {
              ...f,
              value:
                type === "anthropic"
                  ? "claude-sonnet-4-20250514"
                  : type === "google"
                    ? "gemini-2.5-flash"
                    : f.value,
            }
          : f,
      ),
      ...(type === "ai"
        ? [field("url", "OpenAI-compatible HTTPS endpoint")]
        : []),
    ],
  })),
  {
    type: "csv",
    name: "CSV / Dataset",
    category: "Data",
    icon: "Table2",
    description: "Read rows from CSV data",
    fields: [
      field(
        "csv",
        "CSV content",
        "textarea",
        "name,email\nCandri,candri@example.com",
      ),
    ],
  },
  {
    type: "json",
    name: "JSON",
    category: "Data",
    icon: "Braces",
    description: "Create structured JSON data",
    fields: [
      field("value", "JSON data", "json", '{"customer":{"name":"Candri"}}'),
    ],
  },
  {
    type: "text",
    name: "Text",
    category: "Data",
    icon: "Type",
    description: "Create text with variables",
    fields: [field("text", "Text", "textarea", "Hello {{customer.name}}")],
  },
  ...["transform", "map"].map((type) => ({
    type,
    name: type === "map" ? "Map" : "Transform",
    category: "Data",
    icon: "Shuffle",
    description: "Map each input item to a JSON template",
    fields: [
      field("mapping", "JSON mapping", "json", '{"name":"{{item.name}}"}'),
    ],
  })),
  {
    type: "filter",
    name: "Filter",
    category: "Data",
    icon: "Filter",
    description: "Keep matching records",
    fields: [
      field("path", "Field path", "text", "name"),
      field(
        "operator",
        "Operator",
        "select:equals,contains,exists,greater",
        "exists",
      ),
      field("value", "Comparison value"),
    ],
  },
  {
    type: "merge",
    name: "Merge",
    category: "Data",
    icon: "GitMerge",
    description: "Combine connected inputs into an array",
    fields: [],
  },
  {
    type: "split",
    name: "Split",
    category: "Data",
    icon: "Split",
    description: "Read an array from a field",
    fields: [field("path", "Array field path", "text", "items")],
  },
  {
    type: "variable",
    name: "Set Variable",
    category: "Utility",
    icon: "Variable",
    description: "Set a variable for downstream nodes",
    fields: [
      field("key", "Variable name", "text", "customer"),
      field("value", "Value (JSON)", "json", '{"name":"Candri"}'),
    ],
  },
  {
    type: "whatsapp",
    name: "WhatsApp",
    category: "Communication",
    icon: "MessageCircle",
    description: "Official WhatsApp Business Cloud API",
    credential: "whatsapp",
    fields: [
      field("phoneId", "Phone number ID"),
      field("recipient", "Recipient"),
      field("message", "Message", "textarea", "{{ai.output}}"),
      field("template", "Template name (optional)"),
      field("language", "Template language", "text", "en_US"),
      field("components", "Template components (JSON)", "json", "[]"),
    ],
  },
  {
    type: "email",
    name: "Email",
    category: "Communication",
    icon: "Mail",
    description: "Send through your SMTP provider or Gmail app password",
    credential: "smtp",
    fields: [
      field("from", "Sender"),
      field("to", "Recipient"),
      field("subject", "Subject", "text", "Workflow notification"),
      field("text", "Message", "textarea", "{{input}}"),
    ],
  },
  ...["http", "rest", "custom"].map((type) => ({
    type,
    name: { http: "HTTP Request", rest: "REST API", custom: "Custom API" }[
      type
    ],
    category: "API",
    icon: "Globe",
    description: "Call an allowed HTTPS API",
    credential: "bearer",
    fields: httpFields,
  })),
  {
    type: "database",
    name: "PostgreSQL",
    category: "Database",
    icon: "Database",
    description: "Execute a parameterized query on your connection",
    credential: "postgres",
    fields: [
      field("query", "SQL query", "textarea", "SELECT $1::text AS message"),
      field("values", "Parameters (JSON array)", "json", '["Hello"]'),
    ],
  },
  {
    type: "note",
    name: "Sticky Note",
    category: "Utility",
    icon: "StickyNote",
    description: "Document the workflow",
    fields: [field("text", "Note", "textarea", "Add a note for your team.")],
  },
];
export const byType = Object.fromEntries(definitions.map((d) => [d.type, d]));
export function makeNode(kind, position = { x: 120, y: 180 }) {
  const d = byType[kind];
  return {
    id: crypto.randomUUID(),
    type: "workflow",
    position,
    data: {
      kind,
      label: d.name,
      parameters: Object.fromEntries(d.fields.map((f) => [f.key, f.value])),
      credentialId: "",
      disabled: false,
    },
  };
}
export function demoWorkflow() {
  const nodes = [
    makeNode("csv", { x: 100, y: 180 }),
    makeNode("openai", { x: 410, y: 180 }),
    makeNode("whatsapp", { x: 720, y: 180 }),
  ];
  nodes[1].data.label = "AI API";
  return {
    id: crypto.randomUUID(),
    name: "Customer outreach",
    description: "Turn customer data into a personal conversation.",
    active: false,
    nodes,
    edges: [
      { id: crypto.randomUUID(), source: nodes[0].id, target: nodes[1].id },
      { id: crypto.randomUUID(), source: nodes[1].id, target: nodes[2].id },
    ],
  };
}

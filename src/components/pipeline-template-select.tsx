import { PIPELINE_TEMPLATES } from "@/lib/pipeline-templates";

export function PipelineTemplateSelect({ id, className = "input" }: { id?: string; className?: string }) {
  return (
    <select className={className} id={id} name="template" defaultValue="general">
      {Object.entries(PIPELINE_TEMPLATES).map(([key, t]) => (
        <option key={key} value={key}>{t.label}</option>
      ))}
    </select>
  );
}

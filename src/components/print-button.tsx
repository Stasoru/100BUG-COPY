"use client";

export function PrintButton({ label = "Imprimir / salvar PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-secondary print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}

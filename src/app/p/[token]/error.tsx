"use client";

export default function PublicProposalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="card max-w-md space-y-3 text-center">
        <p className="font-semibold">Não foi possível registrar sua resposta</p>
        <p className="text-sm text-slate-600">Para aceitar, escreva seu nome completo. Se o documento já foi respondido, fale com o vendedor.</p>
        <button className="btn" onClick={reset}>Voltar ao documento</button>
      </div>
    </main>
  );
}

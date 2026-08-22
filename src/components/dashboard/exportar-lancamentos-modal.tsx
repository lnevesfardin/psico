"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import type { Lancamento } from "@/lib/financeiro-client";
import { formatDateShort, todayIso } from "@/lib/format";

function inicioDoAno(): string {
  return `${todayIso().slice(0, 4)}-01-01`;
}

function escaparCampoCsv(valor: string): string {
  // Ponto e vírgula (não vírgula) é o separador que o Excel em pt-BR espera
  // por padrão — com vírgula, cada linha cairia numa coluna só ao abrir.
  if (/[";\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

function paraLinhaCsv(campos: string[]): string {
  return campos.map(escaparCampoCsv).join(";");
}

const TIPO_LABEL: Record<Lancamento["tipo"], string> = {
  receita: "Receita",
  despesa: "Despesa",
};

const STATUS_LABEL: Record<Lancamento["status"], string> = {
  pago: "Pago",
  pendente: "Pendente",
};

function gerarCsv(lancamentos: Lancamento[]): string {
  const linhas = [
    paraLinhaCsv(["Data", "Tipo", "Paciente", "Descrição", "Status", "Valor (R$)"]),
    ...lancamentos.map((l) =>
      paraLinhaCsv([
        formatDateShort(l.data),
        TIPO_LABEL[l.tipo],
        l.patientName ?? "",
        l.descricao ?? "",
        STATUS_LABEL[l.status],
        // Vírgula decimal (padrão BR), não ponto — consistente com o
        // separador de coluna acima ser ";" e não ",".
        l.valor.toFixed(2).replace(".", ","),
      ])
    ),
  ];
  // BOM no início: sem isso o Excel no Windows abre acento (ç, ã, é) como
  // caractere errado — só o Bloco de Notas/navegador já leem UTF-8 sem BOM
  // corretamente.
  return "﻿" + linhas.join("\r\n");
}

export function ExportarLancamentosModal({
  lancamentos,
  onClose,
}: {
  lancamentos: Lancamento[];
  onClose: () => void;
}) {
  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(todayIso());

  const noPeriodo = lancamentos.filter((l) => l.data >= de && l.data <= ate);

  function handleExportar() {
    const csv = gerarCsv(noPeriodo);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro_${de}_a_${ate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            <Download className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            Exportar lançamentos
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Baixa um CSV (abre no Excel) com receitas e despesas do período —
          útil para declarar imposto (Carnê-Leão).
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            De
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              max={ate}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Até
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              min={de}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
          {noPeriodo.length === 0
            ? "Nenhum lançamento nesse período."
            : `${noPeriodo.length} lançamento${noPeriodo.length === 1 ? "" : "s"} nesse período.`}
        </p>

        <button
          type="button"
          onClick={handleExportar}
          disabled={noPeriodo.length === 0}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          Baixar CSV
        </button>
      </div>
    </div>
  );
}

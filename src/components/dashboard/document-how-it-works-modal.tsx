"use client";

import { X } from "lucide-react";

const PASSOS = [
  {
    titulo: "1. Crie um modelo",
    texto:
      'Em "Modelos de Documentos", clique em "Criar modelo" e escreva do zero, ou em "Modelos prontos" para partir de um atestado, laudo, declaração, contrato etc. já esboçado. Use os botões acima do editor (Nome do paciente, CRP, data...) para inserir campos que se preenchem sozinhos depois — não precisa digitar esses dados toda vez.',
  },
  {
    titulo: "2. Abra a ficha do paciente",
    texto:
      'Em "Pacientes & Prontuários", escolha o paciente e vá na aba "Documentos".',
  },
  {
    titulo: "3. Escolha o modelo e clique em \"Usar modelo\"",
    texto:
      "O sistema já preenche os campos automáticos (nome, CPF, data de nascimento do paciente, seus dados de psicólogo, data de emissão) direto no texto.",
  },
  {
    titulo: "4. Revise e complete",
    texto:
      "Ajuste o texto no editor — o que ficou entre colchetes, tipo [descrever a finalidade], precisa ser preenchido à mão. Formate se quiser (negrito, títulos, listas).",
  },
  {
    titulo: '5. Clique em "Salvar e imprimir"',
    texto:
      'O documento é gravado no histórico do paciente ("Documentos emitidos") e a impressão abre na hora.',
  },
  {
    titulo: "6. Baixe ou reimprima quando quiser",
    texto:
      'Na lista "Documentos emitidos", cada documento salvo tem dois ícones: baixar como Word (.doc, abre editável no Word/Google Docs) e imprimir (dá para escolher "Salvar como PDF" na caixa de impressão do navegador).',
  },
];

export function DocumentHowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Como emitir um documento
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
          Passo a passo para criar um modelo (ex.: atestado) e usá-lo com um
          paciente.
        </p>

        <div className="mt-5 space-y-4">
          {PASSOS.map((passo) => (
            <div key={passo.titulo}>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                {passo.titulo}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {passo.texto}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 self-end rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

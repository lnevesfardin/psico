"use client";

import { useEffect, useState } from "react";
import { fetchMunicipios } from "@/lib/ibge";

const defaultFieldClass =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

export function CidadeSelect({
  uf,
  value,
  onChange,
  required,
  placeholder,
  className = defaultFieldClass,
}: {
  uf: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  // Texto do placeholder quando não obrigatório (ex.: filtro de busca, onde
  // "vazio" é uma opção válida — "todas as cidades" — e não só um estado
  // transitório antes de escolher.
  placeholder?: string;
  // Sobrescreve o estilo padrão (que inclui mt-1.5, pensado pra ficar
  // dentro de um <label>) — necessário quando o campo é usado solto num
  // grid, como no filtro de busca, senão o mt-1.5 desalinha com os
  // vizinhos.
  className?: string;
}) {
  const [cidades, setCidades] = useState<string[]>([]);
  // Guardam o UF a que "cidades"/a falha se referem, em vez de um booleano
  // solto — permite derivar "loading" comparando com o UF atual sem
  // precisar de um setState síncrono no início do efeito.
  const [loadedUf, setLoadedUf] = useState<string | null>(null);
  const [failedUf, setFailedUf] = useState<string | null>(null);

  useEffect(() => {
    if (!uf) return;
    let cancelado = false;
    fetchMunicipios(uf)
      .then((nomes) => {
        if (cancelado) return;
        setCidades(nomes);
        setLoadedUf(uf);
      })
      .catch(() => {
        if (cancelado) return;
        setFailedUf(uf);
      });
    return () => {
      cancelado = true;
    };
  }, [uf]);

  const failed = failedUf === uf;
  const loading = Boolean(uf) && !failed && loadedUf !== uf;
  const cidadesDoUf = loadedUf === uf ? cidades : [];

  // Sem estado escolhido ainda, ou a busca de cidades falhou (ex.: API do
  // IBGE fora do ar): cai pra um campo de texto livre em vez de travar o
  // formulário.
  if (!uf || failed) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={!uf}
        placeholder={uf ? "Digite a cidade" : "Selecione o estado primeiro"}
        className={className}
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={loading}
      className={className}
    >
      {/* Só desabilita a opção em branco quando o campo é obrigatório —
          num filtro opcional, "vazio" precisa continuar selecionável pra
          voltar a "todas as cidades". */}
      <option value="" disabled={required}>
        {loading ? "Carregando cidades..." : placeholder ?? "Selecione a cidade"}
      </option>
      {/* Garante que uma cidade já salva apareça selecionada mesmo se, por
          algum motivo, não estiver na lista atual do IBGE. */}
      {value && !cidadesDoUf.includes(value) && (
        <option value={value}>{value}</option>
      )}
      {cidadesDoUf.map((cidade) => (
        <option key={cidade} value={cidade}>
          {cidade}
        </option>
      ))}
    </select>
  );
}

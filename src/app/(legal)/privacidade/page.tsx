import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Psi Rob",
};

const h2 = "mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-white";
const p = "mt-3 text-base font-normal leading-relaxed text-zinc-600 dark:text-zinc-400";
const ul = "mt-3 list-disc space-y-2 pl-5 text-base font-normal leading-relaxed text-zinc-600 dark:text-zinc-400";
const link = "font-medium text-brand-600 underline decoration-2 underline-offset-2 hover:text-brand-500 dark:text-brand-400";
const strong = "text-zinc-800 dark:text-zinc-200";

export default function PoliticaDePrivacidadePage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm font-normal text-zinc-500 dark:text-zinc-500">
        Última atualização: 11 de agosto de 2026
      </p>

      <p className={p}>
        Esta Política explica como o Psi Rob (&quot;nós&quot;,
        &quot;Plataforma&quot;) trata dados pessoais de psicólogos e
        pacientes que usam a Plataforma, em conformidade com a Lei Geral de
        Proteção de Dados (LGPD — Lei 13.709/2018).
      </p>

      <h2 className={h2}>1. Quem trata o quê</h2>
      <ul className={ul}>
        <li>
          <strong className={strong}>Dados de cadastro do psicólogo</strong>{" "}
          (nome, e-mail, CRP, telefone, endereço do consultório, foto de
          perfil): o Psi Rob é o controlador desses dados, usados para
          operar sua conta.
        </li>
        <li>
          <strong className={strong}>Dados de pacientes inseridos pelo psicólogo</strong>{" "}
          (nome, CPF, contato, prontuário, dados de saúde): o{" "}
          <strong className={strong}>psicólogo é o controlador</strong> desses
          dados; o Psi Rob atua como <strong className={strong}>operador</strong>,
          processando-os apenas para viabilizar a Plataforma (armazenar,
          exibir, permitir agendamento), sob as instruções e
          responsabilidade do profissional.
        </li>
      </ul>

      <h2 className={h2}>2. Dados que coletamos</h2>
      <ul className={ul}>
        <li>
          <strong className={strong}>Cadastro do psicólogo:</strong> nome,
          e-mail, senha (criptografada), CRP, telefone, endereço, biografia,
          foto.
        </li>
        <li>
          <strong className={strong}>Dados inseridos sobre pacientes:</strong>{" "}
          nome, CPF, contato, dados de convênio, anotações de prontuário,
          evolução de sessões, informações de saúde — dado sensível nos
          termos do art. 5º, II, da LGPD.
        </li>
        <li>
          <strong className={strong}>Dados do paciente com conta própria</strong>{" "}
          (por convite): agendamentos, check-ins de humor, diário pessoal
          (visível só a ele, salvo quando compartilhado) e respostas a
          escalas de rastreio.
        </li>
        <li>
          <strong className={strong}>Áudio de sessão</strong> (uso opcional):
          processado para gerar transcrição em texto; o áudio em si não é
          armazenado — só o texto, depois de revisado por você.
        </li>
        <li>
          <strong className={strong}>Dados técnicos e de segurança:</strong>{" "}
          endereço IP (para limitar tentativas abusivas de login e das
          rotas públicas de agendamento), registro de quando um prontuário
          é acessado (trilha de auditoria) e cookies de sessão de
          autenticação.
        </li>
      </ul>

      <h2 className={h2}>3. Para que usamos</h2>
      <ul className={ul}>
        <li>
          Viabilizar as funcionalidades da Plataforma (agenda, prontuário,
          financeiro, materiais de apoio, escalas de rastreio);
        </li>
        <li>
          Enviar lembretes de consulta por e-mail (1h antes) e e-mails
          transacionais (confirmação de cadastro, redefinição de senha);
        </li>
        <li>
          Prevenir abuso e fraude (limite de tentativas por IP/e-mail nas
          rotas públicas);
        </li>
        <li>
          Cumprir obrigações legais e regulatórias aplicáveis à guarda de
          prontuário psicológico.
        </li>
      </ul>

      <h2 className={h2}>4. Com quem compartilhamos</h2>
      <p className={p}>
        Não vendemos dados. Compartilhamos apenas com prestadores que operam
        a infraestrutura da Plataforma, sob contrato:
      </p>
      <ul className={ul}>
        <li>
          <strong className={strong}>Supabase</strong> — banco de dados,
          autenticação e armazenamento de arquivos: infraestrutura onde os
          dados ficam hospedados.
        </li>
        <li>
          <strong className={strong}>Brevo</strong> — envio de e-mails
          transacionais e lembretes de consulta.
        </li>
        <li>
          <strong className={strong}>Google (Gemini API)</strong> — usada
          pelo assistente virtual, pela transcrição de áudio de sessão
          (quando você usa esse recurso) e pelo reconhecimento de
          lançamentos financeiros digitados em texto livre. O assistente é
          instruído a nunca solicitar ou repetir dados sensíveis de
          pacientes.
        </li>
      </ul>

      <h2 className={h2}>5. Como protegemos os dados</h2>
      <ul className={ul}>
        <li>Conexão criptografada (TLS) em trânsito e criptografia em repouso no banco de dados;</li>
        <li>
          Isolamento por psicólogo via controle de acesso a nível de linha
          (Row Level Security): cada profissional só acessa os próprios
          pacientes;
        </li>
        <li>Trilha de auditoria de acesso ao prontuário;</li>
        <li>Limite de tentativas (rate limiting) nas rotas públicas e de autenticação;</li>
        <li>Contas de paciente exigem convite do psicólogo — não há cadastro aberto de pacientes.</li>
      </ul>

      <h2 className={h2}>6. Retenção e exclusão</h2>
      <p className={p}>
        Mantemos seus dados enquanto sua conta estiver ativa. Ao cancelar,
        você pode solicitar a exclusão dos seus dados de cadastro; dados de
        prontuário inseridos por você sobre seus pacientes seguem, quando
        aplicável, o prazo de guarda exigido pelas normas do Conselho
        Federal de Psicologia, que cabe a você (psicólogo, controlador)
        observar.
      </p>

      <h2 className={h2}>7. Seus direitos (LGPD)</h2>
      <p className={p}>
        Você pode solicitar, a qualquer momento: confirmação de tratamento,
        acesso, correção, anonimização, portabilidade ou exclusão dos seus
        dados, e informações sobre com quem os compartilhamos. Para
        exercer esses direitos, escreva para{" "}
        <a href="mailto:lnevesfardin@gmail.com" className={link}>
          lnevesfardin@gmail.com
        </a>
        .
      </p>

      <h2 className={h2}>8. Pacientes menores de idade</h2>
      <p className={p}>
        Quando o paciente é menor de idade, o tratamento de seus dados
        pressupõe consentimento e supervisão do responsável legal, sob
        responsabilidade do psicólogo que cadastra o vínculo.
      </p>

      <h2 className={h2}>9. Cookies</h2>
      <p className={p}>
        Usamos apenas cookies essenciais de autenticação (sessão) e de
        preferência de tema (claro/escuro). Não usamos cookies de
        rastreamento publicitário.
      </p>

      <h2 className={h2}>10. Alterações desta política</h2>
      <p className={p}>
        Podemos atualizar esta Política conforme a Plataforma evolui.
        Mudanças relevantes serão comunicadas por e-mail ou por aviso na
        Plataforma.
      </p>

      <h2 className={h2}>11. Contato</h2>
      <p className={p}>
        Contato para assuntos de privacidade e proteção de dados:{" "}
        <a href="mailto:lnevesfardin@gmail.com" className={link}>
          lnevesfardin@gmail.com
        </a>
      </p>
    </article>
  );
}

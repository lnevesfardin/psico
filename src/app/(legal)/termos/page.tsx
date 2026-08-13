import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — Psico",
};

const h2 = "mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-white";
const p = "mt-3 text-base font-normal leading-relaxed text-zinc-600 dark:text-zinc-400";
const ul = "mt-3 list-disc space-y-2 pl-5 text-base font-normal leading-relaxed text-zinc-600 dark:text-zinc-400";
const link = "font-medium text-brand-600 underline decoration-2 underline-offset-2 hover:text-brand-500 dark:text-brand-400";

export default function TermosDeUsoPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Termos de Uso
      </h1>
      <p className="mt-2 text-sm font-normal text-zinc-500 dark:text-zinc-500">
        Última atualização: 11 de agosto de 2026
      </p>

      <p className={p}>
        Bem-vindo ao Psico. Estes Termos de Uso regulam o acesso e o uso da
        plataforma Psico (&quot;Plataforma&quot;), disponibilizada em fase
        de acesso antecipado por{" "}
        <strong className="text-zinc-800 dark:text-zinc-200">
          [nome completo do responsável]
        </strong>{" "}
        (&quot;nós&quot;). Ao criar uma conta ou usar a Plataforma, você
        (&quot;Usuário&quot;) concorda com estes termos.
      </p>

      <h2 className={h2}>1. O que é o Psico</h2>
      <p className={p}>
        Um software de gestão para consultórios e clínicas de psicologia:
        agendamento de consultas, prontuário eletrônico, controle financeiro
        e ferramentas de apoio ao acompanhamento terapêutico.
      </p>

      <h2 className={h2}>2. Fase de acesso antecipado</h2>
      <p className={p}>
        A Plataforma está em fase inicial (early access), com um número
        reduzido de usuários. Isso significa que:
      </p>
      <ul className={ul}>
        <li>
          Funcionalidades podem mudar, ser adicionadas ou removidas sem um
          aviso prévio longo;
        </li>
        <li>
          Podem ocorrer interrupções, instabilidades ou indisponibilidades
          temporárias;
        </li>
        <li>
          Não há garantia contratual de disponibilidade (SLA) nesta fase.
        </li>
      </ul>
      <p className={p}>
        Você será avisado com razoável antecedência antes de qualquer
        mudança que afete de forma relevante o uso da Plataforma ou envolva
        a exclusão de dados.
      </p>

      <h2 className={h2}>3. Contas de psicólogo e de paciente</h2>
      <ul className={ul}>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Conta de psicólogo:
          </strong>{" "}
          criada por cadastro direto, mediante confirmação de e-mail. Você é
          responsável por manter a veracidade dos seus dados e por
          resguardar a confidencialidade da sua senha.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Conta de paciente/cliente:
          </strong>{" "}
          criada exclusivamente por convite do psicólogo responsável — a
          Plataforma não permite que um paciente se cadastre sozinho sem
          vínculo prévio com um profissional.
        </li>
      </ul>

      <h2 className={h2}>4. Responsabilidade do psicólogo pelos dados que insere</h2>
      <p className={p}>
        Você, psicólogo(a), é o(a) responsável (controlador, nos termos da
        LGPD) pelos dados de pacientes que registra na Plataforma. Ao usá-la,
        você declara que:
      </p>
      <ul className={ul}>
        <li>Possui vínculo terapêutico legítimo com cada paciente cadastrado;</li>
        <li>
          Obteve, quando aplicável, o consentimento do paciente para o
          tratamento de seus dados na Plataforma — inclusive para gravação e
          transcrição de sessões, quando usar esse recurso;
        </li>
        <li>
          Segue o Código de Ética Profissional do Psicólogo e as normas do
          Conselho Federal de Psicologia (CFP) quanto ao registro, sigilo e
          guarda de prontuário.
        </li>
      </ul>
      <p className={p}>
        O Psico atua como operador desses dados (fornece a infraestrutura
        técnica), não como responsável pelo conteúdo clínico inserido.
      </p>

      <h2 className={h2}>5. Gravação e transcrição de sessões</h2>
      <p className={p}>
        A Plataforma oferece, de forma opcional, a gravação de áudio de
        sessões para gerar uma transcrição automática. O áudio não é
        armazenado pela Plataforma — apenas o texto gerado, depois da sua
        revisão. O uso desse recurso exige confirmação explícita de
        consentimento no momento da gravação e é de responsabilidade do
        psicólogo obter a autorização prévia do paciente para gravar a
        sessão.
      </p>

      <h2 className={h2}>6. Uso aceitável</h2>
      <p className={p}>Você não pode:</p>
      <ul className={ul}>
        <li>
          Usar a Plataforma para inserir dados de pessoas sem vínculo
          terapêutico ou sem autorização legal para tratá-los;
        </li>
        <li>
          Tentar contornar limites técnicos de segurança (limite de
          tentativas, autenticação, controle de acesso) ou acessar dados de
          outro profissional;
        </li>
        <li>
          Fazer engenharia reversa, raspagem (scraping) ou uso automatizado
          abusivo da Plataforma ou de suas rotas públicas de agendamento;
        </li>
        <li>Usar a Plataforma para fins ilícitos ou que violem direitos de terceiros.</li>
      </ul>

      <h2 className={h2}>7. Aviso de segurança</h2>
      <p className={p}>
        A Plataforma não é um canal de socorro nem oferece atendimento de
        emergência. Em situações de risco ou crise, procure o CVV pelo
        telefone 188 ou www.cvv.org.br, ou a unidade hospitalar mais
        próxima.
      </p>

      <h2 className={h2}>8. Cancelamento</h2>
      <p className={p}>
        Não há fidelidade. Você pode cancelar sua conta a qualquer momento,
        diretamente no seu perfil. Ao cancelar, seus dados são tratados
        conforme descrito na nossa{" "}
        <a href="/privacidade" className={link}>
          Política de Privacidade
        </a>
        .
      </p>

      <h2 className={h2}>9. Propriedade intelectual</h2>
      <p className={p}>
        O software, a marca Psico e os elementos visuais da Plataforma
        pertencem a [nome completo do responsável]. Os dados que você insere
        (pacientes, prontuários, agenda, financeiro) continuam sendo seus.
      </p>

      <h2 className={h2}>10. Limitação de responsabilidade</h2>
      <p className={p}>
        A Plataforma é fornecida &quot;como está&quot;, em fase de acesso
        antecipado. Na máxima extensão permitida por lei, não nos
        responsabilizamos por decisões clínicas, prejuízos indiretos, ou
        indisponibilidades decorrentes de fatores fora do nosso controle
        razoável (ex.: falhas de provedores de infraestrutura, internet do
        usuário).
      </p>

      <h2 className={h2}>11. Alterações destes termos</h2>
      <p className={p}>
        Podemos atualizar estes Termos conforme a Plataforma evolui.
        Mudanças relevantes serão comunicadas por e-mail ou por aviso na
        Plataforma antes de entrarem em vigor.
      </p>

      <h2 className={h2}>12. Legislação aplicável</h2>
      <p className={p}>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro
        de [sua cidade/UF] para dirimir eventuais controvérsias.
      </p>

      <h2 className={h2}>13. Contato</h2>
      <p className={p}>
        Dúvidas sobre estes Termos:{" "}
        <a href="mailto:lnevesfardin@gmail.com" className={link}>
          lnevesfardin@gmail.com
        </a>
      </p>
    </article>
  );
}

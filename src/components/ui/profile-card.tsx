"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileCardBadgeGroup {
  label: string;
  items: string[];
}

export interface ProfileCardProps {
  name?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  /** Linha curta abaixo do título (ex.: região + valor) — texto livre ou nós React. */
  meta?: ReactNode;
  /** Grupos de badges renderizados após a descrição (ex.: especialidades). */
  badgeGroups?: ProfileCardBadgeGroup[];
  /** Conteúdo livre no rodapé do cartão (ex.: um botão de call-to-action). */
  footer?: ReactNode;
  className?: string;
}

// imageUrl vem de qualquer bucket/host configurado por quem usa o componente
// (ex.: foto de perfil no Supabase Storage); next/image exigiria cadastrar
// esse host em next.config.ts, o que não é viável para URLs por-usuário.
function ProfileImage({ imageUrl, name }: { imageUrl?: string; name: string }) {
  if (!imageUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-brand-50 text-brand-300 dark:bg-brand-950 dark:text-brand-800">
        <User className="h-1/3 w-1/3" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={name}
      className="h-full w-full object-cover"
      draggable={false}
    />
  );
}

function Badges({ group }: { group: ProfileCardBadgeGroup }) {
  if (group.items.length === 0) return null;
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {group.label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {group.items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProfileCard(props: ProfileCardProps) {
  const {
    name = "Michael Chen",
    title = "Senior Software Engineer, Cloud Infrastructure",
    description = "Michael Chen is a seasoned software engineer at TechFlow Solutions with over 8 years of experience building scalable cloud infrastructure and microservices. He specializes in DevOps automation and leads the platform engineering team that serves millions of users daily.",
    imageUrl,
    meta,
    badgeGroups = [],
    footer,
    className,
  } = props;

  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4", className)}>
      {/* Desktop */}
      <div className="relative hidden items-center md:flex">
        <div className="flex h-[470px] w-[470px] flex-shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gray-200 dark:bg-gray-700">
          <ProfileImage imageUrl={imageUrl} name={name} />
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="z-10 ml-[-80px] max-w-xl flex-1 rounded-3xl bg-white p-8 shadow-2xl dark:bg-zinc-900"
        >
          <div className="mb-4">
            <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              {name}
            </h2>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-400">
              {title}
            </p>
            {meta && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {meta}
              </div>
            )}
          </div>

          {description && (
            <p className="mb-6 text-base leading-relaxed text-black dark:text-white">
              {description}
            </p>
          )}

          {badgeGroups.map((group) => (
            <Badges key={group.label} group={group} />
          ))}

          {footer && <div className="mt-6">{footer}</div>}
        </motion.div>
      </div>

      {/* Mobile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto max-w-sm bg-transparent text-center md:hidden"
      >
        <div className="mb-6 flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-gray-200 dark:bg-gray-700">
          <ProfileImage imageUrl={imageUrl} name={name} />
        </div>

        <div className="px-4 text-left">
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
            {name}
          </h2>
          <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-300">
            {title}
          </p>
          {meta && (
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              {meta}
            </div>
          )}

          {description && (
            <p className="mb-6 text-sm leading-relaxed text-black dark:text-white">
              {description}
            </p>
          )}

          {badgeGroups.map((group) => (
            <Badges key={group.label} group={group} />
          ))}

          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </motion.div>
    </div>
  );
}

export default ProfileCard;

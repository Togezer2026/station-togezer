-- =====================================================================
--  0018 — Bloc C Phase 4 : messagerie agent ↔ réceptif.
--  Une conversation = un couple (agent, réceptif). Échange possible
--  qu'il y ait un RDV ou non.
-- =====================================================================
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references agents(id) on delete cascade,
  exposant_id   uuid not null references exposants(id) on delete cascade,
  expediteur_id uuid not null,
  contenu       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_msg_conv on messages (agent_id, exposant_id, created_at);

alter table messages enable row level security;
drop policy if exists p_msg_read on messages;
create policy p_msg_read on messages for select using (
  agent_id = auth.uid()
  or exposant_id in (select id from exposants where proprietaire_id = auth.uid())
  or is_admin()
);

-- Envoi (valide que l'expéditeur est bien l'agent ou le réceptif concerné).
create or replace function envoyer_message(p_agent_id uuid, p_exposant_id uuid, p_contenu text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if trim(coalesce(p_contenu, '')) = '' then raise exception 'Message vide.'; end if;
  if not (v_uid = p_agent_id
          or p_exposant_id in (select id from exposants where proprietaire_id = v_uid)) then
    raise exception 'Non autorisé.';
  end if;
  insert into messages (agent_id, exposant_id, expediteur_id, contenu)
  values (p_agent_id, p_exposant_id, v_uid, trim(p_contenu));
end; $$;
grant execute on function envoyer_message(uuid, uuid, text) to authenticated;

-- Liste des conversations de l'utilisateur connecté.
create or replace function mes_conversations()
returns table (agent_id uuid, exposant_id uuid, agence text, receptif text, dernier text, dernier_at timestamptz)
language sql security definer set search_path = public as $$
  select m.agent_id, m.exposant_id, a.agence, x.nom,
         (array_agg(m.contenu order by m.created_at desc))[1],
         max(m.created_at)
  from messages m
  join agents a on a.id = m.agent_id
  join exposants x on x.id = m.exposant_id
  where m.agent_id = auth.uid()
     or m.exposant_id in (select id from exposants where proprietaire_id = auth.uid())
  group by m.agent_id, m.exposant_id, a.agence, x.nom
  order by max(m.created_at) desc;
$$;
grant execute on function mes_conversations() to authenticated;

-- Fil d'une conversation.
create or replace function fil(p_agent_id uuid, p_exposant_id uuid)
returns table (id uuid, expediteur_id uuid, contenu text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.expediteur_id, m.contenu, m.created_at
  from messages m
  where m.agent_id = p_agent_id and m.exposant_id = p_exposant_id
    and (m.agent_id = auth.uid()
         or m.exposant_id in (select id from exposants where proprietaire_id = auth.uid())
         or (select is_admin()))
  order by m.created_at;
$$;
grant execute on function fil(uuid, uuid) to authenticated;

-- =====================================================================
-- Complejo PM · Migración 001 · Bloqueos de canchas
-- Correr UNA vez en el SQL Editor de Supabase, después de reservas-complejopm.sql (se puede volver a correr).
--
--   * reservas_complejopm_bloqueos: canchas u horarios que no se pueden reservar
--     (reparación, evento, torneo, clases, otro). canchas null = todas; horas null = todo el día.
--   * Al guardar un bloqueo se liberan las reservas que chocan (los fijos, solo en esas fechas).
--   * set_estado no deja reservar un turno bloqueado y los fijos no se reservan solos ahí.
--     Al eliminar o achicar un bloqueo, los fijos vuelven a reservarse solos.
-- =====================================================================

create table if not exists public.reservas_complejopm_bloqueos (
  id               uuid primary key default gen_random_uuid(),
  complejo         text not null check (complejo in ('complejopm')),
  canchas          text[],                       -- null = todas
  desde            date not null,
  hasta            date not null,
  horas            text[],                       -- null = todo el día
  motivo           text not null check (motivo in ('reparacion', 'evento', 'torneo', 'clases', 'otro')),
  nota             text check (nota is null or char_length(nota) <= 60),
  creado_por       text,
  creado           timestamptz not null default now(),
  actualizado_por  text,
  actualizado      timestamptz not null default now(),
  check (hasta >= desde)
);
create index if not exists reservas_complejopm_bloqueos_complejo_fechas on public.reservas_complejopm_bloqueos (complejo, hasta, desde);

alter table public.reservas_complejopm_bloqueos enable row level security;
drop policy if exists "reservas_complejopm_bloqueos lectura publica" on public.reservas_complejopm_bloqueos;
create policy "reservas_complejopm_bloqueos lectura publica"
  on public.reservas_complejopm_bloqueos for select to anon, authenticated using (true);
grant select on table public.reservas_complejopm_bloqueos to anon, authenticated;

-- ¿Ese turno está bloqueado?
create or replace function public.reservas_complejopm__bloqueado(p_complejo text, p_cancha text, p_fecha date, p_hora text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reservas_complejopm_bloqueos b
     where b.complejo = p_complejo
       and p_fecha between b.desde and b.hasta
       and (b.canchas is null or p_cancha = any (b.canchas))
       and (b.horas is null or p_hora = any (b.horas))
  )
$$;

create or replace function public.reservas_complejopm__motivo_bloqueo(p_complejo text, p_cancha text, p_fecha date, p_hora text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case b.motivo when 'reparacion' then 'Reparación' when 'evento' then 'Evento' when 'torneo' then 'Torneo' when 'clases' then 'Clases' else 'Otro' end
    from public.reservas_complejopm_bloqueos b
   where b.complejo = p_complejo
     and p_fecha between b.desde and b.hasta
     and (b.canchas is null or p_cancha = any (b.canchas))
     and (b.horas is null or p_hora = any (b.horas))
   order by b.creado
   limit 1
$$;

create or replace function public.reservas_complejopm_set_estado(
  p_token    uuid,
  p_fecha    date,
  p_complejo text,
  p_cancha   text,
  p_hora     text,
  p_estado   text,
  p_para     text default null
)
returns public.reservas_complejopm_turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.reservas_complejopm__sesion(p_token);
  v_hoy    date := public.reservas_complejopm__hoy();
  v_para   text := nullif(left(trim(coalesce(p_para, '')), 40), '');
  v_fijo   uuid;
  v_fila   public.reservas_complejopm_turnos;
begin
  if p_fecha < v_hoy then
    raise exception 'Solo se puede reservar/cancelar turnos del día o posteriores.' using errcode = '22023';
  end if;
  if p_fecha > public.reservas_complejopm__fecha_maxima() then
    raise exception 'Solo se puede reservar hasta el último día del mes próximo.' using errcode = '22023';
  end if;
  if p_estado = 'reservada' and v_para is null then
    raise exception 'Indicá para quién es la reserva.' using errcode = '22023';
  end if;
  if p_estado = 'reservada' and public.reservas_complejopm__bloqueado(p_complejo, p_cancha, p_fecha, p_hora) then
    raise exception 'Ese turno no está disponible: está bloqueado (reparación, evento u otro motivo).' using errcode = '22023';
  end if;

  select fijo_id into v_fijo
    from public.reservas_complejopm_turnos
   where fecha = p_fecha and complejo = p_complejo and cancha = p_cancha and hora = p_hora;

  -- una reserva a mano nunca queda atada a un fijo
  insert into public.reservas_complejopm_turnos
         (fecha, complejo, cancha, hora, estado, actualizado_por, actualizado, reservado_para, fijo_id)
  values (p_fecha, p_complejo, p_cancha, p_hora, p_estado, v_nombre, now(),
          case when p_estado = 'reservada' then v_para end, null)
  on conflict (fecha, complejo, cancha, hora)
  do update set estado          = excluded.estado,
                actualizado_por = excluded.actualizado_por,
                actualizado     = excluded.actualizado,
                reservado_para  = excluded.reservado_para,
                fijo_id         = null
  returning * into v_fila;

  -- liberar una fecha de un fijo: se anota para que no se vuelva a reservar sola
  if p_estado = 'libre' and v_fijo is not null then
    insert into public.reservas_complejopm_fijos_excepciones (fijo_id, fecha)
    values (v_fijo, p_fecha)
    on conflict do nothing;
  end if;

  -- limpieza: lo más viejo que el historial se borra solo
  delete from public.reservas_complejopm_turnos
   where fecha < v_hoy - public.reservas_complejopm__dias_historia();

  return v_fila;
end;
$$;

create or replace function public.reservas_complejopm__fijo_materializar(p_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := public.reservas_complejopm__hoy();
  v_fin date := public.reservas_complejopm__fecha_maxima();
  v_n   int;
begin
  insert into public.reservas_complejopm_turnos
         (fecha, complejo, cancha, hora, estado, actualizado_por, actualizado, reservado_para, fijo_id)
  select d.fecha, f.complejo, f.cancha, f.hora, 'reservada',
         coalesce(f.actualizado_por, f.creado_por, 'Turno fijo'), now(), f.para, f.id
    from public.reservas_complejopm_fijos f
   cross join lateral (
         select g::date as fecha
           from generate_series(greatest(f.desde, v_hoy), least(coalesce(f.hasta, v_fin), v_fin), interval '1 day') g
        ) d
   where f.id = p_id
     and extract(dow from d.fecha) = f.dia_semana
     and public.reservas_complejopm__futuro(d.fecha, f.hora)
     and not exists (select 1 from public.reservas_complejopm_fijos_excepciones e
                      where e.fijo_id = f.id and e.fecha = d.fecha)
     and not public.reservas_complejopm__bloqueado(f.complejo, f.cancha, d.fecha, f.hora)
  on conflict (fecha, complejo, cancha, hora) do update
     set estado          = 'reservada',
         actualizado_por = excluded.actualizado_por,
         actualizado     = excluded.actualizado,
         reservado_para  = excluded.reservado_para,
         fijo_id         = excluded.fijo_id
   where public.reservas_complejopm_turnos.estado <> 'reservada';   -- ocupado: se saltea

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.reservas_complejopm_fijo_previsualizar(
  p_complejo text,
  p_canchas  text[],
  p_cancha   text,
  p_dia      smallint,
  p_hora     text,
  p_desde    date,
  p_hasta    date default null,
  p_excluir  uuid default null
)
returns table (dia date, libres text[], ocupado_por text, ocupado_para text, ocupado_fijo boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ventana as (
    select public.reservas_complejopm__hoy() as hoy,
           public.reservas_complejopm__fecha_maxima() as fin
  ),
  dias as (
    select g::date as fecha
      from ventana v,
           generate_series(greatest(p_desde, v.hoy), least(coalesce(p_hasta, v.fin), v.fin), interval '1 day') g
     where extract(dow from g) = p_dia
       and public.reservas_complejopm__futuro(g::date, p_hora)
  ),
  ocup as (
    select t.fecha, t.cancha, t.actualizado_por, t.reservado_para, t.fijo_id
      from public.reservas_complejopm_turnos t
      join dias d on d.fecha = t.fecha
     where t.complejo = p_complejo
       and t.hora = p_hora
       and t.estado = 'reservada'
       and (p_excluir is null or t.fijo_id is distinct from p_excluir)
    union all
    -- turnos bloqueados (reparación, evento...): ocupados para el fijo
    select d.fecha, c.cancha, 'Bloqueo', public.reservas_complejopm__motivo_bloqueo(p_complejo, c.cancha, d.fecha, p_hora), null::uuid
      from dias d cross join unnest(p_canchas) as c(cancha)
     where public.reservas_complejopm__bloqueado(p_complejo, c.cancha, d.fecha, p_hora)
  )
  select d.fecha,
         array(select u.c
                 from unnest(p_canchas) with ordinality u(c, pos)
                where not exists (select 1 from ocup x where x.fecha = d.fecha and x.cancha = u.c)
                order by u.pos),
         o.actualizado_por,
         o.reservado_para,
         o.fijo_id is not null
    from dias d
    left join ocup o on o.fecha = d.fecha and o.cancha = p_cancha
   order by d.fecha;
$$;

-- Qué reservas y fijos chocan con un bloqueo (antes de guardarlo).
-- p_canchas null = todas; p_horas null = todo el día.
-- Devuelve las reservas de hoy en adelante (que no empezaron) y, aparte, las fechas de fijos
-- que caen dentro del bloqueo más allá de lo ya reservado (para avisar igual).
create or replace function public.reservas_complejopm_bloqueo_previsualizar(
  p_complejo text,
  p_canchas  text[],
  p_desde    date,
  p_hasta    date,
  p_horas    text[] default null
)
returns table (fecha date, cancha text, hora text, para text, cargo text, fijo boolean, futuro_fijo boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- reservas ya cargadas (incluye las de fijos dentro de la ventana)
  select t.fecha, t.cancha, t.hora, t.reservado_para, t.actualizado_por, t.fijo_id is not null, false
    from public.reservas_complejopm_turnos t
   where t.complejo = p_complejo
     and t.estado = 'reservada'
     and t.fecha between p_desde and p_hasta
     and (p_canchas is null or t.cancha = any (p_canchas))
     and (p_horas is null or t.hora = any (p_horas))
     and public.reservas_complejopm__futuro(t.fecha, t.hora)
  union all
  -- fechas de fijos todavía no reservadas (más allá de la ventana) que caen en el bloqueo
  select g::date, f.cancha, f.hora, f.para, f.creado_por, true, true
    from public.reservas_complejopm_fijos f
   cross join generate_series(greatest(p_desde, public.reservas_complejopm__fecha_maxima() + 1), p_hasta, interval '1 day') g
   where f.complejo = p_complejo
     and extract(dow from g) = f.dia_semana
     and g::date >= f.desde and (f.hasta is null or g::date <= f.hasta)
     and (p_canchas is null or f.cancha = any (p_canchas))
     and (p_horas is null or f.hora = any (p_horas))
     and not exists (select 1 from public.reservas_complejopm_fijos_excepciones e where e.fijo_id = f.id and e.fecha = g::date)
  order by 1, 3, 2;
$$;

-- Crea (p_id null) o edita un bloqueo, libera lo que choca y devuelve el id.
create or replace function public.reservas_complejopm_bloqueo_guardar(
  p_token    uuid,
  p_id       uuid,
  p_complejo text,
  p_canchas  text[],
  p_desde    date,
  p_hasta    date,
  p_horas    text[],
  p_motivo   text,
  p_nota     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.reservas_complejopm__sesion(p_token);
  v_nota   text := nullif(left(trim(coalesce(p_nota, '')), 60), '');
  v_canch  text[] := case when p_canchas is null or cardinality(p_canchas) = 0 then null else p_canchas end;
  v_horas  text[] := case when p_horas is null or cardinality(p_horas) = 0 then null else p_horas end;
  v_id     uuid;
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Revisá las fechas: "hasta" no puede ser anterior a "desde".' using errcode = '22023';
  end if;
  if p_hasta < public.reservas_complejopm__hoy() then
    raise exception 'El bloqueo tiene que incluir hoy o días posteriores.' using errcode = '22023';
  end if;
  if p_motivo not in ('reparacion', 'evento', 'torneo', 'clases', 'otro') then
    raise exception 'Elegí un motivo.' using errcode = '22023';
  end if;
  if v_horas is not null and exists (select 1 from unnest(v_horas) h where h !~ '^[0-2][0-9]:[0-5][0-9]$') then
    raise exception 'Hay un turno con formato inválido.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.reservas_complejopm_bloqueos (complejo, canchas, desde, hasta, horas, motivo, nota, creado_por, actualizado_por)
    values (p_complejo, v_canch, p_desde, p_hasta, v_horas, p_motivo, v_nota, v_nombre, v_nombre)
    returning id into v_id;
  else
    update public.reservas_complejopm_bloqueos
       set complejo = p_complejo, canchas = v_canch, desde = p_desde, hasta = p_hasta, horas = v_horas,
           motivo = p_motivo, nota = v_nota, actualizado_por = v_nombre, actualizado = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Ese bloqueo ya no existe.' using errcode = '22023';
    end if;
  end if;

  -- liberar lo que choca (de fijos, solo esa fecha: el fijo no lo vuelve a tomar mientras esté bloqueado)
  update public.reservas_complejopm_turnos t
     set estado = 'libre', reservado_para = null, fijo_id = null,
         actualizado_por = v_nombre, actualizado = now()
   where t.complejo = p_complejo
     and t.estado = 'reservada'
     and t.fecha between p_desde and p_hasta
     and (v_canch is null or t.cancha = any (v_canch))
     and (v_horas is null or t.hora = any (v_horas))
     and public.reservas_complejopm__futuro(t.fecha, t.hora);

  -- si se achicó un bloqueo, los fijos vuelven a tomar lo que quedó libre
  perform public.reservas_complejopm__fijos_sincronizar_todos();
  return v_id;
end;
$$;

create or replace function public.reservas_complejopm_bloqueo_eliminar(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reservas_complejopm__sesion(p_token);
  delete from public.reservas_complejopm_bloqueos where id = p_id;
  -- los fijos vuelven a reservarse solos en lo que se desbloqueó
  perform public.reservas_complejopm__fijos_sincronizar_todos();
end;
$$;

revoke all on function public.reservas_complejopm__bloqueado(text, text, date, text) from public;
revoke all on function public.reservas_complejopm__motivo_bloqueo(text, text, date, text) from public;
revoke all on function public.reservas_complejopm_bloqueo_previsualizar(text, text[], date, date, text[]) from public;
revoke all on function public.reservas_complejopm_bloqueo_guardar(uuid, uuid, text, text[], date, date, text[], text, text) from public;
revoke all on function public.reservas_complejopm_bloqueo_eliminar(uuid, uuid) from public;
grant execute on function public.reservas_complejopm_bloqueo_previsualizar(text, text[], date, date, text[]) to anon, authenticated;
grant execute on function public.reservas_complejopm_bloqueo_guardar(uuid, uuid, text, text[], date, date, text[], text, text) to anon, authenticated;
grant execute on function public.reservas_complejopm_bloqueo_eliminar(uuid, uuid) to anon, authenticated;
revoke all on function public.reservas_complejopm_set_estado(uuid, date, text, text, text, text, text) from public;
grant execute on function public.reservas_complejopm_set_estado(uuid, date, text, text, text, text, text) to anon, authenticated;

-- Tiempo real: los bloqueos aparecen al instante en todos los celus
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas_complejopm_bloqueos') then
    alter publication supabase_realtime add table public.reservas_complejopm_bloqueos;
  end if;
end $$;

-- motivos (migración 003): por si la tabla ya existía con el control viejo
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.reservas_complejopm_bloqueos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%motivo%'
  loop
    execute format('alter table public.reservas_complejopm_bloqueos drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.reservas_complejopm_bloqueos
  add constraint reservas_complejopm_bloqueos_motivo_check
  check (motivo in ('reparacion', 'evento', 'torneo', 'clases', 'otro'));
-- ============================================================================
-- Who pays (docs/people-in-two-capacities-proposal.md §B).
--
-- A purchase knows its payer PERSON (person_id / payer_email). It now also
-- knows the ORGANISATION that paid, when one did: purchase.payer_org_id.
-- That is what gives an organisation its Invoices tab and "everything EBBF
-- bought" without string-matching company names in jsonb.
--
-- Public checkout is anonymous, so a buyer is never shown a list of
-- organisations (that would tell anyone who typed an address where its owner
-- works). They type the company on the invoice form, as before, and the server
-- links it to an EXISTING organisation only on an unambiguous match:
--   1. the VAT / tax number (organisation.vat_number or org_billing.tax_id),
--      compared as letters and digits only — exactly one organisation;
--   2. otherwise the name, compared case- and space-insensitively against
--      name, legal name, abbreviation and other names — exactly one.
-- No match, or more than one: the purchase keeps its billing snapshot and no
-- link. Nothing is ever created from a public form.
--
-- The billing snapshot stays the invoice of record; payer_org_id is the link.
-- ============================================================================

alter table public.purchase
  add column if not exists payer_org_id uuid references public.organisation(id) on delete set null;

comment on column public.purchase.payer_org_id is
  'The organisation that paid, when one did. Set by the caller when known (a membership held by an organisation) or matched from the invoice company / tax number. See 20260915100000.';

create index if not exists purchase_payer_org_idx
  on public.purchase (workspace_id, payer_org_id) where payer_org_id is not null;

create or replace function public.organisation_match_payer(
  p_workspace uuid,
  p_company text,
  p_tax text
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tax  text := nullif(upper(regexp_replace(coalesce(p_tax, ''), '[^A-Za-z0-9]', '', 'g')), '');
  v_name text := nullif(lower(btrim(regexp_replace(coalesce(p_company, ''), '\s+', ' ', 'g'))), '');
  v_ids  uuid[];
begin
  if v_tax is not null and length(v_tax) >= 5 then
    select array_agg(distinct o.id) into v_ids
      from public.organisation o
      left join public.org_billing ob on ob.org_id = o.id
     where o.workspace_id = p_workspace
       and o.deleted_at is null
       and (upper(regexp_replace(coalesce(o.vat_number, ''), '[^A-Za-z0-9]', '', 'g')) = v_tax
         or upper(regexp_replace(coalesce(ob.tax_id::text, ''), '[^A-Za-z0-9]', '', 'g')) = v_tax);
    if coalesce(array_length(v_ids, 1), 0) = 1 then
      return v_ids[1];
    end if;
  end if;

  if v_name is not null then
    select array_agg(distinct o.id) into v_ids
      from public.organisation o
     where o.workspace_id = p_workspace
       and o.deleted_at is null
       and (
         lower(btrim(regexp_replace(o.name, '\s+', ' ', 'g'))) = v_name
         or lower(btrim(regexp_replace(coalesce(o.legal_name, ''), '\s+', ' ', 'g'))) = v_name
         or lower(btrim(coalesce(o.short_name, ''))) = v_name
         or exists (
           select 1 from unnest(coalesce(o.other_names, '{}'::text[])) n
            where lower(btrim(regexp_replace(n, '\s+', ' ', 'g'))) = v_name
         )
       );
    if coalesce(array_length(v_ids, 1), 0) = 1 then
      return v_ids[1];
    end if;
  end if;

  return null;
end
$$;

revoke execute on function public.organisation_match_payer(uuid, text, text) from public, anon, authenticated;
grant execute on function public.organisation_match_payer(uuid, text, text) to service_role;

-- Existing invoices that named a company.
update public.purchase p
   set payer_org_id = public.organisation_match_payer(p.workspace_id, p.billing ->> 'company', p.billing ->> 'tax_no')
 where p.payer_org_id is null
   and p.billing is not null
   and coalesce(p.billing ->> 'payer', '') <> 'self'
   and (coalesce(p.billing ->> 'company', '') <> '' or coalesce(p.billing ->> 'tax_no', '') <> '');

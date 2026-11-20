create table if not exists public.business_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null check (char_length(btrim(client_name)) between 1 and 160),
  company_name text not null default '' check (char_length(company_name) <= 160),
  contact_number text not null default '' check (char_length(contact_number) <= 30),
  email text not null default '' check (char_length(email) <= 254),
  address text not null default '' check (char_length(address) <= 1000),
  gst_number text not null default '' check (char_length(gst_number) <= 40),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.business_suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_name text not null check (char_length(btrim(supplier_name)) between 1 and 160),
  contact_number text not null default '' check (char_length(contact_number) <= 30),
  email text not null default '' check (char_length(email) <= 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, supplier_name)
);

create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null check (char_length(btrim(product_name)) between 1 and 160),
  sku text not null default '' check (char_length(sku) <= 80),
  category text not null default '' check (char_length(category) <= 100),
  description text not null default '' check (char_length(description) <= 2000),
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  available_stock numeric(14,3) check (available_stock is null or available_stock >= 0),
  supplier_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (supplier_id, user_id) references public.business_suppliers(id, user_id) on delete set null (supplier_id)
);

create unique index if not exists business_products_user_sku_idx
  on public.business_products (user_id, sku) where sku <> '';
create index if not exists business_products_user_name_idx
  on public.business_products (user_id, product_name);
create index if not exists business_clients_user_name_idx
  on public.business_clients (user_id, client_name);

create table if not exists public.business_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  order_date date not null default current_date,
  status text not null default 'ACCEPTED' check (status in ('ACCEPTED', 'PO', 'DELIVERED')),
  accepted_at timestamptz not null default now(),
  order_value numeric(14,2) not null default 0 check (order_value >= 0),
  advance_payment numeric(14,2) not null default 0 check (advance_payment >= 0),
  po_number text not null default '' check (char_length(po_number) <= 100),
  po_date date,
  supplier_id uuid,
  po_amount numeric(14,2) not null default 0 check (po_amount >= 0),
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  expected_delivery_date date,
  actual_delivery_date date,
  delivery_quantity numeric(14,3) not null default 0 check (delivery_quantity >= 0),
  delivery_confirmation text not null default '' check (char_length(delivery_confirmation) <= 1000),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (client_id, user_id) references public.business_clients(id, user_id) on delete restrict,
  foreign key (supplier_id, user_id) references public.business_suppliers(id, user_id) on delete set null (supplier_id)
);

create index if not exists business_orders_user_date_idx
  on public.business_orders (user_id, order_date desc);
create index if not exists business_orders_user_status_idx
  on public.business_orders (user_id, status);
create index if not exists business_orders_client_idx
  on public.business_orders (client_id, order_date desc);

create table if not exists public.business_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null,
  product_id uuid,
  product_name text not null check (char_length(btrim(product_name)) between 1 and 160),
  product_description text not null default '' check (char_length(product_description) <= 2000),
  quantity numeric(14,3) not null check (quantity > 0),
  delivered_quantity numeric(14,3) not null default 0 check (delivered_quantity >= 0),
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, user_id) references public.business_orders(id, user_id) on delete cascade,
  foreign key (product_id, user_id) references public.business_products(id, user_id) on delete set null (product_id),
  check (delivered_quantity <= quantity)
);

create index if not exists business_order_items_user_order_idx
  on public.business_order_items (user_id, order_id);
create index if not exists business_order_items_product_idx
  on public.business_order_items (product_id);

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_name text not null check (char_length(btrim(expense_name)) between 1 and 160),
  category text not null check (category in ('Raw Materials', 'Manufacturing', 'Transportation', 'Packaging', 'Labour', 'Marketing', 'Maintenance', 'Other Expenses')),
  order_id uuid,
  product_id uuid,
  expense_date date not null default current_date,
  amount numeric(14,2) not null check (amount >= 0),
  payment_method text not null default '' check (char_length(payment_method) <= 80),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, user_id) references public.business_orders(id, user_id) on delete set null (order_id),
  foreign key (product_id, user_id) references public.business_products(id, user_id) on delete set null (product_id)
);

create index if not exists business_expenses_user_date_idx
  on public.business_expenses (user_id, expense_date desc);
create index if not exists business_expenses_order_idx
  on public.business_expenses (order_id);

create table if not exists public.business_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null,
  payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default '' check (char_length(payment_method) <= 80),
  reference text not null default '' check (char_length(reference) <= 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (order_id, user_id) references public.business_orders(id, user_id) on delete cascade
);

create table if not exists public.business_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null,
  supplier_id uuid,
  po_number text not null check (char_length(btrim(po_number)) between 1 and 100),
  po_date date not null default current_date,
  po_amount numeric(14,2) not null default 0 check (po_amount >= 0),
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, po_number),
  foreign key (order_id, user_id) references public.business_orders(id, user_id) on delete cascade,
  foreign key (supplier_id, user_id) references public.business_suppliers(id, user_id) on delete set null (supplier_id)
);

create table if not exists public.business_order_status_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null,
  from_status text check (from_status is null or from_status in ('ACCEPTED', 'PO', 'DELIVERED')),
  to_status text not null check (to_status in ('ACCEPTED', 'PO', 'DELIVERED')),
  changed_at timestamptz not null default now(),
  foreign key (order_id, user_id) references public.business_orders(id, user_id) on delete cascade
);

create index if not exists business_payments_user_order_idx
  on public.business_payments (user_id, order_id, payment_date desc);
create index if not exists business_status_history_order_idx
  on public.business_order_status_history (user_id, order_id, changed_at desc);

create or replace function public.business_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_clients', 'business_suppliers', 'business_products',
    'business_orders', 'business_order_items', 'business_expenses'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function public.business_touch_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.business_record_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.business_order_status_history (user_id, order_id, from_status, to_status)
    values (new.user_id, new.id, case when tg_op = 'INSERT' then null else old.status end, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists business_order_status_audit on public.business_orders;
create trigger business_order_status_audit
  after insert or update on public.business_orders
  for each row execute function public.business_record_order_status();

create or replace function public.business_save_order(
  p_order_id uuid,
  p_order jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_item jsonb;
  v_order_value numeric(14,2) := 0;
  v_purchase_cost numeric(14,2) := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_order) <> 'object' or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'An order must include between 1 and 100 product lines' using errcode = '22023';
  end if;

  if p_order_id is null then
    insert into public.business_orders (
      user_id, client_id, order_date, status, order_value, advance_payment,
      po_number, po_date, supplier_id, po_amount, purchase_cost,
      expected_delivery_date, actual_delivery_date, delivery_quantity,
      delivery_confirmation, notes
    ) values (
      v_user_id, (p_order->>'clientId')::uuid,
      coalesce(nullif(p_order->>'orderDate', '')::date, current_date),
      coalesce(nullif(p_order->>'status', ''), 'ACCEPTED'),
      coalesce(nullif(p_order->>'orderValue', '')::numeric, 0),
      coalesce(nullif(p_order->>'advancePayment', '')::numeric, 0),
      coalesce(p_order->>'poNumber', ''), nullif(p_order->>'poDate', '')::date,
      nullif(p_order->>'supplierId', '')::uuid,
      coalesce(nullif(p_order->>'poAmount', '')::numeric, 0),
      coalesce(nullif(p_order->>'purchaseCost', '')::numeric, 0),
      nullif(p_order->>'expectedDeliveryDate', '')::date,
      nullif(p_order->>'actualDeliveryDate', '')::date,
      coalesce(nullif(p_order->>'deliveryQuantity', '')::numeric, 0),
      coalesce(p_order->>'deliveryConfirmation', ''),
      coalesce(p_order->>'notes', '')
    ) returning id into v_order_id;
  else
    update public.business_orders set
      client_id = (p_order->>'clientId')::uuid,
      order_date = coalesce(nullif(p_order->>'orderDate', '')::date, current_date),
      status = coalesce(nullif(p_order->>'status', ''), 'ACCEPTED'),
      order_value = coalesce(nullif(p_order->>'orderValue', '')::numeric, 0),
      advance_payment = coalesce(nullif(p_order->>'advancePayment', '')::numeric, 0),
      po_number = coalesce(p_order->>'poNumber', ''),
      po_date = nullif(p_order->>'poDate', '')::date,
      supplier_id = nullif(p_order->>'supplierId', '')::uuid,
      po_amount = coalesce(nullif(p_order->>'poAmount', '')::numeric, 0),
      purchase_cost = coalesce(nullif(p_order->>'purchaseCost', '')::numeric, 0),
      expected_delivery_date = nullif(p_order->>'expectedDeliveryDate', '')::date,
      actual_delivery_date = nullif(p_order->>'actualDeliveryDate', '')::date,
      delivery_quantity = coalesce(nullif(p_order->>'deliveryQuantity', '')::numeric, 0),
      delivery_confirmation = coalesce(p_order->>'deliveryConfirmation', ''),
      notes = coalesce(p_order->>'notes', '')
    where id = p_order_id and user_id = v_user_id
    returning id into v_order_id;
    if v_order_id is null then
      raise exception 'Order not found' using errcode = 'P0002';
    end if;
    delete from public.business_order_items
      where order_id = v_order_id and user_id = v_user_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_order_value := v_order_value
      + (v_item->>'quantity')::numeric * (v_item->>'sellingPrice')::numeric;
    v_purchase_cost := v_purchase_cost
      + (v_item->>'quantity')::numeric * (v_item->>'purchaseCost')::numeric;
    insert into public.business_order_items (
      user_id, order_id, product_id, product_name, product_description,
      quantity, delivered_quantity, purchase_cost, selling_price
    ) values (
      v_user_id, v_order_id, nullif(v_item->>'productId', '')::uuid,
      btrim(v_item->>'productName'), coalesce(v_item->>'description', ''),
      (v_item->>'quantity')::numeric,
      coalesce(nullif(v_item->>'deliveredQuantity', '')::numeric,
        case when coalesce(p_order->>'status', 'ACCEPTED') = 'DELIVERED'
          then (v_item->>'quantity')::numeric else 0 end),
      coalesce(nullif(v_item->>'purchaseCost', '')::numeric, 0),
      coalesce(nullif(v_item->>'sellingPrice', '')::numeric, 0)
    );
  end loop;
  update public.business_orders set
    order_value = v_order_value,
    purchase_cost = v_purchase_cost
  where id = v_order_id and user_id = v_user_id;

  if nullif(btrim(coalesce(p_order->>'poNumber', '')), '') is not null then
    insert into public.business_purchase_orders (
      user_id, order_id, supplier_id, po_number, po_date, po_amount, purchase_cost
    ) values (
      v_user_id, v_order_id,
      nullif(p_order->>'supplierId', '')::uuid,
      btrim(p_order->>'poNumber'),
      coalesce(nullif(p_order->>'poDate', '')::date, current_date),
      coalesce(nullif(p_order->>'poAmount', '')::numeric, 0),
      v_purchase_cost
    )
    on conflict (user_id, po_number) do update set
      order_id = excluded.order_id,
      supplier_id = excluded.supplier_id,
      po_date = excluded.po_date,
      po_amount = excluded.po_amount,
      purchase_cost = excluded.purchase_cost;
  end if;
  return v_order_id;
end;
$$;

create or replace function public.business_change_order_status(
  p_order_id uuid,
  p_status text,
  p_actual_delivery_date date default null
)
returns public.business_orders
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.business_orders;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_status not in ('ACCEPTED', 'PO', 'DELIVERED') then
    raise exception 'Choose ACCEPTED, PO, or DELIVERED' using errcode = '22023';
  end if;

  update public.business_orders
  set status = p_status,
      actual_delivery_date = case
        when p_status = 'DELIVERED' then coalesce(p_actual_delivery_date, current_date)
        else actual_delivery_date
      end
  where id = p_order_id and user_id = v_user_id
  returning * into v_order;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if p_status = 'DELIVERED' then
    update public.business_order_items
    set delivered_quantity = quantity
    where order_id = p_order_id and user_id = v_user_id;
    update public.business_orders
    set delivery_quantity = (
      select coalesce(sum(delivered_quantity), 0)
      from public.business_order_items
      where order_id = p_order_id and user_id = v_user_id
    )
    where id = p_order_id and user_id = v_user_id
    returning * into v_order;
  end if;
  return v_order;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_clients', 'business_suppliers', 'business_products',
    'business_orders', 'business_order_items', 'business_expenses',
    'business_payments', 'business_purchase_orders', 'business_order_status_history'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    if table_name = 'business_order_status_history' then
      execute format('grant select on table public.%I to authenticated', table_name);
    else
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
    execute format('grant all on table public.%I to service_role', table_name);
    execute format(
      'drop policy if exists %I_own on public.%I',
      table_name, table_name
    );
    execute format(
      'create policy %I_own on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      table_name, table_name
    );
  end loop;
end;
$$;

revoke all on function public.business_save_order(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.business_save_order(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.business_change_order_status(uuid, text, date) from public, anon;
grant execute on function public.business_change_order_status(uuid, text, date) to authenticated;
revoke all on function public.business_record_order_status() from public, anon, authenticated;

grant usage, select on sequence public.business_order_status_history_id_seq to authenticated;

notify pgrst, 'reload schema';

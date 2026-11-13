-- Pedidos ficticios para ver el mapa de calor en "Feria Prueba (No llenar)".
-- Todos llevan nota 'DEMO-CALOR' para poder borrarlos después.
do $$
declare
  v_feria uuid;
  v_num   int;
  v_dia   date;
  v_di    int := 0;
  v_h     int;
  v_n     int;
  v_k     int;
  v_ts    timestamptz;
  v_ord   uuid;
  v_tot   numeric;
  v_items int;
  v_p     record;
  v_q     int;
  v_opts  jsonb;
  v_sal   text[];
  v_pagos text[] := array['qr','qr','qrpos','tarjeta','efectivo'];
  v_nombres text[] := array['Ana','Luis','Carla','Diego','Sofía','Mateo','Valeria','Jorge','Lucía','Bruno','Camila','Renzo','Mía','Piero','Fiorella','Andrés','Rosa','Kevin','Daniela','Héctor'];
  v_salsas text[] := array['Kétchup','Mayonesa','Mostaza','Ají','Tártara','Salsa hamburguesa'];
  -- peso por hora (12h..22h): mediodía flojo, pico 19-20h
  v_peso  int[] := array[2,4,5,3,2,4,7,12,10,6,3];
  v_fact  numeric[] := array[0.7, 1.0, 1.4];
begin
  select id into v_feria from public.ferias where nombre ilike '%prueba%' order by fecha_inicio desc limit 1;
  if v_feria is null then raise exception 'No encontré la feria de prueba'; end if;
  select coalesce(max(numero), 0) into v_num from public.ordenes where feria_id = v_feria;

  foreach v_dia in array array['2026-11-10'::date, '2026-11-11'::date, '2026-11-12'::date] loop
    v_di := v_di + 1;
    for v_h in 12..22 loop
      v_n := greatest(0, round(v_peso[v_h - 11] * v_fact[v_di] + (random() * 2 - 1))::int);
      for v_k in 1..v_n loop
        v_num := v_num + 1;
        v_ts  := ((v_dia + make_time(v_h, floor(random() * 60)::int, 0)) at time zone 'America/Lima');
        insert into public.ordenes (feria_id, numero, dia, medio_pago, total, estado, nota, cliente, pos_ok,
                                    creado_en, iniciada_en, lista_en, entregada_en)
        values (v_feria, v_num, v_dia, v_pagos[1 + floor(random() * 5)::int], 0, 'entregado', 'DEMO-CALOR',
                v_nombres[1 + floor(random() * 20)::int], true,
                v_ts, v_ts + interval '1 minute' * (1 + random() * 3),
                v_ts + interval '1 minute' * (6 + random() * 6), v_ts + interval '1 minute' * (9 + random() * 6))
        returning id into v_ord;

        v_tot := 0;
        v_items := 1 + floor(random() * 3)::int;
        for v_p in (select * from public.productos where activo order by random() limit v_items) loop
          v_q := 1 + floor(random() * 2)::int;
          select coalesce(jsonb_object_agg(g->>'id', g->'valores'->>(floor(random() * jsonb_array_length(g->'valores')))::int), '{}'::jsonb)
            into v_opts
            from jsonb_array_elements(coalesce(v_p.opciones, '[]'::jsonb)) g;
          v_sal := case when v_p.lleva_salsas
                        then array[v_salsas[1 + floor(random() * 6)::int], v_salsas[1 + floor(random() * 6)::int]]
                        else '{}'::text[] end;
          insert into public.orden_items (orden_id, sku, nombre, categoria, cantidad, precio, subtotal, opciones, salsas)
          values (v_ord, v_p.sku, v_p.nombre, v_p.categoria, v_q, v_p.precio, v_p.precio * v_q, v_opts,
                  (select coalesce(array_agg(distinct s), '{}') from unnest(v_sal) s));
          v_tot := v_tot + v_p.precio * v_q;
        end loop;
        update public.ordenes set total = v_tot where id = v_ord;
      end loop;
    end loop;
  end loop;
end $$;

select dia, count(*) as pedidos, sum(total) as venta
from public.ordenes where nota = 'DEMO-CALOR' group by dia order by dia;

-- Para BORRAR estos pedidos de prueba (los items se borran solos por cascada):
-- delete from public.ordenes where nota = 'DEMO-CALOR';

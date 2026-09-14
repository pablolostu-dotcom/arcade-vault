-- SPEC 10 — La decimotercera fila del catálogo: ABISMO, el quinto juego jugable
-- y el primero que sale de una game jam (tema: «el fondo del mar»). `games`
-- tiene RLS con una única política de SELECT: sin política de INSERT la
-- operación queda negada para todos, así que la fila entra por acá y por ningún
-- otro camino. `sort_order` 13 es el más alto de hoy (12, `snake`) más uno.
-- `cat` y `color` salen de los valores de los CHECK constraints; no se agrega
-- ninguno. `SHOOTER` es la categoría más flaca del catálogo (3 de 12) y
-- `magenta` el único acento que ningún SHOOTER usa hoy: `invasores` es verde,
-- `rocas` amarillo y `asteroides` cyan. El agua se pinta cyan igual, en el
-- fondo de la portada; el acento de la tarjeta es el color del jugador.
-- Ninguna tarjeta mock se toca: no hay ninguna acuática entre las doce.

insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('abismo', 'ABISMO',
        'Rescata buzos del abismo antes de que se acabe el aire.',
        'Un submarino de bolsillo baja a un corte del océano de seis carriles, entre tiburones y submarinos enemigos que lo cruzan sin descanso. El tanque da cincuenta segundos de aire y solo se recarga en la superficie, que es también el único lugar donde los buzos se cobran. Cada buzo que subís multiplica el rescate por sí mismo: seis valen treinta y seis veces uno, y bajar a buscar el sexto es siempre la decisión que te mata.',
        'SHOOTER', 'cover-abismo', 'magenta', 13);

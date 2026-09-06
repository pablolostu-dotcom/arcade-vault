-- SPEC 08 — La undécima fila del catálogo: ARKANOID, el tercer juego jugable.
-- `games` tiene RLS con una única política de SELECT: sin política de INSERT la
-- operación queda negada para todos, así que la fila entra por acá y por ningún
-- otro camino. `sort_order` 11 es el más alto de hoy (10, `tetris`) más uno.
-- `cat` y `color` salen de los valores de los CHECK constraints; no se agrega
-- ninguno. La fila mock `bloque-buster` no se toca: es otra tarjeta, con su
-- acento cyan y su portada `cover-bricks`.

insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('arkanoid', 'ARKANOID',
        'Rompe cinco muros de bloques con una paleta y una pelota.',
        'Una paleta de plasma defiende la base de un núcleo que rebota sin descanso. Cinco muros con patrones distintos —parrilla, pirámide, tablero, filas con huecos y marco con cruz— y la pelota un diez por ciento más rápida en cada uno. Tres vidas para limpiarlos todos: la que se escapa por abajo no vuelve.',
        'ARCADE', 'cover-arkanoid', 'magenta', 11);

-- SPEC 07 — La décima fila del catálogo: TETRIS, el segundo juego jugable.
-- `games` tiene RLS con una única política de SELECT: sin política de INSERT la
-- operación queda negada para todos, así que la fila entra por acá y por ningún
-- otro camino. `sort_order` 10 es el más alto del seed (9, `asteroides`) más uno.
-- `cat` y `color` salen de los valores de los CHECK constraints; no se agrega
-- ninguno. La fila mock `caida` no se toca: es otra tarjeta, con su propio
-- acento y su propia portada.

insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('tetris', 'TETRIS',
        'Encaja tetrominós y limpia líneas antes de tocar el techo.',
        'Ocho piezas caen sobre un pozo de diez columnas y veinte filas: rótalas con wall kicks, proyéctalas con la pieza fantasma y encástralas sin dejar huecos. Cada diez líneas sube el nivel y la caída se acelera hasta el límite. La partida termina cuando la pieza que aparece ya no encuentra sitio.',
        'PUZZLE', 'cover-tetris', 'cyan', 10);

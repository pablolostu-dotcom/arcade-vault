-- SPEC 09 — La duodécima fila del catálogo: SNAKE, el cuarto juego jugable y el
-- primero diseñado desde cero. `games` tiene RLS con una única política de
-- SELECT: sin política de INSERT la operación queda negada para todos, así que
-- la fila entra por acá y por ningún otro camino. `sort_order` 12 es el más alto
-- de hoy (11, `arkanoid`) más uno. `cat` y `color` salen de los valores de los
-- CHECK constraints; no se agrega ninguno. La fila mock `serpentina` no se toca:
-- es otra tarjeta, con su acento verde, su `sort_order` 3 y su `cover-snake`.
-- La portada de esta es `.cover-serpiente` —amarilla, con recorrido y tres
-- frutas— porque `cover-snake` ya está ocupado y la columna `cover` es un nombre
-- de clase, no tiene por qué espejar el `id`.

insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('snake', 'SNAKE',
        'Come fruta en una grilla que se te va cerrando.',
        'Una serpiente de luz recorre un tablero de treinta y dos por veinticuatro celdas buscando fruta. Cada bocado la alarga y le acelera el paso, de ciento cuarenta milisegundos por tic hasta sesenta. Las frutas raras valen cinco veces más que las comunes y cada una suma tantos puntos como celdas mida la serpiente: el tablero se cierra justo cuando más conviene seguir.',
        'ARCADE', 'cover-serpiente', 'yellow', 12);

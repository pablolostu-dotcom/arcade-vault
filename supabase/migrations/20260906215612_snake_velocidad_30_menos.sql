-- Ajuste de balance de SNAKE: la serpiente arrancaba demasiado rápido al
-- probarla, así que el tic se hizo un 30 % más lento (la velocidad es 1/tic, o
-- sea dividir el tic por 0,7): de 140/4/60 ms a 200/6/85. El tramo de
-- aceleración sigue terminando en la fruta 20.
--
-- La columna `long` nombra los dos extremos, así que quedaba diciendo algo que
-- el juego ya no hace. `games` no tiene política de UPDATE —su única política es
-- de SELECT—, de modo que el texto se corrige por acá y por ningún otro camino.

update public.games
   set "long" = 'Una serpiente de luz recorre un tablero de treinta y dos por veinticuatro celdas buscando fruta. Cada bocado la alarga y le acelera el paso, de doscientos milisegundos por tic hasta ochenta y cinco. Las frutas raras valen cinco veces más que las comunes y cada una suma tantos puntos como celdas mida la serpiente: el tablero se cierra justo cuando más conviene seguir.'
 where id = 'snake';

# server-mototaxi (PostgreSQL + Prisma)

Backend que conecta **clientes** con **conductores** de mototaxi por **WhatsApp**, sin app móvil. Todo ocurre dentro de WhatsApp: el cliente comparte su ubicación, el sistema publica el pedido en un grupo de conductores con botones de ETA, y el primer conductor que responde se queda con el viaje.

Reescrito desde cero para **PostgreSQL 13+** usando **Prisma ORM** (reemplaza a Firebase/Firestore).

## Stack

- Node.js 18+ · Express 5
- PostgreSQL 13+ · Prisma ORM
- WhatsApp: **Green API** (grupo + privado) y **YCloud** (privado opcional)
- Google Maps Geocoding API (coordenadas → dirección)

## Requisitos

- Node.js 18 o superior
- PostgreSQL 13 o superior en marcha
- Instancia de Green API con un grupo de conductores
- (Opcional) Cuenta de YCloud para el chat privado
- API key de Google Maps con **Geocoding API** habilitada

## Instalación

```bash
npm install
cp .env.example .env      # y completa las variables
npm run prisma:generate   # genera el cliente Prisma
npm run prisma:migrate    # crea las tablas en PostgreSQL (dev)
# en producción: npm run prisma:deploy
```

## Configuración (.env)

Ver `.env.example`. Claves principales:

- `DATABASE_URL` — cadena de conexión de PostgreSQL.
- `GREENAPI_INSTANCE_ID`, `GREENAPI_API_TOKEN`, `GREENAPI_GROUP_CHAT_ID`.
- `WHATSAPP_CHATBOT_PROVIDER` = `greenapi` (def.) | `ycloud`.
- `YCLOUD_*` — solo si usas YCloud para el privado.
- `GOOGLE_MAPS_API_KEY`.

Averigua el chatId del grupo con:

```bash
npm run get-group-id
```

## Ejecutar

```bash
npm start          # producción
npm run dev        # desarrollo (--watch)
```

Con PM2:

```bash
pm2 start ecosystem.config.js
```

## Exponer el webhook (HTTPS)

- **Con dominio propio + HTTPS:** define `PUBLIC_URL=https://api.tudominio.com` en `.env` y ejecuta `npm run go` (registra el webhook). No necesitas ngrok.
- **Sin IP fija:** usa ngrok (`ngrok http 3001`) y luego `npm run tunnel` para registrar la URL. Recuerda el límite de 1 sesión del plan free (ERR_NGROK_334).

Green API webhook → `POST /webhook`
YCloud webhook → `POST /webhook/ycloud`

## Modelo de datos

Se unifican `pedidos` y `viajesAceptados` en una sola tabla `pedidos` con la columna `estado` (`pendiente` | `aceptado` | `finalizado` | `cancelado`). Ver `prisma/schema.prisma` y el SQL de referencia en `prisma/sql/schema.reference.sql`.

Tablas: `clientes`, `cliente_direcciones`, `conductores`, `pedidos`.

## Bloqueo atómico de asignación

El punto crítico del sistema. Reemplaza la transacción de Firestore por un `UPDATE ... WHERE estado='pendiente'` (en `pedidosRepo.aceptar`). Si `count = 0`, el pedido ya fue tomado por otro conductor. Garantiza que si dos conductores presionan casi a la vez, solo uno gana.

## Flujo

1. Cliente escribe → se le pide ubicación.
2. Cliente comparte ubicación → geocoding → se crea el pedido.
3. Se publica en el grupo con botones `⚡ 3` / `🕐 7` / `🕒 10` minutos.
4. Un conductor presiona un botón (`ok_<CODE>_<min>`) → asignación atómica.
5. Se notifica a cliente, conductor y grupo.

## Endpoints

- `POST /webhook` — Green API (cliente privado + grupo).
- `POST /webhook/ycloud` — YCloud (cliente), valida firma HMAC-SHA256.
- `GET /pedidos?estado=&limit=` — lista pedidos.
- `POST /conductores` · `GET /conductores` · `PATCH /conductores/:id` · `DELETE /conductores/:id`.
- `POST /clientes` · `GET /clientes/:telefono` · `POST /clientes/:telefono/direcciones`.

## Notas de migración desde Firebase

- El botón del grupo **solo funciona con Green API**.
- Formato del botón: `ok_<CODE>_<min>`; regex `^ok_([A-Z0-9]{6})_(\d+)$`. Si cambias el `pedidoCode`, actualiza la regex en `src/routes/webhook.js`.
- Los teléfonos se usan **sin** sufijo `@c.us` / `@g.us`. El ID de cliente/conductor es el teléfono.
- Esquema de conductor **unificado**: `phoneFull`, `fullName`, `plate`, `unit`, `estado`.

## Levantar todo con Docker (un solo comando)

Con Docker instalado:

```bash
cp .env.example .env      # completa las claves de WhatsApp / Google Maps
docker compose up --build
```

Esto arranca:

- `db` — PostgreSQL 13 (datos persistidos en el volumen `mototaxi_pgdata`).
- `app` — el backend, que aplica las migraciones (`prisma migrate deploy`) y escucha en `http://localhost:3001`.

Dentro de Docker el host de la BD es `db` (nombre del servicio), no `localhost`. Para desarrollo local sin Docker usa `localhost:5432` en tu `DATABASE_URL`.

Solo la BD (para correr la app o los tests en tu máquina):

```bash
docker compose up -d db
```

## Tests — bloqueo atómico de asignación

`test/atomic-lock.test.js` verifica el punto más crítico: que si **N conductores** presionan el botón casi a la vez sobre el mismo pedido, **solo uno gana**.

```bash
docker compose up -d db      # o tu propia PostgreSQL
npm run prisma:generate
npm run prisma:migrate       # crea las tablas
npm test                     # node --test test/
```

Comprueba que exactamente un intento paralelo devuelve el pedido y el resto `null`, que el estado final es `aceptado` con un único `conductorId`, y que un intento sobre un pedido ya tomado devuelve `null`.

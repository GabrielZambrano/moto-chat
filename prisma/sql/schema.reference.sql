-- =====================================================================
-- Esquema SQL de referencia (PostgreSQL 13+)
-- Prisma genera esto automaticamente con `prisma migrate`. Se incluye
-- solo como documentacion / para creacion manual sin Prisma.
-- =====================================================================

CREATE TYPE estado_conversacion AS ENUM ('ninguna', 'esperando_ubicacion');
CREATE TYPE estado_pedido       AS ENUM ('pendiente', 'aceptado', 'finalizado', 'cancelado');
CREATE TYPE estado_conductor    AS ENUM ('disponible', 'ocupado', 'inactivo');

CREATE TABLE clientes (
  telefono     TEXT PRIMARY KEY,
  nombre       TEXT,
  conversacion estado_conversacion NOT NULL DEFAULT 'ninguna',
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cliente_direcciones (
  id               SERIAL PRIMARY KEY,
  cliente_telefono TEXT NOT NULL REFERENCES clientes(telefono) ON DELETE CASCADE,
  direccion        TEXT NOT NULL,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  maps_url         TEXT,
  orden            INTEGER NOT NULL DEFAULT 0,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dir_cliente_orden ON cliente_direcciones (cliente_telefono, orden);

CREATE TABLE conductores (
  phone_full   TEXT PRIMARY KEY,
  full_name    TEXT NOT NULL,
  plate        TEXT,
  unit         TEXT,
  estado       estado_conductor NOT NULL DEFAULT 'disponible',
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pedidos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_code              TEXT NOT NULL UNIQUE,
  cliente_telefono         TEXT NOT NULL REFERENCES clientes(telefono),
  cliente_nombre           TEXT,
  ubic_descripcion         TEXT,
  ubic_direccion_completa  TEXT,
  ubic_lat                 DOUBLE PRECISION,
  ubic_lng                 DOUBLE PRECISION,
  ubic_maps_url            TEXT,
  estado                   estado_pedido NOT NULL DEFAULT 'pendiente',
  conductor_id             TEXT REFERENCES conductores(phone_full),
  conductor_data           JSONB,
  minutos_eta              INTEGER,
  wa_group_msg_id          TEXT,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT now(),
  aceptado_en              TIMESTAMPTZ
);
CREATE INDEX idx_pedidos_estado          ON pedidos (estado);
CREATE INDEX idx_pedidos_cliente_estado  ON pedidos (cliente_telefono, estado);

-- *** BLOQUEO ATOMICO DE ASIGNACION (reemplaza la transaccion de Firestore) ***
-- UPDATE pedidos SET estado='aceptado', conductor_id=$1, minutos_eta=$2, aceptado_en=now()
--   WHERE pedido_code=$3 AND estado='pendiente';
-- Si rowsAffected = 0 -> el pedido ya fue tomado por otro conductor.

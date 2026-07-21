-- CreateEnum
CREATE TYPE "EstadoConversacion" AS ENUM ('ninguna', 'esperando_ubicacion');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('pendiente', 'aceptado', 'finalizado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoConductor" AS ENUM ('disponible', 'ocupado', 'inactivo');

-- CreateTable
CREATE TABLE "clientes" (
    "telefono" TEXT NOT NULL,
    "nombre" TEXT,
    "conversacion" "EstadoConversacion" NOT NULL DEFAULT 'ninguna',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("telefono")
);

-- CreateTable
CREATE TABLE "cliente_direcciones" (
    "id" SERIAL NOT NULL,
    "clienteTelefono" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "mapsUrl" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conductores" (
    "phoneFull" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "plate" TEXT,
    "unit" TEXT,
    "estado" "EstadoConductor" NOT NULL DEFAULT 'disponible',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conductores_pkey" PRIMARY KEY ("phoneFull")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "pedidoCode" TEXT NOT NULL,
    "clienteTelefono" TEXT NOT NULL,
    "clienteNombre" TEXT,
    "ubicDescripcion" TEXT,
    "ubicDireccionCompleta" TEXT,
    "ubicLat" DOUBLE PRECISION,
    "ubicLng" DOUBLE PRECISION,
    "ubicMapsUrl" TEXT,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'pendiente',
    "conductorId" TEXT,
    "conductorData" JSONB,
    "minutosEta" INTEGER,
    "waGroupMsgId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceptadoEn" TIMESTAMP(3),

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cliente_direcciones_clienteTelefono_orden_idx" ON "cliente_direcciones"("clienteTelefono", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_pedidoCode_key" ON "pedidos"("pedidoCode");

-- CreateIndex
CREATE INDEX "pedidos_estado_idx" ON "pedidos"("estado");

-- CreateIndex
CREATE INDEX "pedidos_clienteTelefono_estado_idx" ON "pedidos"("clienteTelefono", "estado");

-- AddForeignKey
ALTER TABLE "cliente_direcciones" ADD CONSTRAINT "cliente_direcciones_clienteTelefono_fkey" FOREIGN KEY ("clienteTelefono") REFERENCES "clientes"("telefono") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_clienteTelefono_fkey" FOREIGN KEY ("clienteTelefono") REFERENCES "clientes"("telefono") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "conductores"("phoneFull") ON DELETE SET NULL ON UPDATE CASCADE;
